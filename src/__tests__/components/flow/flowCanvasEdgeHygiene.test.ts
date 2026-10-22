import { Edge, Node } from 'reactflow';
import {
  dedupeEdgeIds,
  removeOrphanEdges,
  uniquifyLoadedEdgeIds,
  uniquifyLoadedNodeIds,
  withUniqueEdgeIds,
} from '../../../components/flow/flowCanvasEdgeHygiene';

const edge = (id: string, source = 'a', target = 'b'): Edge =>
  ({ id, source, target } as Edge);

const node = (id: string): Node => ({ id, position: { x: 0, y: 0 }, data: {} } as Node);

describe('removeOrphanEdges', () => {
  it('drops edges whose endpoints no longer exist', () => {
    const nodes = [node('a'), node('b')];
    const edges = [edge('keep', 'a', 'b'), edge('gone', 'a', 'deleted')];

    expect(removeOrphanEdges(nodes, edges).map(e => e.id)).toEqual(['keep']);
  });

  it('keeps every edge when all endpoints are present', () => {
    const nodes = [node('a'), node('b')];
    const edges = [edge('one'), edge('two')];

    expect(removeOrphanEdges(nodes, edges)).toHaveLength(2);
  });
});

describe('dedupeEdgeIds', () => {
  it('returns null when all ids are already unique', () => {
    expect(dedupeEdgeIds([edge('a'), edge('b')])).toBeNull();
  });

  it('renames repeated ids, keeping the first occurrence', () => {
    const result = dedupeEdgeIds([edge('dup'), edge('dup'), edge('dup')]);

    expect(result?.map(e => e.id)).toEqual(['dup', 'dup__1', 'dup__2']);
  });

  it('leaves untouched edges referentially identical', () => {
    const first = edge('dup');
    const result = dedupeEdgeIds([first, edge('dup')]);

    expect(result?.[0]).toBe(first);
  });
});

describe('withUniqueEdgeIds', () => {
  it('suffixes duplicates with the dup marker', () => {
    const result = withUniqueEdgeIds([edge('x'), edge('x')]);

    expect(result.map(e => e.id)).toEqual(['x', 'x-dup-1']);
  });

  it('synthesises an id for edges that arrived without one', () => {
    const result = withUniqueEdgeIds([{ source: 'a', target: 'b' } as Edge]);

    expect(result[0].id).toBe('edge-0');
  });
});

describe('uniquifyLoadedEdgeIds', () => {
  it('probes upward until it finds a free id', () => {
    const result = uniquifyLoadedEdgeIds([
      { id: 'e' }, { id: 'e' }, { id: 'e-1' }, { id: 'e' },
    ]);

    expect(result.map(e => e.id)).toEqual(['e', 'e-1', 'e-1-1', 'e-2']);
  });

  it('falls back to an index-based id when none is supplied', () => {
    expect(uniquifyLoadedEdgeIds([{ source: 'a' }])[0].id).toBe('loaded-edge-0');
  });
});

describe('uniquifyLoadedNodeIds', () => {
  it('keeps existing ids', () => {
    expect(uniquifyLoadedNodeIds([{ id: 'kept' }])[0].id).toBe('kept');
  });

  it('generates an id when one is missing', () => {
    expect(uniquifyLoadedNodeIds([{ type: 'editable' }])[0].id).toMatch(/^loaded-node-0-\d+$/);
  });
});
