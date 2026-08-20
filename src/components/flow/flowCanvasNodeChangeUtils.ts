import { Edge, Node } from 'reactflow';
import { Circle, clampToCircle } from '../../hooks/useCircleContainment';
import { ghostPositionChanges, isGhostNode } from '../../utils/FineGranularReactionUtils';
import { computeBoundingBoxRect } from '../../utils/expandMetaModel';
import { ecoreRectsOverlap } from './flowCanvasLayoutUtils';

/**
 * Viewers may reposition nodes to read a large model, so `position` changes are
 * allowed through; only structural edits are blocked. Positions are never part
 * of the workspace snapshot, so moving a node cannot reach the backend or mark
 * the project dirty.
 */
export function isReadOnlyBlockedNodeChange(change: { type?: string }): boolean {
  return change.type === 'remove';
}

export function isReadOnlyBlockedEdgeChange(change: { type?: string }): boolean {
  return change.type === 'remove';
}

interface ClampNodeChangesContext {
  circleVisible: boolean;
  umlModalOpen?: boolean;
  circle: Circle;
  nodes: Node[];
}

export function clampNodeChanges(
  changes: any[],
  ctx: ClampNodeChangesContext,
): any[] {
  return changes.map((change: any) => {
    if (change.type !== 'position' || !change.position) return change;

    let pos = change.position;

    if (ctx.circleVisible && !ctx.umlModalOpen) {
      const domNode = document.querySelector(`.react-flow__node[data-id="${change.id}"]`);
      const nodeSize = domNode
        ? { width: domNode.clientWidth, height: domNode.clientHeight }
        : { width: 280, height: 180 };
      pos = clampToCircle(pos, ctx.circle, nodeSize);
    }

    const self = ctx.nodes.find(n => n.id === change.id);
    if (self?.type === 'ecoreFile') {
      const others = ctx.nodes.filter(n => n.id !== change.id && n.type === 'ecoreFile');
      const wouldOverlap = others.some(n =>
        ecoreRectsOverlap(pos.x, pos.y, n.position.x, n.position.y),
      );
      if (wouldOverlap) pos = self.position;
    }

    return { ...change, position: pos };
  });
}

export function getNodeDragFlags(changes: any[]): { isDragging: boolean; dragEnded: boolean } {
  return {
    isDragging: changes.some((c: any) => c.type === 'position' && c.dragging === true),
    dragEnded: changes.some((c: any) => c.type === 'position' && c.dragging === false),
  };
}

export function shouldCloseDetailOnBoxDrag(
  changes: any[],
  detailModel: { model?: { name?: string; id?: number } } | null,
  nodes: Node[],
): boolean {
  if (!detailModel) return false;

  const detailName = detailModel.model?.name;
  const detailModelId = detailModel.model?.id;

  return changes.some((c: any) => {
    if (c.type !== 'position' || !c.dragging) return false;
    const node = nodes.find(n => n.id === c.id);
    if (node?.type !== 'ecoreFile') return false;
    if (detailModelId != null) {
      return node.data?.metaModelId === detailModelId
        || node.data?.metaModelSourceId === detailModelId;
    }
    if (detailName && node.data?.fileName) {
      return String(node.data.fileName).replace(/\.ecore$/i, '') === detailName;
    }
    return false;
  });
}

export function syncBboxDraggingIds(changes: any[], draggingIds: Set<string>): void {
  for (const c of changes) {
    if (c.type !== 'position' || !c.id?.startsWith('bbox-')) continue;
    if (c.dragging === true) draggingIds.add(c.id);
    if (c.dragging === false) draggingIds.delete(c.id);
  }
}

function applySingleNodeChange(existing: Node, change: any): Node {
  if (change.type === 'position' && change.position) {
    return { ...existing, position: change.position };
  }
  if (change.type === 'dimensions' && change.dimensions) {
    return {
      ...existing,
      width: change.dimensions.width,
      height: change.dimensions.height,
    };
  }
  return existing;
}

export function applyNodeChangesToSnapshot(nodes: Node[], changes: any[]): Node[] {
  const predicted = new Map(nodes.map((n) => [n.id, n] as const));
  for (const change of changes) {
    const existing = predicted.get(change.id);
    if (!existing) continue;
    predicted.set(change.id, applySingleNodeChange(existing, change));
  }
  return [...predicted.values()];
}

function bboxDragDelta(
  change: any,
  currentNode: Node | undefined,
): { dx: number; dy: number } | null {
  if (change.type !== 'position' || !change.position || change.dragging !== true) return null;
  if (!change.id?.startsWith('bbox-') || !currentNode) return null;
  const dx = change.position.x - currentNode.position.x;
  const dy = change.position.y - currentNode.position.y;
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return null;
  return { dx, dy };
}

function isBboxGroupMember(node: Node, bboxId: string): boolean {
  if (node.data?.group !== bboxId) return false;
  return isGhostNode(node) || node.type === 'eobject';
}

export function buildBboxChildDragChanges(changes: any[], liveNodes: Node[]): any[] {
  const extraChanges: any[] = [];
  for (const change of changes) {
    const currentNode = liveNodes.find((n) => n.id === change.id);
    const delta = bboxDragDelta(change, currentNode);
    if (!delta) continue;
    for (const node of liveNodes) {
      if (!isBboxGroupMember(node, change.id)) continue;
      extraChanges.push({
        type: 'position',
        id: node.id,
        position: { x: node.position.x + delta.dx, y: node.position.y + delta.dy },
        dragging: true,
      });
    }
  }
  return extraChanges;
}

function collectMovedEobjectGroups(changes: any[], liveNodes: Node[]): Set<string> {
  const groups = new Set<string>();
  for (const change of changes) {
    if (change.type !== 'position' || !change.position) continue;
    const node = liveNodes.find((n) => n.id === change.id);
    if (node?.type === 'eobject' && node.data?.group) groups.add(node.data.group);
  }
  return groups;
}

function bboxRectChanges(groupId: string, nodes: Node[]): any[] {
  const children = nodes.filter(
    (n) => n.type === 'eobject' && n.data?.group === groupId,
  );
  const rect = computeBoundingBoxRect(children);
  if (!rect) return [];
  return [
    {
      type: 'position',
      id: groupId,
      position: { x: rect.x, y: rect.y },
      dragging: false,
    },
    {
      type: 'dimensions',
      id: groupId,
      dimensions: { width: rect.width, height: rect.height },
      updateStyle: true,
    },
  ];
}

export function buildBboxFollowChanges(changes: any[], liveNodes: Node[]): any[] {
  const predicted = applyNodeChangesToSnapshot(liveNodes, changes);
  const extraChanges: any[] = [];
  for (const groupId of collectMovedEobjectGroups(changes, liveNodes)) {
    extraChanges.push(...bboxRectChanges(groupId, predicted));
  }
  return extraChanges;
}

export function collectNodeFollowChanges(args: {
  clampedChanges: any[];
  liveNodes: Node[];
  edges: Edge[];
  bboxDraggingIds: Set<string>;
}): any[] {
  const { clampedChanges, liveNodes, edges, bboxDraggingIds } = args;
  if (bboxDraggingIds.size > 0) {
    return buildBboxChildDragChanges(clampedChanges, liveNodes);
  }

  const extraChanges = buildBboxFollowChanges(clampedChanges, liveNodes);
  extraChanges.push(
    ...ghostPositionChanges(
      applyNodeChangesToSnapshot(liveNodes, [...clampedChanges, ...extraChanges]),
      edges,
    ),
  );
  return extraChanges;
}

export function clearUmlCustomControlPoints(edges: Edge[]): Edge[] {
  return edges.map((edge) => {
    if (edge.type !== 'uml') return edge;
    return { ...edge, data: { ...edge.data, customControlPoint: undefined } };
  });
}
