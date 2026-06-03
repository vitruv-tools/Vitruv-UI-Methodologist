import { apiService, MetaModelRelationRequest } from '../services/api';

export function isReactionFilesNotFoundError(message: string): boolean {
  return message.toLowerCase().includes('reaction files not found');
}

const extractErrorMessage = (error: unknown, fallback: string): string => {
  const err = error as { response?: { data?: { message?: string } }; message?: string };
  const data = err?.response?.data;
  if (data && typeof data === 'object' && typeof data.message === 'string' && data.message.trim()) {
    return data.message;
  }
  if (typeof err?.message === 'string' && err.message.trim()) {
    return err.message;
  }
  return fallback;
};

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
    const detail = extractErrorMessage(error, 'Save failed');
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
    throw new Error(extractErrorMessage(retryError, 'Save failed'));
  }
}
