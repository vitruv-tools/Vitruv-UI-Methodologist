import { Edge, Node } from 'reactflow';
import { buildWorkspaceSnapshot } from '../../../components/flow/flowCanvasSnapshot';

const ecore = (id: string, data: Record<string, unknown>): Node =>
  ({ id, position: { x: 0, y: 0 }, data, type: 'ecoreFile' } as Node);

const reaction = (id: string, source: string, target: string, data: Record<string, unknown> = {}): Edge =>
  ({ id, source, target, type: 'reactions', data } as Edge);

describe('buildWorkspaceSnapshot', () => {
  const nodes = [
    ecore('a', { metaModelSourceId: 1 }),
    ecore('b', { metaModelSourceId: 2 }),
  ];

  it('collects the metamodel ids of the ecore nodes', () => {
    expect(buildWorkspaceSnapshot(nodes, []).metaModelIds).toEqual([1, 2]);
  });

  it('excludes non-ecore nodes', () => {
    const withEditable = [
      ...nodes,
      { id: 'uml', position: { x: 0, y: 0 }, data: { metaModelSourceId: 99 }, type: 'editable' } as Node,
    ];

    expect(buildWorkspaceSnapshot(withEditable, []).metaModelIds).toEqual([1, 2]);
  });

  it('de-duplicates repeated metamodel ids', () => {
    const duplicated = [...nodes, ecore('c', { metaModelSourceId: 1 })];

    expect(buildWorkspaceSnapshot(duplicated, []).metaModelIds).toEqual([1, 2]);
  });

  it('maps reaction edges to relation requests', () => {
    const edges = [reaction('e', 'a', 'b', { reactionFileId: 7 })];

    expect(buildWorkspaceSnapshot(nodes, edges).metaModelRelationRequests).toEqual([
      { sourceId: 1, targetId: 2, reactionFileId: 7 },
    ]);
  });

  it('defaults a missing reaction file id to zero', () => {
    const edges = [reaction('e', 'a', 'b')];

    expect(buildWorkspaceSnapshot(nodes, edges).metaModelRelationRequests[0].reactionFileId).toBe(0);
  });

  it('ignores non-reaction edges', () => {
    const edges = [{ id: 'u', source: 'a', target: 'b', type: 'uml' } as Edge];

    expect(buildWorkspaceSnapshot(nodes, edges).metaModelRelationRequests).toEqual([]);
  });

  it('drops relations whose endpoints have no resolvable metamodel id', () => {
    const withUnmapped = [...nodes, ecore('c', {})];
    const edges = [reaction('e', 'a', 'c')];

    expect(buildWorkspaceSnapshot(withUnmapped, edges).metaModelRelationRequests).toEqual([]);
  });
});
