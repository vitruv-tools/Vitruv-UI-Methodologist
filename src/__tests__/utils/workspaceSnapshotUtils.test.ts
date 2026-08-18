import {
  cloneWorkspaceSnapshot,
  emptyWorkspaceSnapshot,
  fineSetFromVsumRelation,
  mapRelationsForCanvasLoad,
  mapVsumDetailsToEditable,
  mergePersistedFineRelationIds,
  normalizeReactionFileId,
  parseFineGranularRelationSet,
  prepareSnapshotForSyncSave,
  toWireReactionFileId,
  workspaceSnapshotFromVsumDetails,
  workspaceSnapshotsEqual,
} from '../../utils/workspaceSnapshotUtils';
import { VsumDetails } from '../../types/vsum';

describe('normalizeReactionFileId', () => {
  it('returns positive numbers unchanged', () => {
    expect(normalizeReactionFileId(42)).toBe(42);
  });

  it('parses numeric strings', () => {
    expect(normalizeReactionFileId('7')).toBe(7);
  });

  it('returns 0 for invalid values', () => {
    expect(normalizeReactionFileId(0)).toBe(0);
    expect(normalizeReactionFileId(-1)).toBe(0);
    expect(normalizeReactionFileId('abc')).toBe(0);
    expect(normalizeReactionFileId(null)).toBe(0);
  });
});

describe('toWireReactionFileId', () => {
  it('keeps stored REACTION file ids', () => {
    expect(toWireReactionFileId(42)).toBe(42);
    expect(toWireReactionFileId('7')).toBe(7);
  });

  it('sends null when there is no uploaded reaction file', () => {
    expect(toWireReactionFileId(0)).toBeNull();
    expect(toWireReactionFileId(-1)).toBeNull();
    expect(toWireReactionFileId(null)).toBeNull();
    expect(toWireReactionFileId(undefined)).toBeNull();
  });
});

describe('workspaceSnapshotsEqual', () => {
  it('treats snapshots with same ids and relations as equal', () => {
    const a = {
      metaModelIds: [2, 1],
      metaModelRelationRequests: [{ sourceId: 1, targetId: 2, reactionFileId: 5 }],
    };
    const b = {
      metaModelIds: [1, 2],
      metaModelRelationRequests: [{ sourceId: 1, targetId: 2, reactionFileId: '5' }],
    };
    expect(workspaceSnapshotsEqual(a, b)).toBe(true);
  });

  it('returns false when relation sets differ', () => {
    const base = emptyWorkspaceSnapshot();
    expect(
      workspaceSnapshotsEqual(base, {
        ...base,
        metaModelRelationRequests: [{ sourceId: 1, targetId: 2, reactionFileId: 1 }],
      }),
    ).toBe(false);
  });

  it('returns false when Low Code fine-set data differs', () => {
    const withFine = (routine: string) => ({
      metaModelIds: [1, 2],
      metaModelRelationRequests: [
        {
          sourceId: 1,
          targetId: 2,
          reactionFileId: 5,
          fineGranularMetaModelRelationSet: [
            {
              id: 1,
              sourceId: 'http://a#A',
              targetId: 'http://b#B',
              lowCodeReactionRequestBase: { routine },
            },
          ],
        },
      ],
    });
    expect(workspaceSnapshotsEqual(withFine('sync'), withFine('sync'))).toBe(true);
    expect(workspaceSnapshotsEqual(withFine('sync'), withFine('create'))).toBe(false);
  });
});

describe('cloneWorkspaceSnapshot', () => {
  it('deep-clones ids and relations', () => {
    const original = {
      metaModelIds: [1],
      metaModelRelationRequests: [{ sourceId: 1, targetId: 2, reactionFileId: 3 }],
    };
    const cloned = cloneWorkspaceSnapshot(original);
    cloned.metaModelIds.push(99);
    cloned.metaModelRelationRequests[0].reactionFileId = 0;
    expect(original.metaModelIds).toEqual([1]);
    expect(original.metaModelRelationRequests[0].reactionFileId).toBe(3);
  });

  it('deep-clones Low Code form data on fine relations', () => {
    const original = {
      metaModelIds: [1, 2],
      metaModelRelationRequests: [
        {
          sourceId: 1,
          targetId: 2,
          reactionFileId: 3,
          fineGranularMetaModelRelationSet: [
            {
              id: 1,
              sourceId: 'a',
              targetId: 'b',
              lowCodeReactionRequestBase: { routine: 'sync' },
            },
          ],
        },
      ],
    };
    const cloned = cloneWorkspaceSnapshot(original);
    cloned.metaModelRelationRequests[0].fineGranularMetaModelRelationSet![0]
      .lowCodeReactionRequestBase!.routine = 'create';
    expect(
      original.metaModelRelationRequests[0].fineGranularMetaModelRelationSet![0]
        .lowCodeReactionRequestBase,
    ).toEqual({ routine: 'sync' });
  });
});

describe('workspaceSnapshotFromVsumDetails', () => {
  it('maps meta model source ids and normalized reaction files', () => {
    const details = {
      metaModels: [{ id: 10, sourceId: 100 }, { id: 11, sourceId: 200 }],
      metaModelsRelation: [
        { id: 1, sourceId: 100, targetId: 200, reactionFileId: '9' },
      ],
    } as VsumDetails;

    expect(workspaceSnapshotFromVsumDetails(details)).toEqual({
      metaModelIds: [100, 200],
      metaModelRelationRequests: [{ sourceId: 100, targetId: 200, reactionFileId: 9 }],
    });
  });

  it('includes fine-granular relations returned by VSUM details', () => {
    const details = {
      metaModels: [{ id: 10, sourceId: 100 }, { id: 11, sourceId: 200 }],
      metaModelsRelation: [
        {
          id: 1,
          sourceId: 100,
          targetId: 200,
          reactionFileId: 9,
          fineGranularMetaModelRelationSet: [
            {
              id: 4,
              sourceId: 'http://a#A',
              targetId: 'http://b#B',
              lowCodeReactionRequestBase: { routine: 'sync' },
            },
          ],
        },
      ],
    } as VsumDetails;

    expect(workspaceSnapshotFromVsumDetails(details).metaModelRelationRequests[0]).toEqual({
      sourceId: 100,
      targetId: 200,
      reactionFileId: 9,
      fineGranularMetaModelRelationSet: [
        {
          id: 4,
          sourceId: 'http://a#A',
          targetId: 'http://b#B',
          lowCodeReactionRequestBase: { routine: 'sync' },
        },
      ],
    });
  });
});

describe('mapRelationsForCanvasLoad', () => {
  it('normalizes reaction file ids for canvas load', () => {
    const mapped = mapRelationsForCanvasLoad([
      { id: 1, sourceId: 1, targetId: 2, reactionFileStorageId: '4' },
    ] as any);
    expect(mapped[0].reactionFileId).toBe(4);
  });

  it('loads a missing reaction file id as null rather than 0', () => {
    const mapped = mapRelationsForCanvasLoad([
      { id: 1, sourceId: 1, targetId: 2, reactionFileId: 0 },
    ] as any);
    expect(mapped[0].reactionFileId).toBeNull();
  });
});

describe('prepareSnapshotForSyncSave', () => {
  it('deduplicates meta model ids and drops relations outside the set', () => {
    const result = prepareSnapshotForSyncSave({
      metaModelIds: [1, 1, 2, 3],
      metaModelRelationRequests: [
        { sourceId: 1, targetId: 2, reactionFileId: 5 },
        { sourceId: 2, targetId: 99, reactionFileId: 1 },
      ],
    });
    expect(result.metaModelIds).toEqual([1, 2, 3]);
    expect(result.metaModelRelationRequests).toEqual([
      { sourceId: 1, targetId: 2, reactionFileId: 5 },
    ]);
  });

  it('returns null relations when none remain after filtering', () => {
    const result = prepareSnapshotForSyncSave({
      metaModelIds: [1],
      metaModelRelationRequests: [{ sourceId: 1, targetId: 2, reactionFileId: 1 }],
    });
    expect(result.metaModelRelationRequests).toBeNull();
  });

  it('sends reactionFileId null for template-only mappings', () => {
    const result = prepareSnapshotForSyncSave({
      metaModelIds: [19, 20],
      metaModelRelationRequests: [
        {
          sourceId: 19,
          targetId: 20,
          reactionFileId: 0,
          fineGranularMetaModelRelationSet: [
            { id: null, sourceId: 'http://a#A', targetId: 'http://b#B' },
          ],
        },
      ],
    });
    expect(result.metaModelRelationRequests).toEqual([
      {
        sourceId: 19,
        targetId: 20,
        reactionFileId: null,
        fineGranularMetaModelRelationSet: [
          { id: null, sourceId: 'http://a#A', targetId: 'http://b#B' },
        ],
      },
    ]);
  });

  it('puts the Jackson template discriminator on lowCodeReactionRequestBase.name', () => {
    const result = prepareSnapshotForSyncSave({
      metaModelIds: [19, 20],
      metaModelRelationRequests: [
        {
          sourceId: 19,
          targetId: 20,
          reactionFileId: null,
          fineGranularMetaModelRelationSet: [
            {
              id: null,
              sourceId: 'http://a#A',
              targetId: 'http://b#B',
              lowCodeReactionRequestBase: {
                _reactionTemplate: 'create_corresponding_root_on_insert_root',
                name: 'Create Corresponding Root',
                regenerate: true,
                model1Uri: 'http://families',
                model2Uri: 'http://persons',
              },
            },
          ],
        },
      ],
    });
    expect(
      result.metaModelRelationRequests?.[0].fineGranularMetaModelRelationSet?.[0]
        .lowCodeReactionRequestBase,
    ).toEqual({
      name: 'create_corresponding_root_on_insert_root',
      regenerate: true,
      model1Uri: 'http://families',
      model2Uri: 'http://persons',
    });
  });

  it('forwards fine-granular relation sets on save', () => {
    const fine = [
      {
        id: 1,
        sourceId: 'http://a#A',
        targetId: 'http://b#B',
        lowCodeReactionRequestBase: { routine: 'sync' },
      },
    ];
    const result = prepareSnapshotForSyncSave({
      metaModelIds: [1, 2],
      metaModelRelationRequests: [
        {
          sourceId: 1,
          targetId: 2,
          reactionFileId: 5,
          fineGranularMetaModelRelationSet: fine,
        },
      ],
    });
    expect(result.metaModelRelationRequests).toEqual([
      {
        sourceId: 1,
        targetId: 2,
        reactionFileId: 5,
        fineGranularMetaModelRelationSet: [
          {
            id: 1,
            sourceId: 'http://a#A',
            targetId: 'http://b#B',
            lowCodeReactionRequestBase: { routine: 'sync', regenerate: true },
          },
        ],
      },
    ]);
    result.metaModelRelationRequests![0].fineGranularMetaModelRelationSet![0]
      .lowCodeReactionRequestBase!.routine = 'mutated';
    expect(fine[0].lowCodeReactionRequestBase).toEqual({ routine: 'sync' });
  });

  it('omits zero reactionFileStorageId from the wire fine set', () => {
    const result = prepareSnapshotForSyncSave({
      metaModelIds: [1, 2],
      metaModelRelationRequests: [
        {
          sourceId: 1,
          targetId: 2,
          reactionFileId: 0,
          fineGranularMetaModelRelationSet: [
            {
              id: null,
              sourceId: 'http://a#A',
              targetId: 'http://b#B',
              reactionFileStorageId: 0,
            },
          ],
        },
      ],
    });
    expect(result.metaModelRelationRequests?.[0].reactionFileId).toBeNull();
    expect(result.metaModelRelationRequests?.[0].fineGranularMetaModelRelationSet).toEqual([
      { id: null, sourceId: 'http://a#A', targetId: 'http://b#B' },
    ]);
  });

  it('sends persisted FG id, reactionFileStorageId, and regenerate: true on update', () => {
    const result = prepareSnapshotForSyncSave({
      metaModelIds: [19, 20],
      metaModelRelationRequests: [
        {
          sourceId: 19,
          targetId: 20,
          reactionFileId: null,
          fineGranularMetaModelRelationSet: [
            {
              id: 42,
              sourceId: 'Component',
              targetId: 'Class',
              reactionFileStorageId: 88,
              lowCodeReactionRequestBase: {
                _reactionTemplate: 'create_corresponding_root_on_insert_root',
                name: 'Create Corresponding Root',
                model1Uri: 'http://families',
                reactionName: 'updated_name',
              },
            },
          ],
        },
      ],
    });
    expect(result.metaModelRelationRequests?.[0].fineGranularMetaModelRelationSet).toEqual([
      {
        id: 42,
        sourceId: 'Component',
        targetId: 'Class',
        reactionFileStorageId: 88,
        lowCodeReactionRequestBase: {
          name: 'create_corresponding_root_on_insert_root',
          regenerate: true,
          model1Uri: 'http://families',
          reactionName: 'updated_name',
        },
      },
    ]);
  });

  it('does not force regenerate on first create (no FG id, no file id)', () => {
    const result = prepareSnapshotForSyncSave({
      metaModelIds: [1, 2],
      metaModelRelationRequests: [
        {
          sourceId: 1,
          targetId: 2,
          reactionFileId: null,
          fineGranularMetaModelRelationSet: [
            {
              id: null,
              sourceId: 'http://a#A',
              targetId: 'http://b#B',
              lowCodeReactionRequestBase: {
                name: 'create_corresponding_root_on_insert_root',
                reactionName: 'first_save',
              },
            },
          ],
        },
      ],
    });
    expect(
      result.metaModelRelationRequests?.[0].fineGranularMetaModelRelationSet?.[0]
        .lowCodeReactionRequestBase,
    ).toEqual({
      name: 'create_corresponding_root_on_insert_root',
      reactionName: 'first_save',
    });
  });
});

describe('parseFineGranularRelationSet', () => {
  it('accepts backend field aliases', () => {
    expect(
      parseFineGranularRelationSet([
        {
          id: 3,
          eObjectSourceId: 'http://a#A',
          eObjectTargetId: 'http://b#B',
          reactionFileId: 8,
          lowCodeReaction: { routine: 'sync' },
        },
      ]),
    ).toEqual([
      {
        id: 3,
        sourceId: 'http://a#A',
        targetId: 'http://b#B',
        reactionFileStorageId: 8,
        lowCodeReactionRequestBase: { routine: 'sync' },
      },
    ]);
  });

  it('reads nested uri fields', () => {
    expect(
      parseFineGranularRelationSet([
        {
          source: { uri: 'http://a#A' },
          target: { uri: 'http://b#B' },
          id: 1,
        },
      ]),
    ).toEqual([{ id: 1, sourceId: 'http://a#A', targetId: 'http://b#B' }]);
  });

  it('reads fileStorageId as the generated reaction file id', () => {
    expect(
      parseFineGranularRelationSet([
        {
          fineGranularMetaModelRelationId: 42,
          sourceId: 'http://a#A',
          targetId: 'http://b#B',
          fileStorageId: 88,
        },
      ]),
    ).toEqual([
      {
        id: 42,
        sourceId: 'http://a#A',
        targetId: 'http://b#B',
        reactionFileStorageId: 88,
      },
    ]);
  });
});

describe('fineSetFromVsumRelation', () => {
  it('reads the relations alias used by some GET payloads', () => {
    expect(
      fineSetFromVsumRelation({
        id: 1,
        sourceId: 10,
        targetId: 20,
        fineGranularMetaModelRelations: [
          { sourceId: 'a', targetId: 'b', id: 2 },
        ],
      }),
    ).toEqual([{ id: 2, sourceId: 'a', targetId: 'b' }]);
  });
});

describe('mapVsumDetailsToEditable', () => {
  it('seeds the editable store with parsed fine relations', () => {
    const details = {
      metaModels: [{ id: 10, sourceId: 100, name: 'A', description: '', domain: '', keyword: [], createdAt: '', updatedAt: '', ecoreFileId: 1, genModelFileId: 2 }],
      metaModelsRelation: [
        {
          id: 1,
          sourceId: 100,
          targetId: 200,
          reactionFileId: 9,
          fineGranularMetaModelRelationSet: [
            { id: 4, sourceId: 'a', targetId: 'b' },
          ],
        },
      ],
    } as VsumDetails;

    expect(mapVsumDetailsToEditable(details).metaModelsRelation[0].fineGranularMetaModelRelationSet).toEqual([
      { id: 4, sourceId: 'a', targetId: 'b' },
    ]);
  });

  it('reads the metaModelRelations alias used by some GET payloads', () => {
    const details = {
      metaModels: [],
      metaModelRelations: [
        {
          id: 1,
          sourceId: 19,
          targetId: 20,
          fineGranularMetaModelRelationSet: [
            { id: 4, sourceId: 'http://a#A', targetId: 'http://b#B' },
          ],
        },
      ],
    } as unknown as VsumDetails;

    expect(mapVsumDetailsToEditable(details).metaModelsRelation[0].fineGranularMetaModelRelationSet).toEqual([
      { id: 4, sourceId: 'http://a#A', targetId: 'http://b#B' },
    ]);
  });
});

describe('mergePersistedFineRelationIds', () => {
  it('copies GET-assigned FG id and generated file id onto local create rows', () => {
    const local = [
      {
        id: 0,
        sourceId: 19,
        targetId: 20,
        reactionFileId: null,
        reactionFileStorageId: null,
        fineGranularMetaModelRelationSet: [
          {
            id: null,
            sourceId: 'Component',
            targetId: 'Class',
            lowCodeReactionRequestBase: { reactionName: 'updated_name' },
          },
        ],
      },
    ];
    const remote = [
      {
        id: 5,
        sourceId: 19,
        targetId: 20,
        reactionFileId: null,
        reactionFileStorageId: null,
        fineGranularMetaModelRelationSet: [
          {
            id: 42,
            sourceId: 'Component',
            targetId: 'Class',
            reactionFileStorageId: 88,
          },
        ],
      },
    ];

    expect(mergePersistedFineRelationIds(local, remote)).toEqual([
      {
        id: 5,
        sourceId: 19,
        targetId: 20,
        reactionFileId: null,
        reactionFileStorageId: null,
        fineGranularMetaModelRelationSet: [
          {
            id: 42,
            sourceId: 'Component',
            targetId: 'Class',
            reactionFileStorageId: 88,
            lowCodeReactionRequestBase: { reactionName: 'updated_name' },
          },
        ],
      },
    ]);
  });
});
