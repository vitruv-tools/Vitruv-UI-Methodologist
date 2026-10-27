import type { Edge, Node } from 'reactflow';
import type { Correspondence, OverlapResult, Side } from './types';

export const OVERLAP_CLASS_NODE = 'overlapClass';
export const SCORE_EDGE = 'score';

export interface OverlapClassNodeData {
  side: Side;
  label: string;
  qualifiedName: string;
  /** Package part of the qualified name. */
  packageName: string;
  /** Visible correspondences this class takes part in (best first). */
  correspondenceIds: string[];
  /** Not part of any correspondence at or above the threshold. */
  unmatched: boolean;
  selected: boolean;
}

export interface ScoreEdgeData {
  correspondenceId: string;
  score: number;
  selected: boolean;
}

export interface LinkDiagramOptions {
  minScore: number;
  selectedId: string | null;
  collapsedUnmatched: boolean;
  columnGap?: number;
  rowHeight?: number;
}

export const nodeIdFor = (side: Side, qualifiedName: string) => `${side === 'source' ? 's' : 't'}:${qualifiedName}`;

const packageOf = (qualifiedName: string) => qualifiedName.slice(0, Math.max(0, qualifiedName.lastIndexOf('.')));
const simpleName = (qualifiedName: string) => qualifiedName.slice(qualifiedName.lastIndexOf('.') + 1);

/** Correspondences shown at the given threshold. */
export const visibleCorrespondences = (result: OverlapResult, minScore: number): Correspondence[] =>
  result.correspondences.filter(c => c.score >= minScore);

/**
 * Builds the read-only React Flow graph of the link diagram: source classes in the left column,
 * target classes in the right one, an edge per (source, target) pair of each visible
 * correspondence. Sources follow their best correspondence's rank; targets are sorted by the
 * barycentre of their matched sources to reduce crossings. Unmatched classes come last in each
 * column, or are omitted when collapsed.
 */
export function buildLinkDiagram(
  result: OverlapResult,
  { minScore, selectedId, collapsedUnmatched, columnGap = 480, rowHeight = 56 }: LinkDiagramOptions,
): { nodes: Node<OverlapClassNodeData>[]; edges: Edge<ScoreEdgeData>[] } {
  const visible = visibleCorrespondences(result, minScore);
  const idsOf = new Map<string, string[]>();
  const remember = (key: string, id: string) => idsOf.set(key, [...(idsOf.get(key) ?? []), id]);
  visible.forEach(c => {
    c.sources.forEach(s => remember(nodeIdFor('source', s.qualifiedName), c.id));
    c.targets.forEach(t => remember(nodeIdFor('target', t.qualifiedName), c.id));
  });
  const selected = visible.find(c => c.id === selectedId);

  const sourceRank = new Map<string, number>();
  visible.forEach(c => c.sources.forEach(s => {
    if (!sourceRank.has(s.qualifiedName)) sourceRank.set(s.qualifiedName, sourceRank.size);
  }));
  const matchedSources = [...sourceRank.keys()];
  const unmatchedSources = result.classMatrix.rows.filter(name => !sourceRank.has(name))
    .sort((a, b) => simpleName(a).localeCompare(simpleName(b)));

  const barycentre = new Map<string, number[]>();
  visible.forEach(c => c.targets.forEach(t => {
    const ranks = c.sources.map(s => sourceRank.get(s.qualifiedName)!);
    barycentre.set(t.qualifiedName, [...(barycentre.get(t.qualifiedName) ?? []), ...ranks]);
  }));
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const matchedTargets = [...barycentre.keys()]
    .sort((a, b) => mean(barycentre.get(a)!) - mean(barycentre.get(b)!) || a.localeCompare(b));
  const unmatchedTargets = result.classMatrix.columns.filter(name => !barycentre.has(name))
    .sort((a, b) => simpleName(a).localeCompare(simpleName(b)));

  const column = (side: Side, matched: string[], unmatched: string[], x: number): Node<OverlapClassNodeData>[] =>
    [...matched, ...(collapsedUnmatched ? [] : unmatched)].map((qualifiedName, index) => {
      const id = nodeIdFor(side, qualifiedName);
      const correspondenceIds = idsOf.get(id) ?? [];
      return {
        id,
        type: OVERLAP_CLASS_NODE,
        position: { x, y: index * rowHeight },
        draggable: false,
        connectable: false,
        selectable: true,
        data: {
          side,
          label: simpleName(qualifiedName),
          qualifiedName,
          packageName: packageOf(qualifiedName),
          correspondenceIds,
          unmatched: correspondenceIds.length === 0,
          selected: selected !== undefined && correspondenceIds.includes(selected.id),
        },
      };
    });

  const edges: Edge<ScoreEdgeData>[] = visible.flatMap(c => c.sources.flatMap(s => c.targets.map(t => ({
    id: `e:${c.id}:${s.qualifiedName}:${t.qualifiedName}`,
    type: SCORE_EDGE,
    source: nodeIdFor('source', s.qualifiedName),
    target: nodeIdFor('target', t.qualifiedName),
    selected: c.id === selectedId,
    data: { correspondenceId: c.id, score: c.score, selected: c.id === selectedId },
  }))));

  return {
    nodes: [
      ...column('source', matchedSources, unmatchedSources, 0),
      ...column('target', matchedTargets, unmatchedTargets, columnGap),
    ],
    edges,
  };
}
