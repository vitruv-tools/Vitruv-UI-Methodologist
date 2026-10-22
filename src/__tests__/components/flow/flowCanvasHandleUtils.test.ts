import { Edge, Node } from 'reactflow';
import {
  calculateOptimalHandles,
  calculateReactionHandles,
  cleanHandleId,
  optimizeEdgeHandles,
  updateEdgeHandles,
} from '../../../components/flow/flowCanvasHandleUtils';

const node = (id: string, x: number, y: number): Node =>
  ({ id, position: { x, y }, data: {}, type: 'ecoreFile' } as Node);

describe('cleanHandleId', () => {
  it('strips the source and target suffixes', () => {
    expect(cleanHandleId('bottom-source')).toBe('bottom');
    expect(cleanHandleId('top-target')).toBe('top');
  });

  it('leaves an already-clean handle untouched', () => {
    expect(cleanHandleId('left')).toBe('left');
  });
});

describe('calculateOptimalHandles', () => {
  const source = node('a', 0, 0);

  it('connects bottom-to-top when the target is below', () => {
    expect(calculateOptimalHandles(source, node('b', 0, 500))).toEqual({
      sourceHandle: 'bottom-source',
      targetHandle: 'top-target',
    });
  });

  it('connects top-to-bottom when the target is above', () => {
    expect(calculateOptimalHandles(source, node('b', 0, -500))).toEqual({
      sourceHandle: 'top-source',
      targetHandle: 'bottom-target',
    });
  });

  it('connects right-to-left when the target is to the right', () => {
    expect(calculateOptimalHandles(source, node('b', 500, 0))).toEqual({
      sourceHandle: 'right-source',
      targetHandle: 'left-target',
    });
  });

  it('connects left-to-right when the target is to the left', () => {
    expect(calculateOptimalHandles(source, node('b', -500, 0))).toEqual({
      sourceHandle: 'left-source',
      targetHandle: 'right-target',
    });
  });

  it('prefers the horizontal axis when both offsets are equal', () => {
    expect(calculateOptimalHandles(source, node('b', 100, 100)).sourceHandle).toBe('right-source');
  });
});

describe('calculateReactionHandles', () => {
  it('returns handles without the suffixes', () => {
    expect(calculateReactionHandles(node('a', 0, 0), node('b', 0, 300))).toEqual({
      sourceHandle: 'bottom',
      targetHandle: 'top',
    });
  });
});

describe('updateEdgeHandles', () => {
  const nodes = [node('a', 0, 0), node('b', 0, 500)];

  it('ignores edges that are neither reaction nor UML', () => {
    const edge = { id: 'e', source: 'a', target: 'b', type: 'default' } as Edge;
    expect(updateEdgeHandles(edge, nodes)).toBe(edge);
  });

  it('returns the same edge when an endpoint is missing', () => {
    const edge = { id: 'e', source: 'a', target: 'missing', type: 'reactions' } as Edge;
    expect(updateEdgeHandles(edge, nodes)).toBe(edge);
  });

  it('returns the same edge when the handles are already correct', () => {
    const edge = {
      id: 'e', source: 'a', target: 'b', type: 'reactions',
      sourceHandle: 'bottom', targetHandle: 'top',
    } as Edge;
    expect(updateEdgeHandles(edge, nodes)).toBe(edge);
  });

  it('re-points a stale reaction edge and clears its control point', () => {
    const edge = {
      id: 'e', source: 'a', target: 'b', type: 'reactions',
      sourceHandle: 'left', targetHandle: 'right',
      data: { customControlPoint: { x: 5, y: 5 }, code: 'keep me' },
    } as Edge;

    const result = updateEdgeHandles(edge, nodes);

    expect(result.sourceHandle).toBe('bottom');
    expect(result.targetHandle).toBe('top');
    expect(result.data.customControlPoint).toBeUndefined();
    expect(result.data.code).toBe('keep me');
  });

  it('keeps the suffixed handle form for UML edges', () => {
    const edge = {
      id: 'e', source: 'a', target: 'b', type: 'uml',
      sourceHandle: 'left-source', targetHandle: 'right-target',
    } as Edge;

    const result = updateEdgeHandles(edge, nodes);

    expect(result.sourceHandle).toBe('bottom-source');
    expect(result.targetHandle).toBe('top-target');
  });
});

describe('optimizeEdgeHandles', () => {
  it('rewrites reaction edges and leaves other types alone', () => {
    const nodes = [node('a', 0, 0), node('b', 600, 0)];
    const reaction = {
      id: 'r', source: 'a', target: 'b', type: 'reactions',
      sourceHandle: 'top', targetHandle: 'bottom',
      data: { customControlPoint: { x: 1, y: 1 } },
    } as Edge;
    const uml = { id: 'u', source: 'a', target: 'b', type: 'uml', sourceHandle: 'top-source' } as Edge;

    const [updatedReaction, updatedUml] = optimizeEdgeHandles(nodes, [reaction, uml]);

    expect(updatedReaction.sourceHandle).toBe('right');
    expect(updatedReaction.targetHandle).toBe('left');
    expect(updatedReaction.data.customControlPoint).toBeUndefined();
    expect(updatedUml).toBe(uml);
  });
});
