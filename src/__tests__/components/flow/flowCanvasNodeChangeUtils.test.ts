import {
  getNodeDragFlags,
  isReadOnlyBlockedEdgeChange,
  isReadOnlyBlockedNodeChange,
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
