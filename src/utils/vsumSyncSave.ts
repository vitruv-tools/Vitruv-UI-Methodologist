import { apiService, MetaModelRelationRequest } from '../services/api';
import { extractApiErrorMessage } from './apiErrorMessage';

export function isReactionFilesNotFoundError(message: string): boolean {
  return message.toLowerCase().includes('reaction files not found');
}

export interface VsumSyncSavePayload {
  metaModelIds: number[];
  metaModelRelationRequests: MetaModelRelationRequest[] | null;
}

export interface VsumSyncSaveResult {
  message: string;
  savedRelations: MetaModelRelationRequest[];
}

/**
 * PUT /sync-changes with automatic retry when backend reports missing reaction files.
 */
export async function syncVsumWorkspaceChanges(
  vsumId: number,
  payload: VsumSyncSavePayload,
): Promise<VsumSyncSaveResult> {
  const relations = payload.metaModelRelationRequests ?? [];

  const attempt = async (rels: MetaModelRelationRequest[]): Promise<VsumSyncSaveResult> => {
    const response: { data?: { message?: string }; message?: string } =
      await apiService.syncVsumChanges(vsumId, {
        metaModelIds: payload.metaModelIds,
        metaModelRelationRequests: rels.length > 0 ? rels : null,
      });
    const message =
      response?.data?.message ||
      response?.message ||
      'Changes saved successfully';
    return { message, savedRelations: rels };
  };

  try {
    return await attempt(relations);
  } catch (error) {
    const detail = extractApiErrorMessage(error, 'Save failed');
    if (!isReactionFilesNotFoundError(detail) || relations.length === 0) {
      throw new Error(detail);
    }
  }

  const fallbackRelations = relations.map(rel => ({ ...rel, reactionFileId: 0 }));
  try {
    const result = await attempt(fallbackRelations);
    return {
      message: `${result.message} (Missing reaction files were unlinked automatically.)`,
      savedRelations: fallbackRelations,
    };
  } catch (retryError) {
    throw new Error(extractApiErrorMessage(retryError, 'Save failed'));
  }
}
