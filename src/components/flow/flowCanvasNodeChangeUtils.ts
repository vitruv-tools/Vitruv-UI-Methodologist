import { Node } from 'reactflow';
import { Circle, clampToCircle } from '../../hooks/useCircleContainment';
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
