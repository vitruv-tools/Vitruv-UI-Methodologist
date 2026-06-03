import {
  cloneWorkspaceSnapshot,
  emptyWorkspaceSnapshot,
  mapRelationsForCanvasLoad,
  normalizeReactionFileId,
  prepareSnapshotForSyncSave,
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
});

describe('mapRelationsForCanvasLoad', () => {
  it('normalizes reaction file ids for canvas load', () => {
    const mapped = mapRelationsForCanvasLoad([
      { id: 1, sourceId: 1, targetId: 2, reactionFileStorageId: '4' },
    ] as any);
    expect(mapped[0].reactionFileId).toBe(4);
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
});
