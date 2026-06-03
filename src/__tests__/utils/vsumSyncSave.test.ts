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

  it('retries with reactionFileId 0 when reaction files are missing', async () => {
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
      metaModelRelationRequests: [{ sourceId: 1, targetId: 2, reactionFileId: 0 }],
    });
    expect(result.savedRelations[0].reactionFileId).toBe(0);
    expect(result.message).toContain('unlinked automatically');
  });
});
