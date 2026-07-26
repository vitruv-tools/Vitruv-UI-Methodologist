import { Edge, Node } from 'reactflow';
import {
  applyEdgeReorderData,
  calculateDefaultControlPoint,
  computeParallelEdgeReorder,
} from '../../../components/flow/flowCanvasEdgeReorder';
import { NODE_DIMENSIONS } from '../../../components/flow/flowCanvasConstants';

const node = (id: string, x = 0, y = 0): Node =>
  ({ id, position: { x, y }, data: {}, type: 'ecoreFile' } as Node);

const reaction = (id: string, target: string, controlPointX: number): Edge =>
  ({
    id,
    source: 'a',
    target,
    type: 'reactions',
    sourceHandle: 'bottom',
    targetHandle: 'top',
    data: { customControlPoint: { x: controlPointX, y: 50 } },
  } as Edge);

describe('calculateDefaultControlPoint', () => {
  it('returns the midpoint between the two boxes', () => {
    const nodes = [node('a', 0, 0), node('b', 200, 400)];
    const edge = { id: 'e', source: 'a', target: 'b' } as Edge;

    expect(calculateDefaultControlPoint(edge, nodes)).toEqual({
      x: (0 + 200 + NODE_DIMENSIONS.width) / 2,
      y: (0 + 400 + NODE_DIMENSIONS.height) / 2,
    });
  });

  it('falls back to the origin when an endpoint is missing', () => {
    const edge = { id: 'e', source: 'a', target: 'ghost' } as Edge;

    expect(calculateDefaultControlPoint(edge, [node('a')])).toEqual({ x: 0, y: 0 });
  });
});

describe('applyEdgeReorderData', () => {
  it('writes slot index and count onto participating edges only', () => {
    const e1 = reaction('e1', 'b', 0);
    const e2 = reaction('e2', 'c', 0);
    const unrelated = { id: 'other', source: 'z', target: 'y' } as Edge;

    const result = applyEdgeReorderData([e1, e2, unrelated], [e2, e1], []);

    expect(result[0].data.sourceParallelIndex).toBe(1);
    expect(result[1].data.sourceParallelIndex).toBe(0);
    expect(result[0].data.sourceParallelCount).toBe(2);
    expect(result[2]).toBe(unrelated);
  });
});

describe('computeParallelEdgeReorder', () => {
  const nodes = [node('a', 0, 0), node('b', 0, 500), node('c', 400, 500)];

  it('leaves the list untouched for a non-reaction edge', () => {
    const edges = [{ id: 'u', source: 'a', target: 'b', type: 'uml' } as Edge];

    expect(computeParallelEdgeReorder(edges, { edgeId: 'u', controlPoint: { x: 0, y: 0 }, nodes }))
      .toBe(edges);
  });

  it('leaves the list untouched when the edge id is unknown', () => {
    const edges = [reaction('e1', 'b', 100)];

    expect(computeParallelEdgeReorder(edges, { edgeId: 'missing', controlPoint: { x: 0, y: 0 }, nodes }))
      .toBe(edges);
  });

  it('leaves the list untouched when an endpoint node is missing', () => {
    const edges = [reaction('e1', 'ghost', 100)];

    expect(computeParallelEdgeReorder(edges, { edgeId: 'e1', controlPoint: { x: 0, y: 0 }, nodes }))
      .toBe(edges);
  });

  it('re-slots edges sharing a handle by the dragged control point', () => {
    const edges = [reaction('e1', 'b', 100), reaction('e2', 'c', 300)];

    // Drag e2 to the left of e1 — on a bottom handle the x axis decides order.
    const result = computeParallelEdgeReorder(edges, {
      edgeId: 'e2',
      controlPoint: { x: 0, y: 50 },
      nodes,
    });

    const byId = new Map(result.map(e => [e.id, e]));
    expect(byId.get('e2')!.data.sourceParallelIndex).toBe(0);
    expect(byId.get('e1')!.data.sourceParallelIndex).toBe(1);
    expect(byId.get('e1')!.data.sourceParallelCount).toBe(2);
  });

  it('counts a lone edge on the target handle as a single slot', () => {
    const edges = [reaction('e1', 'b', 100), reaction('e2', 'c', 300)];

    const result = computeParallelEdgeReorder(edges, {
      edgeId: 'e2',
      controlPoint: { x: 0, y: 50 },
      nodes,
    });

    const e2 = result.find(e => e.id === 'e2')!;
    expect(e2.data.targetParallelIndex).toBe(0);
    expect(e2.data.targetParallelCount).toBe(1);
  });
});
