import type { Edge, Node } from 'reactflow';
import { metaModelDisplayColor } from '../../utils/metaModelColors';
import {
  disableReactionEdges,
  disableReactionHandles,
  enableReactionEdges,
  enableReactionHandles,
  hydrateFineGranularReactionEdges,
  isIntraModelUmlEdge,
  mergeFineGranularEdges,
} from '../../utils/FineGranularReactionUtils';
import {
  expandMetaModelToNodes,
  type ExpandedMetaModelResult,
} from '../../utils/expandMetaModel';
import { syncIdentifierMapFromCanvasNodes } from '../../utils/ReactionUtils';
import {
  applyReactionLayout,
  loadReactionLayout,
  persistReactionLayoutFromNodes,
} from '../../utils/reactionLayoutStorage';
import { useProjectStore } from '../../store/Project';

export type Point = { x: number; y: number };
export type Offset = { dx: number; dy: number };

export type ExpandResultEntry = {
  ecoreId: string;
  result: ExpandedMetaModelResult;
  restored: boolean;
};

export interface ReactionModeToggleContext {
  nodes: Node[];
  setNodes: (updater: (nds: Node[]) => Node[]) => void;
  setEdges: (updater: (eds: Edge[]) => Edge[]) => void;
  vsumPositions: Map<string, Point>;
  reactionOffsets: Map<string, Offset>;
}

function bboxSize(box: Node): { w: number; h: number } {
  return {
    w: (box.style?.width as number) ?? 400,
    h: (box.style?.height as number) ?? 300,
  };
}

export function expandedBoxesOverlap(cur: Node, prev: Node): boolean {
  const curSize = bboxSize(cur);
  const prevSize = bboxSize(prev);
  const overlapX = cur.position.x < prev.position.x + prevSize.w + 20
    && cur.position.x + curSize.w > prev.position.x - 20;
  const overlapY = cur.position.y < prev.position.y + prevSize.h + 20
    && cur.position.y + curSize.h > prev.position.y - 20;
  return overlapX && overlapY;
}

export function shiftExpandedResult(result: ExpandedMetaModelResult, shiftX: number): void {
  result.boundingBox.position = {
    x: result.boundingBox.position.x + shiftX,
    y: result.boundingBox.position.y,
  };
  for (const eNode of result.eObjectNodes) {
    eNode.position = { x: eNode.position.x + shiftX, y: eNode.position.y };
  }
  for (const ghost of result.ghostNodes ?? []) {
    ghost.position = { x: ghost.position.x + shiftX, y: ghost.position.y };
  }
}

function shiftResultPastPrevious(expandResults: ExpandResultEntry[], index: number): void {
  const cur = expandResults[index].result.boundingBox;
  for (let j = 0; j < index; j++) {
    const prev = expandResults[j].result.boundingBox;
    if (!expandedBoxesOverlap(cur, prev)) continue;
    const shiftX = (prev.position.x + bboxSize(prev).w + 30) - cur.position.x;
    shiftExpandedResult(expandResults[index].result, shiftX);
  }
}

export function resolveExpandOverlaps(expandResults: ExpandResultEntry[]): void {
  for (let i = 1; i < expandResults.length; i++) {
    if (expandResults[i].restored) continue;
    shiftResultPastPrevious(expandResults, i);
  }
}

function rememberVsumPositions(ecoreNodes: Node[], vsumPositions: Map<string, Point>): void {
  for (const ecoreNode of ecoreNodes) {
    vsumPositions.set(ecoreNode.id, { ...ecoreNode.position });
  }
}

function expandSingleEcoreNode(
  ecoreNode: Node,
  savedLayout: ReturnType<typeof loadReactionLayout>,
): ExpandResultEntry | null {
  const fileContent = ecoreNode.data?.fileContent;
  const fileName = ecoreNode.data?.fileName;
  if (!fileContent || !fileName) return null;
  const result = expandMetaModelToNodes(
    fileContent,
    fileName,
    { x: ecoreNode.position.x, y: ecoreNode.position.y },
    ecoreNode.data?.domain,
    metaModelDisplayColor(ecoreNode.data?.domain, fileName),
  );
  if (!result) return null;
  const restored = applyReactionLayout(result, savedLayout[result.modelNsUri]);
  return { ecoreId: ecoreNode.id, result, restored };
}

function expandAllEcoreNodes(ecoreNodes: Node[]): ExpandResultEntry[] {
  const savedLayout = loadReactionLayout(useProjectStore.getState().activeId);
  const expandResults: ExpandResultEntry[] = [];
  for (const ecoreNode of ecoreNodes) {
    const expanded = expandSingleEcoreNode(ecoreNode, savedLayout);
    if (expanded) expandResults.push(expanded);
  }
  return expandResults;
}

export function storeReactionOffsets(
  expandResults: ExpandResultEntry[],
  vsumPositions: Map<string, Point>,
  reactionOffsets: Map<string, Offset>,
): void {
  reactionOffsets.clear();
  for (const { ecoreId, result } of expandResults) {
    const vsumPos = vsumPositions.get(ecoreId);
    if (!vsumPos) continue;
    reactionOffsets.set(result.boundingBox.id, {
      dx: result.boundingBox.position.x - vsumPos.x,
      dy: result.boundingBox.position.y - vsumPos.y,
    });
  }
}

function flattenExpandResults(expandResults: ExpandResultEntry[]): {
  newNodes: Node[];
  intraModelEdges: Edge[];
} {
  const newNodes: Node[] = [];
  const intraModelEdges: Edge[] = [];
  for (const { result } of expandResults) {
    newNodes.push(
      result.boundingBox,
      ...result.eObjectNodes,
      ...(result.ghostNodes ?? []),
    );
    intraModelEdges.push(...(result.umlEdges ?? []));
  }
  return { newNodes, intraModelEdges };
}

function mergeExpandedEdges(
  current: Edge[],
  intraModelEdges: Edge[],
  fineEdges: Edge[],
): Edge[] {
  const withIntra = intraModelEdges.length > 0 ? [...current, ...intraModelEdges] : current;
  if (fineEdges.length === 0) return withIntra;
  return mergeFineGranularEdges(withIntra, fineEdges);
}

function applyExpandedGraph(
  expandResults: ExpandResultEntry[],
  ctx: ReactionModeToggleContext,
): void {
  const { newNodes, intraModelEdges } = flattenExpandResults(expandResults);
  if (newNodes.length === 0) return;
  ctx.setNodes((nds) => [
    ...nds.map((n) => (n.type === 'ecoreFile' ? { ...n, hidden: true } : n)),
    ...newNodes,
  ]);
  syncIdentifierMapFromCanvasNodes(ctx.nodes);
  const endpointNodes = newNodes.filter((n) => n.type === 'eobject' || n.type === 'ghost');
  const ecoreFiles = ctx.nodes.filter((n) => n.type === 'ecoreFile');
  const fineEdges = hydrateFineGranularReactionEdges(endpointNodes, ecoreFiles);
  ctx.setEdges((eds) => mergeExpandedEdges(eds, intraModelEdges, fineEdges));
}

function expandEcoreFilesIfNeeded(ctx: ReactionModeToggleContext): void {
  const ecoreNodes = ctx.nodes.filter((n) => n.type === 'ecoreFile');
  if (ecoreNodes.length === 0) return;
  if (ctx.nodes.some((n) => n.type === 'boundingBox')) return;
  rememberVsumPositions(ecoreNodes, ctx.vsumPositions);
  const expandResults = expandAllEcoreNodes(ecoreNodes);
  resolveExpandOverlaps(expandResults);
  storeReactionOffsets(expandResults, ctx.vsumPositions, ctx.reactionOffsets);
  applyExpandedGraph(expandResults, ctx);
}

export function enterReactionMode(ctx: ReactionModeToggleContext): void {
  useProjectStore.getState().setMode('reactions');
  enableReactionHandles();
  enableReactionEdges();
  expandEcoreFilesIfNeeded(ctx);
}

function collectBboxPositions(nds: Node[]): Map<string, Point> {
  const bboxPositions = new Map<string, Point>();
  for (const n of nds) {
    if (n.type === 'boundingBox') bboxPositions.set(n.id, n.position);
  }
  return bboxPositions;
}

export function collapsedEcoreNode(
  node: Node,
  bboxPositions: Map<string, Point>,
  offsets: Map<string, Offset>,
  vsumPositions: Map<string, Point>,
): Node {
  if (node.type !== 'ecoreFile') return node;
  const nsUri = node.data?.nsUri;
  const bboxId = nsUri ? `bbox-${nsUri}` : null;
  const bboxPos = bboxId ? bboxPositions.get(bboxId) : undefined;
  const offset = bboxId ? offsets.get(bboxId) : undefined;
  const newPos = bboxPos && offset
    ? { x: bboxPos.x - offset.dx, y: bboxPos.y - offset.dy }
    : node.position;
  vsumPositions.set(node.id, newPos);
  return { ...node, hidden: false, position: newPos };
}

export function collapseReactionGraph(
  nds: Node[],
  offsets: Map<string, Offset>,
  vsumPositions: Map<string, Point>,
): Node[] {
  persistReactionLayoutFromNodes(useProjectStore.getState().activeId, nds);
  const bboxPositions = collectBboxPositions(nds);
  return nds
    .filter((n) => n.type !== 'eobject' && n.type !== 'boundingBox' && n.type !== 'ghost')
    .map((n) => collapsedEcoreNode(n, bboxPositions, offsets, vsumPositions));
}

export function exitReactionMode(ctx: ReactionModeToggleContext): void {
  if (useProjectStore.getState().mode === 'reactions') {
    useProjectStore.getState().setMode('workspace');
  }
  disableReactionHandles();
  disableReactionEdges();
  ctx.setEdges((eds) => eds.filter(
    (e) => e.type !== 'fine-granular-reaction' && !isIntraModelUmlEdge(e),
  ));
  ctx.setNodes((nds) => collapseReactionGraph(nds, ctx.reactionOffsets, ctx.vsumPositions));
}
