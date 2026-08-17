import { apiService, MetaModelRelationRequest } from '../services/api';
import { extractApiErrorMessage } from './apiErrorMessage';
import { normalizeReactionFileId } from './workspaceSnapshotUtils';

const getErrorStatus = (error: unknown): number | undefined => {
  const err = error as { status?: number; response?: { status?: number } };
  return err?.status ?? err?.response?.status;
};

/**
 * Backend reports missing reaction-file ids either as an explicit message or
 * as HTTP 404 on PUT /sync-changes (empty "Not Found" body).
 */
export function isReactionFilesNotFoundError(message: string, error?: unknown): boolean {
  const msg = message.toLowerCase();
  if (msg.includes('reaction file') && msg.includes('not found')) return true;
  if (getErrorStatus(error) === 404) return true;
  return false;
}

export function unlinkReactionFileIds(
  relations: MetaModelRelationRequest[],
): MetaModelRelationRequest[] {
  return relations.map(rel => ({
    sourceId: rel.sourceId,
    targetId: rel.targetId,
    reactionFileId: null,
    ...(rel.fineGranularMetaModelRelationSet?.length
      ? {
          fineGranularMetaModelRelationSet: rel.fineGranularMetaModelRelationSet.map(fg => ({
            id: fg.id,
            sourceId: fg.sourceId,
            targetId: fg.targetId,
            ...(fg.lowCodeReactionRequestBase
              ? { lowCodeReactionRequestBase: fg.lowCodeReactionRequestBase }
              : {}),
          })),
        }
      : {}),
  }));
}

export function hasLinkedReactionFiles(relations: MetaModelRelationRequest[]): boolean {
  return relations.some(rel =>
    normalizeReactionFileId(rel.reactionFileId) > 0
    || Boolean(
      rel.fineGranularMetaModelRelationSet?.some(
        fg => normalizeReactionFileId(fg.reactionFileStorageId) > 0,
      ),
    ),
  );
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
    const canUnlink =
      isReactionFilesNotFoundError(detail, error)
      && relations.length > 0
      && hasLinkedReactionFiles(relations);
    if (!canUnlink) {
      throw new Error(detail);
    }
  }

  const fallbackRelations = unlinkReactionFileIds(relations);
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
