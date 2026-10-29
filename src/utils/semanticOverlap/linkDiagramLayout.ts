import type { Edge, Node } from 'reactflow';
import type { Correspondence, ElementRef, MatchLevel, OverlapResult, Side } from './types';
import { instanceLabel } from './correspondenceKind';

export const OVERLAP_CLASS_NODE = 'overlapClass';
export const SCORE_EDGE = 'score';

/** Indentation and row height of feature nodes relative to their class. */
const FEATURE_INDENT = 24;
const FEATURE_ROW_FACTOR = 0.75;

export interface OverlapClassNodeData {
  side: Side;
  level: MatchLevel;
  label: string;
  qualifiedName: string;
  /** Package part (classes) or the owning class (features). */
  packageName: string;
  /** Visible correspondences this element takes part in (best first). */
  correspondenceIds: string[];
  /** Not part of any correspondence at or above the threshold. */
  unmatched: boolean;
  selected: boolean;
  /** Class nodes only: the class has feature-level correspondences that can be shown. */
  expandable: boolean;
  expanded: boolean;
  /** Correspondence whose features the toggle shows or hides. */
  expandCorrespondenceId: string | null;
  /** Added by the diagram component; toggles `expandCorrespondenceId`. */
  onToggleExpand?: (correspondenceId: string) => void;
}

export interface ScoreEdgeData {
  correspondenceId: string;
  level: MatchLevel;
  score: number;
  selected: boolean;
  /** Set for class ↔ instance correspondences, e.g. "instance of ItemType"; drawn dashed. */
  instanceLabel?: string;
}

const instanceData = (c: Correspondence) => {
  const label = instanceLabel(c);
  return label ? { instanceLabel: label } : {};
};

export interface LinkDiagramOptions {
  minScore: number;
  selectedId: string | null;
  collapsedUnmatched: boolean;
  /** Class correspondences whose feature correspondences are shown. */
  expandedIds?: readonly string[];
  columnGap?: number;
  rowHeight?: number;
}

export const nodeIdFor = (side: Side, qualifiedName: string) => `${side === 'source' ? 's' : 't'}:${qualifiedName}`;
const featureNodeIdFor = (side: Side, correspondenceId: string, qualifiedName: string) =>
  `${side === 'source' ? 's' : 't'}:${correspondenceId}:${qualifiedName}`;

const packageOf = (qualifiedName: string) => qualifiedName.slice(0, Math.max(0, qualifiedName.lastIndexOf('.')));
const simpleName = (qualifiedName: string) => qualifiedName.slice(qualifiedName.lastIndexOf('.') + 1);

/** Correspondences shown at the given threshold. */
export const visibleCorrespondences = (result: OverlapResult, minScore: number): Correspondence[] =>
  result.correspondences.filter(c => c.score >= minScore);

/** Feature correspondences of a class correspondence shown at the given threshold. */
export const visibleChildren = (correspondence: Correspondence, minScore: number): Correspondence[] =>
  (correspondence.children ?? []).filter(c => c.score >= minScore);

const uniqueRefs = (refs: ElementRef[]) => [...new Map(refs.map(ref => [ref.qualifiedName, ref])).values()];

/**
 * Builds the read-only React Flow graph of the link diagram: source classes in the left column,
 * target classes in the right one, an edge per (source, target) pair of each visible
 * correspondence. Sources follow their best correspondence's rank; targets are sorted by the
 * barycentre of their matched sources to reduce crossings. Unmatched classes come last in each
 * column, or are omitted when collapsed. Expanded correspondences show their matched attributes and
 * references as indented nodes below the first class of the correspondence on each side.
 */
export function buildLinkDiagram(
  result: OverlapResult,
  { minScore, selectedId, collapsedUnmatched, expandedIds = [], columnGap = 480, rowHeight = 56 }: LinkDiagramOptions,
): { nodes: Node<OverlapClassNodeData>[]; edges: Edge<ScoreEdgeData>[] } {
  const visible = visibleCorrespondences(result, minScore);
  const expanded = visible.filter(c => expandedIds.includes(c.id) && visibleChildren(c, minScore).length > 0);
  const idsOf = new Map<string, string[]>();
  const remember = (key: string, id: string) => idsOf.set(key, [...(idsOf.get(key) ?? []), id]);
  visible.forEach(c => {
    c.sources.forEach(s => remember(nodeIdFor('source', s.qualifiedName), c.id));
    c.targets.forEach(t => remember(nodeIdFor('target', t.qualifiedName), c.id));
  });
  expanded.forEach(c => visibleChildren(c, minScore).forEach(child => {
    child.sources.forEach(s => remember(featureNodeIdFor('source', c.id, s.qualifiedName), child.id));
    child.targets.forEach(t => remember(featureNodeIdFor('target', c.id, t.qualifiedName), child.id));
  }));
  const byId = new Map(visible.map(c => [c.id, c]));

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

  const isSelected = (ids: string[]) => selectedId !== null && ids.includes(selectedId);

  const column = (side: Side, matched: string[], unmatched: string[], x: number): Node<OverlapClassNodeData>[] => {
    const order = [...matched, ...(collapsedUnmatched ? [] : unmatched)];
    const nodes: Node<OverlapClassNodeData>[] = [];
    let y = 0;
    for (const qualifiedName of order) {
      const id = nodeIdFor(side, qualifiedName);
      const correspondenceIds = idsOf.get(id) ?? [];
      const withChildren = correspondenceIds.map(cid => byId.get(cid)!).filter(c => visibleChildren(c, minScore).length > 0);
      const isExpanded = withChildren.some(c => expandedIds.includes(c.id));
      nodes.push({
        id,
        type: OVERLAP_CLASS_NODE,
        position: { x, y },
        draggable: false,
        connectable: false,
        selectable: true,
        data: {
          side,
          level: 'class',
          label: simpleName(qualifiedName),
          qualifiedName,
          packageName: packageOf(qualifiedName),
          correspondenceIds,
          unmatched: correspondenceIds.length === 0,
          selected: isSelected(correspondenceIds),
          expandable: withChildren.length > 0,
          expanded: isExpanded,
          expandCorrespondenceId: withChildren[0]?.id ?? null,
        },
      });
      y += rowHeight;

      // Features go below the first class of an expanded correspondence on this side.
      for (const c of expanded) {
        const owners = side === 'source' ? c.sources : c.targets;
        const firstOwner = order.find(name => owners.some(o => o.qualifiedName === name));
        if (firstOwner !== qualifiedName) continue;
        const children = visibleChildren(c, minScore);
        const features = uniqueRefs(children.flatMap(child => (side === 'source' ? child.sources : child.targets)));
        for (const feature of features) {
          const featureId = featureNodeIdFor(side, c.id, feature.qualifiedName);
          const featureCorrespondences = idsOf.get(featureId) ?? [];
          nodes.push({
            id: featureId,
            type: OVERLAP_CLASS_NODE,
            position: { x: x + FEATURE_INDENT, y },
            draggable: false,
            connectable: false,
            selectable: true,
            data: {
              side,
              level: 'feature',
              label: feature.name,
              qualifiedName: feature.qualifiedName,
              packageName: feature.containingClass ? simpleName(feature.containingClass) : '',
              correspondenceIds: featureCorrespondences,
              unmatched: false,
              selected: isSelected(featureCorrespondences),
              expandable: false,
              expanded: false,
              expandCorrespondenceId: null,
            },
          });
          y += rowHeight * FEATURE_ROW_FACTOR;
        }
      }
    }
    return nodes;
  };

  const classEdges: Edge<ScoreEdgeData>[] = visible.flatMap(c => c.sources.flatMap(s => c.targets.map(t => ({
    id: `e:${c.id}:${s.qualifiedName}:${t.qualifiedName}`,
    type: SCORE_EDGE,
    source: nodeIdFor('source', s.qualifiedName),
    target: nodeIdFor('target', t.qualifiedName),
    selected: c.id === selectedId,
    data: { correspondenceId: c.id, level: 'class' as const, score: c.score, selected: c.id === selectedId, ...instanceData(c) },
  }))));
  const featureEdges: Edge<ScoreEdgeData>[] = expanded.flatMap(c => visibleChildren(c, minScore).flatMap(child =>
    child.sources.flatMap(s => child.targets.map(t => ({
      id: `e:${child.id}:${s.qualifiedName}:${t.qualifiedName}`,
      type: SCORE_EDGE,
      source: featureNodeIdFor('source', c.id, s.qualifiedName),
      target: featureNodeIdFor('target', c.id, t.qualifiedName),
      selected: child.id === selectedId,
      data: { correspondenceId: child.id, level: 'feature' as const, score: child.score, selected: child.id === selectedId, ...instanceData(child) },
    })))));

  return {
    nodes: [
      ...column('source', matchedSources, unmatchedSources, 0),
      ...column('target', matchedTargets, unmatchedTargets, columnGap),
    ],
    edges: [...classEdges, ...featureEdges],
  };
}
