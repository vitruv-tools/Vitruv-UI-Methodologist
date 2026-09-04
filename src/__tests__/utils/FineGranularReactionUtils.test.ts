import { Edge, Node } from 'reactflow';
import {
  createExistingFineGranularReactionEdge,
  createFineGranularReactionEdge,
  ghostPositionChanges,
  hydrateFineGranularReactionEdges,
  isFineGranularReactionEdge,
  isFineReactionGraphVisible,
  mergeFineGranularEdges,
  resolveFineGranularEndpointNodeId,
  syncFineGranularStoreFromCanvas,
  confirmDeleteFineGranularReaction,
} from '../../utils/FineGranularReactionUtils';
import { createVsumDetailsStore, deleteVsumDetailsStore, VsumDetailsHelper } from '../../store/VsumDetails';
import { useProjectStore } from '../../store/Project';

const eobject = (
  id: string,
  model: string,
  eObjectId: string,
  eAttributeIds: string[] = [],
): Node =>
  ({
    id,
    type: 'eobject',
    position: { x: 0, y: 0 },
    data: { ecore: { model, eObjectId, eAttributeIds } },
  }) as Node;

describe('resolveFineGranularEndpointNodeId', () => {
  const nodes = [
    eobject('n1', 'http://families', 'http://families#Member', [
      'http://families#Member.lastName',
    ]),
    eobject('n2', 'http://persons', 'http://persons#Person'),
  ];

  it('matches a class-level EObject id', () => {
    expect(resolveFineGranularEndpointNodeId(nodes, 'http://families#Member', 'http://families'))
      .toBe('n1');
  });

  it('matches an attribute id on the parent class node', () => {
    expect(
      resolveFineGranularEndpointNodeId(
        nodes,
        'http://families#Member.lastName',
        'http://families',
      ),
    ).toBe('n1');
  });

  it('matches a class-level EObject id even when the model hint is a file name', () => {
    expect(
      resolveFineGranularEndpointNodeId(nodes, 'http://families#Member', 'families.ecore'),
    ).toBe('n1');
  });

  it('returns null when no node owns the id', () => {
    expect(resolveFineGranularEndpointNodeId(nodes, 'http://other#X', 'http://families'))
      .toBeNull();
  });

  it('prefers an EReference ghost over the parent class node', () => {
    const withGhost: Node[] = [
      ...nodes,
      {
        id: 'ghost-http://families#Member.family',
        type: 'ghost',
        position: { x: 0, y: 0 },
        data: {
          ecore: {
            model: 'http://families',
            eObjectId: 'http://families#Member.family',
          },
        },
      } as Node,
    ];
    expect(
      resolveFineGranularEndpointNodeId(
        withGhost,
        'http://families#Member.family',
        'http://families',
      ),
    ).toBe('ghost-http://families#Member.family');
  });
});

describe('createExistingFineGranularReactionEdge', () => {
  it('sets reaction source and target handles from the EObject ids', () => {
    const edge = createExistingFineGranularReactionEdge(
      { id: 1, sourceId: 'http://a#A', targetId: 'http://b#B.x' },
      'http://a',
      'http://b',
      'node-a',
      'node-b',
    );
    expect(edge.sourceHandle).toBe('reaction-source-http://a#A');
    expect(edge.targetHandle).toBe('reaction-target-http://b#B.x');
  });

  it('embeds the persisted FG id and generated file id on the edge', () => {
    const edge = createExistingFineGranularReactionEdge(
      {
        id: 42,
        sourceId: 'http://a#A',
        targetId: 'http://b#B',
        reactionFileStorageId: 88,
      },
      'http://a',
      'http://b',
      'node-a',
      'node-b',
    );
    expect(edge.data?.fineRelationId).toBe(42);
    expect(edge.data?.reactionFileId).toBe(88);
  });
});

describe('mergeFineGranularEdges', () => {
  it('skips pairs that are already present', () => {
    const existing = [
      createExistingFineGranularReactionEdge(
        { id: 1, sourceId: 'a', targetId: 'b' },
        'm1',
        'm2',
        'n1',
        'n2',
      ),
    ];
    const incoming = [
      createExistingFineGranularReactionEdge(
        { id: 1, sourceId: 'a', targetId: 'b' },
        'm1',
        'm2',
        'n1',
        'n2',
      ),
      createExistingFineGranularReactionEdge(
        { id: 2, sourceId: 'c', targetId: 'd' },
        'm1',
        'm2',
        'n3',
        'n4',
      ),
    ];
    const merged = mergeFineGranularEdges(existing, incoming);
    expect(merged).toHaveLength(2);
    expect(merged[1].data?.ecore?.eObjectSourceId).toBe('c');
  });
});

describe('createFineGranularReactionEdge', () => {
  it('builds a fine-granular canvas edge from handle ids', () => {
    const edge = createFineGranularReactionEdge({
      sourceNodeId: 'n1',
      targetNodeId: 'n2',
      sourceHandleId: 'reaction-source-http://a#A',
      targetHandleId: 'reaction-target-http://b#B',
      eObjectSourceId: 'http://a#A',
      eObjectTargetId: 'http://b#B',
      fromModel: 'http://a',
      toModel: 'http://b',
    });
    expect(isFineGranularReactionEdge(edge)).toBe(true);
    expect(edge.data?.ecore).toMatchObject({
      eObjectSourceId: 'http://a#A',
      eObjectTargetId: 'http://b#B',
      fromModel: 'http://a',
      toModel: 'http://b',
    });
  });
});

describe('hydrateFineGranularReactionEdges', () => {
  afterEach(() => {
    deleteVsumDetailsStore(1);
    useProjectStore.getState().setActiveId(null);
  });

  it('recreates canvas edges from store rows onto expanded EObject nodes', () => {
    useProjectStore.getState().setActiveId(1);
    createVsumDetailsStore(1, { metaModels: [], metaModelsRelation: [] });
    const helper = new VsumDetailsHelper(1);
    helper.setIdentifiersToBackendMetaModelId(
      new Map([
        ['http://families', 10],
        ['http://persons', 20],
      ]),
    );
    helper.addFineGranularMetaModelRelation(10, 20, {
      id: 42,
      sourceId: 'http://families#Member',
      targetId: 'http://persons#Person',
      reactionFileStorageId: 88,
    });
    helper.saveToStore();

    const nodes = [
      eobject('n1', 'http://families', 'http://families#Member'),
      eobject('n2', 'http://persons', 'http://persons#Person'),
    ];
    const ecoreFiles: Node[] = [
      {
        id: 'f1',
        type: 'ecoreFile',
        position: { x: 0, y: 0 },
        data: { metaModelSourceId: 10, nsUri: 'http://families' },
      } as Node,
      {
        id: 'f2',
        type: 'ecoreFile',
        position: { x: 0, y: 0 },
        data: { metaModelSourceId: 20, nsUri: 'http://persons' },
      } as Node,
    ];

    const edges = hydrateFineGranularReactionEdges(nodes, ecoreFiles);
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe('n1');
    expect(edges[0].target).toBe('n2');
    expect(edges[0].data?.fineRelationId).toBe(42);
    expect(edges[0].data?.reactionFileId).toBe(88);
  });
});

describe('isFineReactionGraphVisible', () => {
  it('is false for collapsed VSUM cards', () => {
    const nodes: Node[] = [
      { id: 'a', type: 'ecoreFile', position: { x: 0, y: 0 }, data: {} } as Node,
    ];
    expect(isFineReactionGraphVisible(nodes, [])).toBe(false);
  });

  it('is true when EObject nodes or fine edges are present', () => {
    expect(isFineReactionGraphVisible(
      [eobject('n1', 'http://a', 'http://a#A')],
      [],
    )).toBe(true);
    expect(isFineReactionGraphVisible(
      [],
      [{ id: 'f', type: 'fine-granular-reaction', source: 'a', target: 'b' } as Edge],
    )).toBe(true);
  });
});

describe('syncFineGranularStoreFromCanvas', () => {
  afterEach(() => {
    deleteVsumDetailsStore(1);
    useProjectStore.getState().setActiveId(null);
  });

  const seedStoreWithFine = () => {
    useProjectStore.getState().setActiveId(1);
    createVsumDetailsStore(1, { metaModels: [], metaModelsRelation: [] });
    const helper = new VsumDetailsHelper(1);
    helper.setIdentifiersToBackendMetaModelId(
      new Map([
        ['http://families', 10],
        ['http://persons', 20],
      ]),
    );
    helper.addFineGranularMetaModelRelation(10, 20, {
      id: null,
      sourceId: 'http://families#Member',
      targetId: 'http://persons#Person',
    });
    helper.saveToStore();
    return helper;
  };

  it('removes an undone fine and its placeholder coarse relation', () => {
    seedStoreWithFine();
    const nodes = [
      eobject('n1', 'http://families', 'http://families#Member'),
      eobject('n2', 'http://persons', 'http://persons#Person'),
    ];

    syncFineGranularStoreFromCanvas(nodes, []);

    const persisted = new VsumDetailsHelper(1);
    expect(persisted.getAllFineGranularMetaModelRelations()).toHaveLength(0);
    expect(persisted.get().metaModelsRelation).toHaveLength(0);
  });

  it('re-adds a canvas fine that is missing from the store (redo)', () => {
    useProjectStore.getState().setActiveId(1);
    createVsumDetailsStore(1, { metaModels: [], metaModelsRelation: [] });
    const helper = new VsumDetailsHelper(1);
    helper.setIdentifiersToBackendMetaModelId(
      new Map([
        ['http://families', 10],
        ['http://persons', 20],
      ]),
    );
    helper.saveToStore();

    const nodes = [
      eobject('n1', 'http://families', 'http://families#Member'),
      eobject('n2', 'http://persons', 'http://persons#Person'),
    ];
    const edges: Edge[] = [
      {
        id: 'f',
        type: 'fine-granular-reaction',
        source: 'n1',
        target: 'n2',
        data: {
          ecore: {
            eObjectSourceId: 'http://families#Member',
            eObjectTargetId: 'http://persons#Person',
            fromModel: 'http://families',
            toModel: 'http://persons',
          },
        },
      } as Edge,
    ];

    syncFineGranularStoreFromCanvas(nodes, edges);

    const persisted = new VsumDetailsHelper(1);
    expect(
      persisted.getFineGranularMetaModelRelation(
        10,
        20,
        'http://families#Member',
        'http://persons#Person',
      ),
    ).toMatchObject({
      sourceId: 'http://families#Member',
      targetId: 'http://persons#Person',
    });
  });

  it('does not wipe store fines when the canvas is collapsed', () => {
    seedStoreWithFine();
    const nodes: Node[] = [
      { id: 'a', type: 'ecoreFile', position: { x: 0, y: 0 }, data: {} } as Node,
    ];

    syncFineGranularStoreFromCanvas(nodes, []);

    expect(new VsumDetailsHelper(1).getAllFineGranularMetaModelRelations()).toHaveLength(1);
  });
});

describe('confirmDeleteFineGranularReaction', () => {
  afterEach(() => {
    deleteVsumDetailsStore(1);
    useProjectStore.getState().setActiveId(null);
  });

  const fineEdge: Edge = {
    id: 'f',
    type: 'fine-granular-reaction',
    source: 'n1',
    target: 'n2',
    data: {
      ecore: {
        eObjectSourceId: 'http://families#Member',
        eObjectTargetId: 'http://persons#Person',
        fromModel: 'http://families',
        toModel: 'http://persons',
      },
    },
  };

  const seedLastFine = () => {
    useProjectStore.getState().setActiveId(1);
    createVsumDetailsStore(1, { metaModels: [], metaModelsRelation: [] });
    const helper = new VsumDetailsHelper(1);
    helper.setIdentifiersToBackendMetaModelId(
      new Map([
        ['http://families', 10],
        ['http://persons', 20],
      ]),
    );
    helper.addFineGranularMetaModelRelation(10, 20, {
      id: null,
      sourceId: 'http://families#Member',
      targetId: 'http://persons#Person',
    });
    helper.saveToStore();
  };

  it('returns false when nothing is selected', () => {
    expect(confirmDeleteFineGranularReaction(null, [], jest.fn())).toBe(false);
  });

  it('removes the fine edge and an empty parent coarse reaction', () => {
    seedLastFine();
    const removed: string[] = [];
    const coarse: Edge = {
      id: 'c',
      type: 'reactions',
      source: 'a',
      target: 'b',
      data: { sourceId: 10, targetId: 20 },
    };

    expect(confirmDeleteFineGranularReaction(fineEdge, [fineEdge, coarse], (id) => {
      removed.push(id);
    })).toBe(true);

    expect(removed).toEqual(['f', 'c']);
    expect(new VsumDetailsHelper(1).get().metaModelsRelation).toHaveLength(0);
  });

  it('keeps a coarse relation that still has a reaction file', () => {
    seedLastFine();
    const helper = new VsumDetailsHelper(1);
    const coarse = helper.getMetaModelRelation({ sourceId: 10, targetId: 20 });
    if (coarse) coarse.reactionFileStorageId = 99;
    helper.saveToStore();
    const removed: string[] = [];

    confirmDeleteFineGranularReaction(
      fineEdge,
      [fineEdge, { id: 'c', type: 'reactions', source: 'a', target: 'b', data: { sourceId: 10, targetId: 20 } } as Edge],
      (id) => removed.push(id),
    );

    expect(removed).toEqual(['f']);
    expect(new VsumDetailsHelper(1).getMetaModelRelation({ sourceId: 10, targetId: 20 }))
      .toMatchObject({ reactionFileStorageId: 99 });
  });
});

describe('ghostPositionChanges', () => {
  const source: Node = {
    id: 'cls-a',
    type: 'eobject',
    position: { x: 0, y: 0 },
    data: { attributes: [] },
  };
  const target: Node = {
    id: 'cls-b',
    type: 'eobject',
    position: { x: 200, y: 0 },
    data: { attributes: [] },
  };
  const ghost: Node = {
    id: 'ghost-http://m#A.ref',
    type: 'ghost',
    position: { x: 0, y: 0 },
    data: { ecore: { eObjectId: 'http://m#A.ref' } },
  };
  const umlEdge: Edge = {
    id: 'uml-1',
    type: 'uml',
    source: 'cls-a',
    target: 'cls-b',
    sourceHandle: 'right-source',
    targetHandle: 'left-target',
    data: {
      expandedIntraModel: true,
      ecore: { eReferenceId: 'http://m#A.ref' },
    },
  };

  it('moves the ghost onto the UML handle-to-handle midpoint', () => {
    const changes = ghostPositionChanges([source, target, ghost], [umlEdge]);
    expect(changes).toHaveLength(1);
    expect(changes[0].id).toBe('ghost-http://m#A.ref');
    // right of A (x=200) and left of B (x=200), on the full-box chord (height 36)
    expect(changes[0].position.x).toBe(194);
    expect(changes[0].position.y).toBe(12);
  });

  it('returns nothing when the ghost is already on the midpoint', () => {
    const placed: Node = { ...ghost, position: { x: 194, y: 12 } };
    expect(ghostPositionChanges([source, target, placed], [umlEdge])).toEqual([]);
  });

  it('follows the full class box, not the header row, when a class has attributes', () => {
    const tall: Node = {
      ...source,
      data: { attributes: [{ name: 'a' }, { name: 'b' }] },
    };
    const changes = ghostPositionChanges([tall, target, ghost], [umlEdge]);
    expect(changes[0].position.y).toBeGreaterThan(12);
  });
});
