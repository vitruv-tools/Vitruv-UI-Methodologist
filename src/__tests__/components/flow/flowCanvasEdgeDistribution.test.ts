import { Edge, Node } from 'reactflow';
import {
  buildEdgeDistributionMap,
  collectNodeSideEdges,
} from '../../../components/flow/flowCanvasEdgeDistribution';

const ecore = (id: string): Node => ({ id, position: { x: 0, y: 0 }, data: {}, type: 'ecoreFile' } as Node);

const reaction = (id: string, source: string, target: string): Edge =>
  ({ id, source, target, type: 'reactions', sourceHandle: 'bottom', targetHandle: 'top' } as Edge);

describe('collectNodeSideEdges', () => {
  it('groups edges by the handle they attach to', () => {
    const edges = [reaction('e1', 'a', 'b')];
    const sideMap = collectNodeSideEdges(ecore('a'), edges);

    expect(sideMap.get('bottom')).toEqual(['e1']);
    expect(sideMap.get('top')).toEqual([]);
  });

  it('records the edge on the target side too', () => {
    const sideMap = collectNodeSideEdges(ecore('b'), [reaction('e1', 'a', 'b')]);

    expect(sideMap.get('top')).toEqual(['e1']);
  });

  it('ignores non-reaction edges', () => {
    const uml = { id: 'u', source: 'a', target: 'b', type: 'uml', sourceHandle: 'bottom' } as Edge;
    const sideMap = collectNodeSideEdges(ecore('a'), [uml]);

    expect(sideMap.get('bottom')).toEqual([]);
  });

  it('does not list a self-loop twice on one side', () => {
    const loop = { id: 'l', source: 'a', target: 'a', type: 'reactions', sourceHandle: 'bottom', targetHandle: 'bottom' } as Edge;
    const sideMap = collectNodeSideEdges(ecore('a'), [loop]);

    expect(sideMap.get('bottom')).toEqual(['l']);
  });
});

describe('buildEdgeDistributionMap', () => {
  const nodes = [ecore('a'), ecore('b'), ecore('c')];

  it('assigns each edge on a handle an index out of the total', () => {
    const edges = [reaction('e1', 'a', 'b'), reaction('e2', 'a', 'c')];
    const bottom = buildEdgeDistributionMap(nodes, edges).get('a')!.get('bottom')!;

    expect(bottom).toEqual([
      { edgeId: 'e1', index: 0, total: 2 },
      { edgeId: 'e2', index: 1, total: 2 },
    ]);
  });

  it('orders slots by the far-end node id, not by array order', () => {
    const edges = [reaction('toC', 'a', 'c'), reaction('toB', 'a', 'b')];
    const bottom = buildEdgeDistributionMap(nodes, edges).get('a')!.get('bottom')!;

    expect(bottom.map(slot => slot.edgeId)).toEqual(['toB', 'toC']);
  });

  it('skips nodes that are not ecore files', () => {
    const withEditable = [...nodes, { id: 'uml', position: { x: 0, y: 0 }, data: {}, type: 'editable' } as Node];

    expect(buildEdgeDistributionMap(withEditable, []).has('uml')).toBe(false);
  });

  it('gives every ecore node an entry even with no edges', () => {
    const map = buildEdgeDistributionMap(nodes, []);

    expect(map.size).toBe(3);
    expect(map.get('a')!.get('bottom')).toEqual([]);
  });
});
