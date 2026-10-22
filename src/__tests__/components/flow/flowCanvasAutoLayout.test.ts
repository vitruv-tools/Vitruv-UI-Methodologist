import { Edge, Node } from 'reactflow';
import {
  LAYOUT_CONFIG,
  applyAutoLayoutPositions,
  buildAdjacencyMap,
  computeAutoLayoutPositions,
  findConnectedComponents,
  layoutComponent,
} from '../../../components/flow/flowCanvasAutoLayout';

const node = (id: string, x = 0, y = 0, type = 'ecoreFile'): Node =>
  ({ id, position: { x, y }, data: {}, type } as Node);

const reaction = (id: string, source: string, target: string): Edge =>
  ({ id, source, target, type: 'reactions' } as Edge);

describe('buildAdjacencyMap', () => {
  it('links both directions for reaction edges', () => {
    const nodes = [node('a'), node('b')];
    const map = buildAdjacencyMap(nodes, [reaction('e', 'a', 'b')]);

    expect(Array.from(map.get('a')!)).toEqual(['b']);
    expect(Array.from(map.get('b')!)).toEqual(['a']);
  });

  it('ignores non-reaction edges', () => {
    const nodes = [node('a'), node('b')];
    const map = buildAdjacencyMap(nodes, [{ id: 'u', source: 'a', target: 'b', type: 'uml' } as Edge]);

    expect(map.get('a')!.size).toBe(0);
  });
});

describe('findConnectedComponents', () => {
  it('separates isolated nodes from connected ones', () => {
    const nodes = [node('a'), node('b'), node('lonely')];
    const adjacency = buildAdjacencyMap(nodes, [reaction('e', 'a', 'b')]);

    const { components, isolatedNodes } = findConnectedComponents(nodes, adjacency);

    expect(isolatedNodes).toEqual(['lonely']);
    expect(components).toHaveLength(1);
    expect(components[0].sort()).toEqual(['a', 'b']);
  });

  it('finds several disjoint components', () => {
    const nodes = [node('a'), node('b'), node('c'), node('d')];
    const adjacency = buildAdjacencyMap(nodes, [
      reaction('e1', 'a', 'b'),
      reaction('e2', 'c', 'd'),
    ]);

    expect(findConnectedComponents(nodes, adjacency).components).toHaveLength(2);
  });
});

describe('layoutComponent', () => {
  it('places a single node exactly at the start position', () => {
    const positions = layoutComponent(['solo'], 40, 90, new Map());

    expect(positions.get('solo')).toEqual({ x: 40, y: 90 });
  });

  it('normalises a multi-node component to start at the given origin', () => {
    const adjacency = new Map([['a', new Set(['b'])], ['b', new Set(['a'])]]);
    const positions = layoutComponent(['a', 'b'], 100, 200, adjacency);

    const xs = Array.from(positions.values()).map(p => p.x);
    const ys = Array.from(positions.values()).map(p => p.y);

    expect(Math.min(...xs)).toBeCloseTo(100);
    expect(Math.min(...ys)).toBeCloseTo(200);
  });

  it('pushes connected nodes apart rather than stacking them', () => {
    const adjacency = new Map([['a', new Set(['b'])], ['b', new Set(['a'])]]);
    const positions = layoutComponent(['a', 'b'], 0, 0, adjacency);

    const a = positions.get('a')!;
    const b = positions.get('b')!;
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(LAYOUT_CONFIG.BOX_WIDTH);
  });
});

describe('computeAutoLayoutPositions', () => {
  it('assigns a position to every ecore node', () => {
    const nodes = [node('a'), node('b'), node('lonely')];
    const positions = computeAutoLayoutPositions(nodes, [reaction('e', 'a', 'b')]);

    expect(positions.size).toBe(3);
    nodes.forEach(n => expect(positions.get(n.id)).toBeDefined());
  });

  it('lays isolated nodes out in a grid below the components', () => {
    const nodes = [node('i1'), node('i2'), node('i3')];
    const positions = computeAutoLayoutPositions(nodes, []);

    // With no connected components the grid starts at the configured origin.
    expect(positions.get('i1')).toEqual({ x: LAYOUT_CONFIG.START_X, y: LAYOUT_CONFIG.START_Y });
    expect(positions.get('i2')!.x).toBeGreaterThan(positions.get('i1')!.x);
  });
});

describe('applyAutoLayoutPositions', () => {
  it('moves ecore nodes and leaves other node types untouched', () => {
    const editable = node('uml', 7, 7, 'editable');
    const nodes = [node('a', 0, 0), editable];
    const positions = new Map([['a', { x: 500, y: 600 }], ['uml', { x: 1, y: 1 }]]);

    const [movedEcore, untouched] = applyAutoLayoutPositions(nodes, positions);

    expect(movedEcore.position).toEqual({ x: 500, y: 600 });
    expect(untouched).toBe(editable);
  });

  it('keeps an ecore node in place when it has no computed position', () => {
    const original = node('a', 12, 34);

    expect(applyAutoLayoutPositions([original], new Map())[0]).toBe(original);
  });
});
