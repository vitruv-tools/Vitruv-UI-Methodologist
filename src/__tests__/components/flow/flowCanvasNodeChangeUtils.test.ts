import { Edge, Node } from 'reactflow';
import {
  applyNodeChangesToSnapshot,
  clearUmlCustomControlPoints,
  collectNodeFollowChanges,
  getNodeDragFlags,
  isReadOnlyBlockedEdgeChange,
  isReadOnlyBlockedNodeChange,
  syncBboxDraggingIds,
} from '../../../components/flow/flowCanvasNodeChangeUtils';

describe('isReadOnlyBlockedNodeChange', () => {
  it('blocks removing a node', () => {
    expect(isReadOnlyBlockedNodeChange({ type: 'remove' })).toBe(true);
  });

  it('allows a node to be dragged', () => {
    expect(isReadOnlyBlockedNodeChange({ type: 'position', dragging: true })).toBe(false);
  });

  it('allows the settling position when a drag ends', () => {
    expect(isReadOnlyBlockedNodeChange({ type: 'position', dragging: false })).toBe(false);
  });

  it('allows selection and dimension changes', () => {
    expect(isReadOnlyBlockedNodeChange({ type: 'select' })).toBe(false);
    expect(isReadOnlyBlockedNodeChange({ type: 'dimensions' })).toBe(false);
  });
});

describe('isReadOnlyBlockedEdgeChange', () => {
  it('blocks removing an edge', () => {
    expect(isReadOnlyBlockedEdgeChange({ type: 'remove' })).toBe(true);
  });

  it('allows selecting an edge', () => {
    expect(isReadOnlyBlockedEdgeChange({ type: 'select' })).toBe(false);
  });
});

describe('getNodeDragFlags', () => {
  it('reports an in-flight drag', () => {
    expect(getNodeDragFlags([{ type: 'position', dragging: true }]))
      .toEqual({ isDragging: true, dragEnded: false });
  });

  it('reports a finished drag', () => {
    expect(getNodeDragFlags([{ type: 'position', dragging: false }]))
      .toEqual({ isDragging: false, dragEnded: true });
  });

  it('reports neither for unrelated changes', () => {
    expect(getNodeDragFlags([{ type: 'select' }]))
      .toEqual({ isDragging: false, dragEnded: false });
  });
});

describe('syncBboxDraggingIds', () => {
  it('tracks bbox drag start and end', () => {
    const ids = new Set<string>();
    syncBboxDraggingIds([{ type: 'position', id: 'bbox-a', dragging: true }], ids);
    expect(ids.has('bbox-a')).toBe(true);
    syncBboxDraggingIds([{ type: 'position', id: 'bbox-a', dragging: false }], ids);
    expect(ids.has('bbox-a')).toBe(false);
  });

  it('ignores non-bbox position changes', () => {
    const ids = new Set<string>();
    syncBboxDraggingIds([{ type: 'position', id: 'eobj-1', dragging: true }], ids);
    expect(ids.size).toBe(0);
  });
});

describe('applyNodeChangesToSnapshot', () => {
  const node = { id: 'n1', type: 'eobject', position: { x: 0, y: 0 }, data: {} } as Node;

  it('applies position and dimension changes', () => {
    const [updated] = applyNodeChangesToSnapshot(
      [node],
      [
        { type: 'position', id: 'n1', position: { x: 10, y: 20 } },
        { type: 'dimensions', id: 'n1', dimensions: { width: 80, height: 40 } },
      ],
    );
    expect(updated.position).toEqual({ x: 10, y: 20 });
    expect(updated.width).toBe(80);
    expect(updated.height).toBe(40);
  });
});

describe('collectNodeFollowChanges', () => {
  const bbox = {
    id: 'bbox-a',
    type: 'boundingBox',
    position: { x: 0, y: 0 },
    data: {},
  } as Node;
  const child = {
    id: 'eobj-1',
    type: 'eobject',
    position: { x: 10, y: 10 },
    data: { group: 'bbox-a' },
  } as Node;

  it('moves grouped children when the bbox is dragged', () => {
    const extra = collectNodeFollowChanges({
      clampedChanges: [{
        type: 'position',
        id: 'bbox-a',
        position: { x: 5, y: 8 },
        dragging: true,
      }],
      liveNodes: [bbox, child],
      edges: [],
      bboxDraggingIds: new Set(['bbox-a']),
    });
    expect(extra).toEqual([
      {
        type: 'position',
        id: 'eobj-1',
        position: { x: 15, y: 18 },
        dragging: true,
      },
    ]);
  });

  it('updates the bbox when a grouped eobject moves', () => {
    const extra = collectNodeFollowChanges({
      clampedChanges: [{
        type: 'position',
        id: 'eobj-1',
        position: { x: 40, y: 50 },
      }],
      liveNodes: [bbox, child],
      edges: [],
      bboxDraggingIds: new Set(),
    });
    expect(extra.some((c) => c.type === 'position' && c.id === 'bbox-a')).toBe(true);
    expect(extra.some((c) => c.type === 'dimensions' && c.id === 'bbox-a')).toBe(true);
  });
});

describe('clearUmlCustomControlPoints', () => {
  it('clears custom control points on UML edges only', () => {
    const edges = [
      { id: 'u', type: 'uml', source: 'a', target: 'b', data: { customControlPoint: { x: 1, y: 2 } } },
      { id: 'r', type: 'reactions', source: 'a', target: 'b', data: { customControlPoint: { x: 1, y: 2 } } },
    ] as Edge[];
    const [uml, reaction] = clearUmlCustomControlPoints(edges);
    expect(uml.data?.customControlPoint).toBeUndefined();
    expect(reaction.data?.customControlPoint).toEqual({ x: 1, y: 2 });
  });
});
