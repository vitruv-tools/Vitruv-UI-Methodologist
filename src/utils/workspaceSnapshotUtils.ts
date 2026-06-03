import { MetaModelRelationRequest } from '../services/api';
import { VsumDetails, VsumMetaModelRelation } from '../types/vsum';
import { WorkspaceSnapshot } from '../types/workspace';

export const normalizeReactionFileId = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
};

const toComparable = (snapshot: WorkspaceSnapshot | null | undefined) => {
  const ids = [...(snapshot?.metaModelIds ?? [])].sort((a, b) => a - b);
  const rels = [...(snapshot?.metaModelRelationRequests ?? [])]
    .map(r => {
      const normalizedId = normalizeReactionFileId(r.reactionFileId);
      return `${r.sourceId}->${r.targetId}#${normalizedId}`;
    })
    .sort((a, b) => a.localeCompare(b));
  return { ids, rels };
};

export const workspaceSnapshotsEqual = (
  a: WorkspaceSnapshot | null | undefined,
  b: WorkspaceSnapshot | null | undefined,
): boolean => {
  const ca = toComparable(a);
  const cb = toComparable(b);
  if (ca.ids.length !== cb.ids.length) return false;
  for (let i = 0; i < ca.ids.length; i++) {
    if (ca.ids[i] !== cb.ids[i]) return false;
  }
  if (ca.rels.length !== cb.rels.length) return false;
  for (let i = 0; i < ca.rels.length; i++) {
    if (ca.rels[i] !== cb.rels[i]) return false;
  }
  return true;
};

export const cloneWorkspaceSnapshot = (snapshot: WorkspaceSnapshot): WorkspaceSnapshot => ({
  metaModelIds: [...snapshot.metaModelIds],
  metaModelRelationRequests: (snapshot.metaModelRelationRequests ?? []).map(
    (r: MetaModelRelationRequest) => ({ ...r }),
  ),
});

export const emptyWorkspaceSnapshot = (): WorkspaceSnapshot => ({
  metaModelIds: [],
  metaModelRelationRequests: [],
});

/** Snapshot shape expected by sync-changes (source ids, normalized reaction files). */
export const workspaceSnapshotFromVsumDetails = (details: VsumDetails): WorkspaceSnapshot => {
  const metaModelIds =
    details.metaModels
      ?.map(mm => mm.sourceId)
      .filter((x): x is number => typeof x === 'number') ?? [];
  const metaModelRelationRequests = (details.metaModelsRelation ?? []).map(r => ({
    sourceId: r.sourceId,
    targetId: r.targetId,
    reactionFileId: normalizeReactionFileId(r.reactionFileId ?? r.reactionFileStorageId),
  }));
  return { metaModelIds, metaModelRelationRequests };
};

export const mapRelationsForCanvasLoad = (relations: VsumMetaModelRelation[]) =>
  relations.map(r => ({
    id: r.id,
    sourceId: r.sourceId,
    targetId: r.targetId,
    reactionFileId: normalizeReactionFileId(r.reactionFileId ?? r.reactionFileStorageId),
  }));

/** Aligns canvas save payload with VsumTabs / backend expectations. */
export const prepareSnapshotForSyncSave = (
  snapshot: WorkspaceSnapshot,
): {
  metaModelIds: number[];
  metaModelRelationRequests: MetaModelRelationRequest[] | null;
} => {
  const metaModelIds = Array.from(new Set(snapshot.metaModelIds ?? []));
  const metaModelRelationRequests = (snapshot.metaModelRelationRequests ?? [])
    .filter(
      rel =>
        metaModelIds.includes(rel.sourceId) && metaModelIds.includes(rel.targetId),
    )
    .map(rel => ({
      sourceId: rel.sourceId,
      targetId: rel.targetId,
      reactionFileId: normalizeReactionFileId(rel.reactionFileId),
    }));

  return {
    metaModelIds,
    metaModelRelationRequests:
      metaModelRelationRequests.length > 0 ? metaModelRelationRequests : null,
  };
};
