import { apiService } from '../../services/api';
import { syncVsumWorkspaceChanges } from '../../utils/vsumSyncSave';

jest.mock('../../services/api', () => ({
  apiService: {
    syncVsumChanges: jest.fn(),
  },
}));

describe('syncVsumWorkspaceChanges', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns success message on first successful save', async () => {
    (apiService.syncVsumChanges as jest.Mock).mockResolvedValueOnce({
      message: 'VSUM successfully updated',
    });

    const result = await syncVsumWorkspaceChanges(1, {
      metaModelIds: [10, 20],
      metaModelRelationRequests: [{ sourceId: 10, targetId: 20, reactionFileId: 5 }],
    });

    expect(result.message).toBe('VSUM successfully updated');
    expect(apiService.syncVsumChanges).toHaveBeenCalledTimes(1);
  });

  it('retries with reactionFileId null when reaction files are missing', async () => {
    (apiService.syncVsumChanges as jest.Mock)
      .mockRejectedValueOnce({
        response: { data: { message: 'Reaction files not found for relation' } },
      })
      .mockResolvedValueOnce({ message: 'VSUM successfully updated' });

    const result = await syncVsumWorkspaceChanges(2, {
      metaModelIds: [1, 2],
      metaModelRelationRequests: [{ sourceId: 1, targetId: 2, reactionFileId: 99 }],
    });

    expect(apiService.syncVsumChanges).toHaveBeenCalledTimes(2);
    expect(apiService.syncVsumChanges).toHaveBeenLastCalledWith(2, {
      metaModelIds: [1, 2],
      metaModelRelationRequests: [{ sourceId: 1, targetId: 2, reactionFileId: null }],
    });
    expect(result.savedRelations[0].reactionFileId).toBeNull();
    expect(result.message).toContain('unlinked automatically');
  });

  it('retries a 404 by unlinking coarse and fine reaction file ids', async () => {
    (apiService.syncVsumChanges as jest.Mock)
      .mockRejectedValueOnce(Object.assign(new Error('Not Found'), { status: 404 }))
      .mockResolvedValueOnce({ message: 'VSUM successfully updated' });

    const result = await syncVsumWorkspaceChanges(5, {
      metaModelIds: [1, 2],
      metaModelRelationRequests: [
        {
          sourceId: 1,
          targetId: 2,
          reactionFileId: 99,
          fineGranularMetaModelRelationSet: [
            {
              id: null,
              sourceId: 'http://a#A',
              targetId: 'http://b#B',
              reactionFileStorageId: 99,
              lowCodeReactionRequestBase: { routine: 'sync' },
            },
          ],
        },
      ],
    });

    expect(apiService.syncVsumChanges).toHaveBeenCalledTimes(2);
    expect(apiService.syncVsumChanges).toHaveBeenLastCalledWith(5, {
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
              lowCodeReactionRequestBase: { routine: 'sync' },
            },
          ],
        },
      ],
    });
    expect(result.savedRelations[0].reactionFileId).toBeNull();
    expect(result.savedRelations[0].fineGranularMetaModelRelationSet?.[0].reactionFileStorageId)
      .toBeUndefined();
  });

  it('does not retry a 404 when no reaction file ids were sent', async () => {
    (apiService.syncVsumChanges as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Not Found'), { status: 404 }),
    );

    await expect(
      syncVsumWorkspaceChanges(5, {
        metaModelIds: [1, 2],
        metaModelRelationRequests: [{ sourceId: 1, targetId: 2, reactionFileId: null }],
      }),
    ).rejects.toThrow('Not Found');
    expect(apiService.syncVsumChanges).toHaveBeenCalledTimes(1);
  });
});
