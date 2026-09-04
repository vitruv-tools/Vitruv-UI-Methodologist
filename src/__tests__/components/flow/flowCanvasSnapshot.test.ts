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

  it('defaults a missing reaction file id to null', () => {
    const edges = [reaction('e', 'a', 'b')];

    expect(buildWorkspaceSnapshot(nodes, edges).metaModelRelationRequests[0].reactionFileId).toBeNull();
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

  it('attaches fine-granular edges to the parent coarse relation by backend ids', () => {
    const withNs = [
      ecore('a', { metaModelSourceId: 1, nsUri: 'http://families' }),
      ecore('b', { metaModelSourceId: 2, nsUri: 'http://persons' }),
    ];
    const edges: Edge[] = [
      reaction('e', 'a', 'b', { reactionFileId: 7 }),
      {
        id: 'f',
        source: 'eobj-a',
        target: 'eobj-b',
        type: 'fine-granular-reaction',
        data: {
          ecore: {
            eObjectSourceId: 'http://families#Member',
            eObjectTargetId: 'http://persons#Person',
            fromModel: 'http://families',
            toModel: 'http://persons',
          },
          reactionFileId: 7,
        },
      } as Edge,
    ];

    expect(buildWorkspaceSnapshot(withNs, edges).metaModelRelationRequests).toEqual([
      {
        sourceId: 1,
        targetId: 2,
        reactionFileId: 7,
        fineGranularMetaModelRelationSet: [
          {
            id: null,
            sourceId: 'http://families#Member',
            targetId: 'http://persons#Person',
            reactionFileStorageId: 7,
          },
        ],
      },
    ]);
  });

  it('emits a coarse request for fine-only pairs that have no reactions edge', () => {
    const withNs = [
      ecore('a', { metaModelSourceId: 1, nsUri: 'http://families' }),
      ecore('b', { metaModelSourceId: 2, nsUri: 'http://persons' }),
    ];
    const edges: Edge[] = [
      {
        id: 'f',
        source: 'eobj-a',
        target: 'eobj-b',
        type: 'fine-granular-reaction',
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

    expect(buildWorkspaceSnapshot(withNs, edges).metaModelRelationRequests).toEqual([
      {
        sourceId: 1,
        targetId: 2,
        reactionFileId: null,
        fineGranularMetaModelRelationSet: [
          {
            id: null,
            sourceId: 'http://families#Member',
            targetId: 'http://persons#Person',
          },
        ],
      },
    ]);
  });

  it('sends persisted FG id and generated file id from the fine edge without copying the file onto the parent', () => {
    const withNs = [
      ecore('a', { metaModelSourceId: 1, nsUri: 'http://families' }),
      ecore('b', { metaModelSourceId: 2, nsUri: 'http://persons' }),
    ];
    const edges: Edge[] = [
      {
        id: 'f',
        source: 'eobj-a',
        target: 'eobj-b',
        type: 'fine-granular-reaction',
        data: {
          ecore: {
            eObjectSourceId: 'http://families#Member',
            eObjectTargetId: 'http://persons#Person',
            fromModel: 'http://families',
            toModel: 'http://persons',
          },
          fineRelationId: 42,
          reactionFileId: 88,
        },
      } as Edge,
    ];

    expect(buildWorkspaceSnapshot(withNs, edges).metaModelRelationRequests).toEqual([
      {
        sourceId: 1,
        targetId: 2,
        reactionFileId: null,
        fineGranularMetaModelRelationSet: [
          {
            id: 42,
            sourceId: 'http://families#Member',
            targetId: 'http://persons#Person',
            reactionFileStorageId: 88,
          },
        ],
      },
    ]);
  });

  it('keeps store FG id and file id when the canvas edge has none', () => {
    const withNs = [
      ecore('a', { metaModelSourceId: 1, nsUri: 'http://families' }),
      ecore('b', { metaModelSourceId: 2, nsUri: 'http://persons' }),
    ];
    const edges = [reaction('e', 'a', 'b', { reactionFileId: 7 })];
    const storeSnapshot = {
      metaModelIds: [1, 2],
      metaModelRelationRequests: [
        {
          sourceId: 1,
          targetId: 2,
          reactionFileId: 7,
          fineGranularMetaModelRelationSet: [
            {
              id: 9,
              sourceId: 'http://families#Member',
              targetId: 'http://persons#Person',
              reactionFileStorageId: 7,
              lowCodeReactionRequestBase: { routine: 'sync' },
            },
          ],
        },
      ],
    };

    expect(buildWorkspaceSnapshot(withNs, edges, storeSnapshot).metaModelRelationRequests).toEqual([
      {
        sourceId: 1,
        targetId: 2,
        reactionFileId: 7,
        fineGranularMetaModelRelationSet: [
          {
            id: 9,
            sourceId: 'http://families#Member',
            targetId: 'http://persons#Person',
            reactionFileStorageId: 7,
            lowCodeReactionRequestBase: { routine: 'sync' },
          },
        ],
      },
    ]);
  });

  it('does not let a canvas id of null replace store-persisted FG and file ids', () => {
    const withNs = [
      ecore('a', { metaModelSourceId: 1, nsUri: 'http://families' }),
      ecore('b', { metaModelSourceId: 2, nsUri: 'http://persons' }),
    ];
    const edges: Edge[] = [
      {
        id: 'f',
        source: 'eobj-a',
        target: 'eobj-b',
        type: 'fine-granular-reaction',
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
    const storeSnapshot = {
      metaModelIds: [1, 2],
      metaModelRelationRequests: [
        {
          sourceId: 1,
          targetId: 2,
          reactionFileId: null,
          fineGranularMetaModelRelationSet: [
            {
              id: 42,
              sourceId: 'http://families#Member',
              targetId: 'http://persons#Person',
              reactionFileStorageId: 88,
              lowCodeReactionRequestBase: { reactionName: 'updated_name' },
            },
          ],
        },
      ],
    };

    expect(buildWorkspaceSnapshot(withNs, edges, storeSnapshot).metaModelRelationRequests).toEqual([
      {
        sourceId: 1,
        targetId: 2,
        reactionFileId: null,
        fineGranularMetaModelRelationSet: [
          {
            id: 42,
            sourceId: 'http://families#Member',
            targetId: 'http://persons#Person',
            reactionFileStorageId: 88,
            lowCodeReactionRequestBase: { reactionName: 'updated_name' },
          },
        ],
      },
    ]);
  });

  it('does not re-inject store fines after they were undone on the expanded canvas', () => {
    const withNs = [
      ecore('a', { metaModelSourceId: 1, nsUri: 'http://families' }),
      ecore('b', { metaModelSourceId: 2, nsUri: 'http://persons' }),
      { id: 'eobj-a', type: 'eobject', position: { x: 0, y: 0 }, data: {} } as Node,
    ];
    const edges = [reaction('e', 'a', 'b', { reactionFileId: 7 })];
    const storeSnapshot = {
      metaModelIds: [1, 2],
      metaModelRelationRequests: [
        {
          sourceId: 1,
          targetId: 2,
          reactionFileId: 7,
          fineGranularMetaModelRelationSet: [
            {
              id: null,
              sourceId: 'http://families#Member',
              targetId: 'http://persons#Person',
            },
          ],
        },
      ],
    };

    expect(buildWorkspaceSnapshot(withNs, edges, storeSnapshot).metaModelRelationRequests).toEqual([
      { sourceId: 1, targetId: 2, reactionFileId: 7 },
    ]);
  });

  it('does not add a store-only relation when the expanded canvas has no matching edge', () => {
    const withNs = [
      ecore('a', { metaModelSourceId: 1, nsUri: 'http://families' }),
      ecore('b', { metaModelSourceId: 2, nsUri: 'http://persons' }),
      { id: 'eobj-a', type: 'eobject', position: { x: 0, y: 0 }, data: {} } as Node,
    ];
    const storeSnapshot = {
      metaModelIds: [1, 2],
      metaModelRelationRequests: [
        {
          sourceId: 1,
          targetId: 2,
          reactionFileId: null,
          fineGranularMetaModelRelationSet: [
            {
              id: null,
              sourceId: 'http://families#Member',
              targetId: 'http://persons#Person',
            },
          ],
        },
      ],
    };

    expect(buildWorkspaceSnapshot(withNs, [], storeSnapshot).metaModelRelationRequests).toEqual([]);
  });

  it('keeps store config on canvas fines and drops extra store pairs while expanded', () => {
    const withNs = [
      ecore('a', { metaModelSourceId: 1, nsUri: 'http://families' }),
      ecore('b', { metaModelSourceId: 2, nsUri: 'http://persons' }),
    ];
    const edges: Edge[] = [
      {
        id: 'f',
        source: 'eobj-a',
        target: 'eobj-b',
        type: 'fine-granular-reaction',
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
    const storeSnapshot = {
      metaModelIds: [1, 2],
      metaModelRelationRequests: [
        {
          sourceId: 1,
          targetId: 2,
          reactionFileId: null,
          fineGranularMetaModelRelationSet: [
            {
              id: 42,
              sourceId: 'http://families#Member',
              targetId: 'http://persons#Person',
              reactionFileStorageId: 88,
              lowCodeReactionRequestBase: { reactionName: 'kept' },
            },
            {
              id: null,
              sourceId: 'http://families#Member',
              targetId: 'http://persons#Other',
            },
          ],
        },
      ],
    };

    expect(buildWorkspaceSnapshot(withNs, edges, storeSnapshot).metaModelRelationRequests).toEqual([
      {
        sourceId: 1,
        targetId: 2,
        reactionFileId: null,
        fineGranularMetaModelRelationSet: [
          {
            id: 42,
            sourceId: 'http://families#Member',
            targetId: 'http://persons#Person',
            reactionFileStorageId: 88,
            lowCodeReactionRequestBase: { reactionName: 'kept' },
          },
        ],
      },
    ]);
  });
});
