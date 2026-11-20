import type { Edge, Node } from 'reactflow';
import {
  applyRelationToStore,
  moveMetaModelBoxes,
  removeMetaModelFromCanvas,
  removeReactionEdge,
  removeRelationFromStore,
  upsertReactionEdge,
} from '../../../components/flow/flowCanvasCollaboration';
import type { EditableVsumMetaModelRelation } from '../../../types/EditableVsumDetails';

const box = (id: string, sourceId: number, extra: Partial<Node> = {}): Node => ({
  id,
  type: 'ecoreFile',
  position: { x: sourceId * 100, y: 0 },
  data: { metaModelId: sourceId + 1000, metaModelSourceId: sourceId, nsUri: `ns:${sourceId}` },
  ...extra,
});
const reactionEdge = (id: string, source: string, target: string, reactionFileId: number | null = null): Edge => ({
  id,
  source,
  target,
  type: 'reactions',
  data: { reactionFileId },
});

const nodes = [box('ecore-1001', 1), box('ecore-1002', 2), box('ecore-1003', 3)];

describe('removeMetaModelFromCanvas', () => {
  it('removes the box of the metamodel and the edges that end at it', () => {
    const edges = [reactionEdge('e12', 'ecore-1001', 'ecore-1002'), reactionEdge('e23', 'ecore-1002', 'ecore-1003')];

    const result = removeMetaModelFromCanvas(nodes, edges, 2);

    expect(result.nodes.map((n) => n.id)).toEqual(['ecore-1001', 'ecore-1003']);
    expect(result.edges).toEqual([]);
  });

  it('finds the box by the library ID, or by the ID of the metamodel itself if it has no library ID', () => {
    const noLibraryId: Node = { id: 'own', type: 'ecoreFile', position: { x: 0, y: 0 }, data: { metaModelId: 8 } };

    expect(removeMetaModelFromCanvas([box('lib', 5)], [], 5).nodes).toEqual([]);
    expect(removeMetaModelFromCanvas([box('lib', 5)], [], 1005).nodes).toHaveLength(1);
    expect(removeMetaModelFromCanvas([noLibraryId], [], 8).nodes).toEqual([]);
  });

  it('also removes what the metamodel was expanded into in the reaction view', () => {
    const expanded: Node[] = [
      { id: 'bbox-ns:2', type: 'boundingBox', position: { x: 0, y: 0 }, data: { nsUri: 'ns:2' } },
      { id: 'eobject-ns:2-Brake', type: 'eobject', position: { x: 0, y: 0 }, data: { group: 'bbox-ns:2' } },
      { id: 'ghost-ns:2-x', type: 'ghost', position: { x: 0, y: 0 }, data: { group: 'bbox-ns:2' } },
      { id: 'bbox-ns:3', type: 'boundingBox', position: { x: 0, y: 0 }, data: { nsUri: 'ns:3' } },
      { id: 'eobject-ns:3-Wheel', type: 'eobject', position: { x: 0, y: 0 }, data: { group: 'bbox-ns:3' } },
    ];
    const fine: Edge = { id: 'fine', source: 'eobject-ns:2-Brake', target: 'eobject-ns:3-Wheel', type: 'fine-granular-reaction' };

    const result = removeMetaModelFromCanvas([...nodes, ...expanded], [fine], 2);

    expect(result.nodes.map((n) => n.id)).toEqual(['ecore-1001', 'ecore-1003', 'bbox-ns:3', 'eobject-ns:3-Wheel']);
    expect(result.edges).toEqual([]);
  });

  it('returns the same arrays if the metamodel is not on the canvas', () => {
    const edges = [reactionEdge('e12', 'ecore-1001', 'ecore-1002')];

    const result = removeMetaModelFromCanvas(nodes, edges, 9);

    expect(result.nodes).toBe(nodes);
    expect(result.edges).toBe(edges);
  });
});

describe('moveMetaModelBoxes', () => {
  it('moves the boxes of the metamodels, and keeps the other nodes and boxes as they are', () => {
    const result = moveMetaModelBoxes(nodes, new Map([[2, { x: 5, y: 6 }]]));

    expect(result[1].position).toEqual({ x: 5, y: 6 });
    expect(result[0]).toBe(nodes[0]);
    expect(result[2]).toBe(nodes[2]);
  });

  it('does not move a box the user is dragging', () => {
    const dragged = [box('a', 1, { dragging: true })];

    expect(moveMetaModelBoxes(dragged, new Map([[1, { x: 9, y: 9 }]]))).toBe(dragged);
  });

  it('returns the same array if every box is already there', () => {
    expect(moveMetaModelBoxes(nodes, new Map([[1, { x: 100, y: 0 }]]))).toBe(nodes);
  });
});

describe('upsertReactionEdge', () => {
  const createEdge = (source: Node, target: Node, data: Record<string, unknown>): Edge => ({
    id: `new-${source.id}-${target.id}`,
    source: source.id,
    target: target.id,
    type: 'reactions',
    data,
  });

  it('adds the edge of a relation that is new, with its reaction file', () => {
    const result = upsertReactionEdge(nodes, [], { sourceId: 1, targetId: 2, reactionFileId: 30 }, createEdge);

    expect(result).toEqual([{ id: 'new-ecore-1001-ecore-1002', source: 'ecore-1001', target: 'ecore-1002', type: 'reactions', data: { reactionFileId: 30 } }]);
  });

  it('changes the reaction file of the edge the pair has, keeping the edge and the rest of its data', () => {
    const edge: Edge = { ...reactionEdge('e12', 'ecore-1001', 'ecore-1002', 30), data: { reactionFileId: 30, code: 'keep', backendRelationId: 7 } };

    const result = upsertReactionEdge(nodes, [edge], { sourceId: 1, targetId: 2, reactionFileId: 31 }, createEdge);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e12');
    expect(result[0].data).toEqual({ reactionFileId: 31, code: 'keep', backendRelationId: 7 });
  });

  it('returns the same array if the edge is as it should be', () => {
    const edges = [reactionEdge('e12', 'ecore-1001', 'ecore-1002', 30)];

    expect(upsertReactionEdge(nodes, edges, { sourceId: 1, targetId: 2, reactionFileId: 30 }, createEdge)).toBe(edges);
  });

  it('keeps the two directions of a pair apart', () => {
    const edges = [reactionEdge('e21', 'ecore-1002', 'ecore-1001', 30)];

    const result = upsertReactionEdge(nodes, edges, { sourceId: 1, targetId: 2, reactionFileId: 31 }, createEdge);

    expect(result.map((e) => e.id)).toEqual(['e21', 'new-ecore-1001-ecore-1002']);
  });

  it('adds nothing for a metamodel that is not on the canvas yet', () => {
    const edges: Edge[] = [];

    expect(upsertReactionEdge(nodes, edges, { sourceId: 1, targetId: 9, reactionFileId: 30 }, createEdge)).toBe(edges);
  });

  it('does not touch the fine-granular edges of the pair', () => {
    const fine: Edge = { id: 'fine', source: 'ecore-1001', target: 'ecore-1002', type: 'fine-granular-reaction', data: { reactionFileId: 99 } };

    const result = upsertReactionEdge(nodes, [fine], { sourceId: 1, targetId: 2, reactionFileId: 30 }, createEdge);

    expect(result[0]).toBe(fine);
    expect(result).toHaveLength(2);
  });
});

describe('removeReactionEdge', () => {
  it('removes the reaction edge of the pair, and only that direction', () => {
    const edges = [reactionEdge('e12', 'ecore-1001', 'ecore-1002'), reactionEdge('e21', 'ecore-1002', 'ecore-1001'), reactionEdge('e23', 'ecore-1002', 'ecore-1003')];

    expect(removeReactionEdge(nodes, edges, 1, 2).map((e) => e.id)).toEqual(['e21', 'e23']);
  });

  it('returns the same array if there is no such edge', () => {
    const edges = [reactionEdge('e23', 'ecore-1002', 'ecore-1003')];

    expect(removeReactionEdge(nodes, edges, 1, 2)).toBe(edges);
  });
});

describe('the relations of the Low Code store', () => {
  const stored = (sourceId: number, targetId: number, extra: Partial<EditableVsumMetaModelRelation> = {}): EditableVsumMetaModelRelation => ({
    id: 7,
    sourceId,
    targetId,
    reactionFileId: 30,
    reactionFileStorageId: 30,
    fineGranularMetaModelRelationSet: [],
    ...extra,
  });
  const LOW_CODE = { id: 5, sourceId: 'a', targetId: 'b', reactionFileStorageId: 60, lowCodeReactionRequestBase: { name: 'x' } };

  it('take the reaction file and mappings of a relation that changed, keeping its ID', () => {
    const result = applyRelationToStore([stored(1, 2)], { sourceId: 1, targetId: 2, reactionFileId: 31, fineGranular: [LOW_CODE] });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 7, reactionFileId: 31, reactionFileStorageId: 31 });
    expect(result[0].fineGranularMetaModelRelationSet).toEqual([LOW_CODE]);
  });

  it('get a relation that is new', () => {
    const result = applyRelationToStore([stored(1, 2)], { sourceId: 2, targetId: 3, reactionFileId: null, fineGranular: [] });

    expect(result.map((r) => [r.sourceId, r.targetId, r.reactionFileId])).toEqual([[1, 2, 30], [2, 3, null]]);
  });

  it('leave out mappings that cannot be read, as when they are loaded from the backend', () => {
    const result = applyRelationToStore([], { sourceId: 1, targetId: 2, reactionFileId: 30, fineGranular: [{ nonsense: true }, LOW_CODE] });

    expect(result[0].fineGranularMetaModelRelationSet).toEqual([LOW_CODE]);
  });

  it('return the same list if the relation is as it was', () => {
    const relations = [stored(1, 2, { fineGranularMetaModelRelationSet: [LOW_CODE] })];

    expect(applyRelationToStore(relations, { sourceId: 1, targetId: 2, reactionFileId: 30, fineGranular: [LOW_CODE] })).toBe(relations);
  });

  it('lose a relation that was deleted', () => {
    expect(removeRelationFromStore([stored(1, 2), stored(2, 3)], 1, 2).map((r) => r.targetId)).toEqual([3]);
    const relations = [stored(2, 3)];
    expect(removeRelationFromStore(relations, 1, 2)).toBe(relations);
  });
});
