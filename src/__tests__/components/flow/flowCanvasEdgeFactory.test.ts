import { Node } from 'reactflow';
import {
  buildReactionEdge,
  metaModelIdsFromNodes,
} from '../../../components/flow/flowCanvasEdgeFactory';

const node = (id: string, x: number, y: number, data: Record<string, unknown> = {}): Node =>
  ({ id, position: { x, y }, data, type: 'ecoreFile' } as Node);

describe('metaModelIdsFromNodes', () => {
  it('prefers the named id and falls back to the other flavour', () => {
    const source = node('a', 0, 0, { metaModelId: 1 });
    const target = node('b', 0, 0, { metaModelSourceId: 2 });

    expect(metaModelIdsFromNodes(source, target)).toEqual({
      sourceMetaModelId: 1,
      targetMetaModelId: 2,
      sourceMetaModelSourceId: 1,
      targetMetaModelSourceId: 2,
    });
  });

  it('keeps both ids distinct when a node carries each', () => {
    const source = node('a', 0, 0, { metaModelId: 10, metaModelSourceId: 20 });
    const target = node('b', 0, 0, { metaModelId: 30, metaModelSourceId: 40 });
    const ids = metaModelIdsFromNodes(source, target);

    expect(ids.sourceMetaModelId).toBe(10);
    expect(ids.sourceMetaModelSourceId).toBe(20);
    expect(ids.targetMetaModelId).toBe(30);
    expect(ids.targetMetaModelSourceId).toBe(40);
  });

  it('yields undefined for nodes without numeric ids', () => {
    const ids = metaModelIdsFromNodes(node('a', 0, 0), node('b', 0, 0));

    expect(ids.sourceMetaModelId).toBeUndefined();
    expect(ids.targetMetaModelSourceId).toBeUndefined();
  });
});

describe('buildReactionEdge', () => {
  const source = node('a', 0, 0, { metaModelId: 1 });
  const target = node('b', 0, 500, { metaModelId: 2 });

  it('derives facing handles from the node positions', () => {
    const edge = buildReactionEdge({ id: 'e', sourceNode: source, targetNode: target, color: '#fff' });

    expect(edge.sourceHandle).toBe('bottom');
    expect(edge.targetHandle).toBe('top');
  });

  it('produces a styled reaction edge between the two nodes', () => {
    const edge = buildReactionEdge({ id: 'e', sourceNode: source, targetNode: target, color: '#abc' });

    expect(edge).toMatchObject({
      id: 'e',
      source: 'a',
      target: 'b',
      type: 'reactions',
      style: { stroke: '#abc', strokeWidth: 2 },
    });
  });

  it('includes the derived metamodel ids in the edge data', () => {
    const edge = buildReactionEdge({ id: 'e', sourceNode: source, targetNode: target, color: '#fff' });

    expect(edge.data.sourceMetaModelId).toBe(1);
    expect(edge.data.targetMetaModelId).toBe(2);
  });

  it('merges extra data over the derived ids', () => {
    const edge = buildReactionEdge({
      id: 'e',
      sourceNode: source,
      targetNode: target,
      color: '#fff',
      data: { reactionFileId: 99, backendRelationId: 7 },
    });

    expect(edge.data.reactionFileId).toBe(99);
    expect(edge.data.backendRelationId).toBe(7);
    expect(edge.data.sourceMetaModelId).toBe(1);
  });
});
