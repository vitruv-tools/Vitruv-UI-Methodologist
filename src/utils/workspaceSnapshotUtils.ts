import { MetaModelRelationRequest } from '../services/api';
import type { EditableVsumDetails, EditableVsumMetaModelRelation } from '../types/EditableVsumDetails';
import type { EditableFineGranularMetaModelRelation } from '../types/FineGranularMetaModelRelation';
import { VsumDetails, VsumMetaModelRelation } from '../types/vsum';
import { WorkspaceSnapshot } from '../types/workspace';
import { toWireLowCodeReactionRequestBase } from './lowCodeReactionPayload';

export const normalizeReactionFileId = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
};

/**
 * Wire format for PUT /sync-changes: only a stored REACTION file id is sent.
 * `0` and other missing values become `null` so the backend skips the file lookup.
 */
export const toWireReactionFileId = (value: unknown): number | null => {
  const id = normalizeReactionFileId(value);
  return id > 0 ? id : null;
};

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const asFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const asPositiveNumber = (value: unknown): number | undefined => {
  const parsed = asFiniteNumber(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stableStringify = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  const entries = keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k]));
  return '{' + entries.join(',') + '}';
};

const cloneLowCodeConfig = (
  value: { [key: string]: unknown } | undefined,
): { [key: string]: unknown } | undefined => {
  if (!value) return undefined;
  try {
    return structuredClone(value);
  } catch {
    return { ...value };
  }
};

const cloneFineRelation = (
  fg: EditableFineGranularMetaModelRelation,
): EditableFineGranularMetaModelRelation => ({
  ...fg,
  lowCodeReactionRequestBase: cloneLowCodeConfig(fg.lowCodeReactionRequestBase),
});

const asEObjectFqId = (value: unknown): string | undefined => {
  const direct = asNonEmptyString(value);
  if (direct) return direct;
  if (!isPlainObject(value)) return undefined;
  return asEObjectFqId(
    value.uri
    ?? value.eObjectId
    ?? value.eObjectSourceId
    ?? value.eObjectTargetId
    ?? (typeof value.id === 'string' ? value.id : undefined),
  );
};

/**
 * Normalize a backend (or loosely-shaped) fine-granular relation array.
 * Accepts aliases used by different GET payloads:
 * `sourceId` / `eObjectSourceId` / nested `{ uri }`,
 * `lowCodeReactionRequestBase` / `lowCodeReaction` / `params`.
 */
export const parseFineGranularRelationSet = (
  raw: unknown,
): EditableFineGranularMetaModelRelation[] => {
  if (!Array.isArray(raw)) return [];

  const result: EditableFineGranularMetaModelRelation[] = [];
  for (const item of raw) {
    if (!isPlainObject(item)) continue;
    const sourceId = asEObjectFqId(
      item.sourceId ?? item.eObjectSourceId ?? item.sourceEObjectId ?? item.source,
    );
    const targetId = asEObjectFqId(
      item.targetId ?? item.eObjectTargetId ?? item.targetEObjectId ?? item.target,
    );
    if (!sourceId || !targetId) continue;

    const parsedId = asPositiveNumber(
      item.id ?? item.fineGranularMetaModelRelationId,
    );
    const id = parsedId ?? null;
    const reactionFileStorageId = asPositiveNumber(
      item.reactionFileStorageId
      ?? item.reactionFileId
      ?? item.fileStorageId
      ?? item.storageId,
    );
    const lowCodeRaw = item.lowCodeReactionRequestBase ?? item.lowCodeReaction ?? item.params;
    const lowCodeReactionRequestBase = isPlainObject(lowCodeRaw)
      ? { ...lowCodeRaw }
      : undefined;

    result.push({
      id,
      sourceId,
      targetId,
      ...(reactionFileStorageId !== undefined ? { reactionFileStorageId } : {}),
      ...(lowCodeReactionRequestBase ? { lowCodeReactionRequestBase } : {}),
    });
  }
  return result;
};

export const fineSetFromVsumRelation = (
  rel: VsumMetaModelRelation | Record<string, unknown>,
): EditableFineGranularMetaModelRelation[] => {
  const anyRel = rel as VsumMetaModelRelation & Record<string, unknown>;
  return parseFineGranularRelationSet(
    anyRel.fineGranularMetaModelRelationSet
    ?? anyRel.fineGranularMetaModelRelations
    ?? anyRel.fineGranularRelations
    ?? anyRel.fineRelations,
  );
};

/** Relation list as returned by GET /vsums/{id}/details (several historical names). */
export const relationsFromVsumDetails = (
  details: VsumDetails | Record<string, unknown>,
): VsumMetaModelRelation[] => {
  const anyDetails = details as VsumDetails & Record<string, unknown>;
  const raw =
    anyDetails.metaModelsRelation
    ?? anyDetails.metaModelRelations
    ?? anyDetails.relations;
  return Array.isArray(raw) ? raw as VsumMetaModelRelation[] : [];
};

const comparableFineSet = (
  fines: EditableFineGranularMetaModelRelation[] | undefined,
): string => {
  if (!fines?.length) return '';
  return [...fines]
    .map(f => {
      const fileId = normalizeReactionFileId(f.reactionFileStorageId);
      const idPart = f.id == null ? 'n' : String(f.id);
      return `${f.sourceId}->${f.targetId}#${idPart}#${fileId}#${stableStringify(f.lowCodeReactionRequestBase)}`;
    })
    .sort((a, b) => a.localeCompare(b))
    .join('|');
};

const toComparable = (snapshot: WorkspaceSnapshot | null | undefined) => {
  const ids = [...(snapshot?.metaModelIds ?? [])].sort((a, b) => a - b);
  const rels = [...(snapshot?.metaModelRelationRequests ?? [])]
    .map(r => {
      const normalizedId = normalizeReactionFileId(r.reactionFileId);
      const fines = comparableFineSet(r.fineGranularMetaModelRelationSet);
      return `${r.sourceId}->${r.targetId}#${normalizedId}#${fines}`;
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
    (r: MetaModelRelationRequest) => ({
      ...r,
      fineGranularMetaModelRelationSet: r.fineGranularMetaModelRelationSet
        ? r.fineGranularMetaModelRelationSet.map(cloneFineRelation)
        : undefined,
    }),
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
  const metaModelRelationRequests = relationsFromVsumDetails(details).map(r => {
    const fines = fineSetFromVsumRelation(r);
    return {
      sourceId: r.sourceId,
      targetId: r.targetId,
      reactionFileId: toWireReactionFileId(r.reactionFileId ?? r.reactionFileStorageId),
      ...(fines.length ? { fineGranularMetaModelRelationSet: fines } : {}),
    };
  });
  return { metaModelIds, metaModelRelationRequests };
};

/** Map a VSUM details GET payload into the editable Zustand store shape. */
export const mapVsumDetailsToEditable = (details: VsumDetails): EditableVsumDetails => ({
  metaModels: (details.metaModels || []).map(mm => ({ ...mm })),
  metaModelsRelation: relationsFromVsumDetails(details).map(r => ({
    id: r.id,
    sourceId: r.sourceId,
    targetId: r.targetId,
    reactionFileId: r.reactionFileId ?? null,
    reactionFileStorageId: r.reactionFileStorageId ?? null,
    fineGranularMetaModelRelationSet: fineSetFromVsumRelation(r),
  })),
});

export const mapRelationsForCanvasLoad = (relations: VsumMetaModelRelation[]) =>
  relations.map(r => ({
    id: r.id,
    sourceId: r.sourceId,
    targetId: r.targetId,
    reactionFileId: toWireReactionFileId(r.reactionFileId ?? r.reactionFileStorageId),
  }));

/**
 * Copy GET-assigned fine ids / generated-file ids onto the in-memory store
 * rows after a successful save, so the next edit can send an in-place update.
 */
export const mergePersistedFineRelationIds = (
  local: EditableVsumMetaModelRelation[],
  remote: EditableVsumMetaModelRelation[],
): EditableVsumMetaModelRelation[] => {
  const remoteByCoarse = new Map(
    remote.map(r => [`${r.sourceId}->${r.targetId}`, r] as const),
  );
  return local.map(rel => {
    const remoteRel = remoteByCoarse.get(`${rel.sourceId}->${rel.targetId}`);
    if (!remoteRel) return rel;
    return {
      ...rel,
      id: rel.id > 0 ? rel.id : remoteRel.id,
      fineGranularMetaModelRelationSet: rel.fineGranularMetaModelRelationSet.map(fg => {
        const match = remoteRel.fineGranularMetaModelRelationSet.find(
          r => r.sourceId === fg.sourceId && r.targetId === fg.targetId,
        );
        if (!match) return fg;
        return {
          ...fg,
          id: toWireReactionFileId(match.id) ?? fg.id,
          reactionFileStorageId:
            toWireReactionFileId(match.reactionFileStorageId) ?? fg.reactionFileStorageId,
        };
      }),
    };
  });
};

/**
 * Wire shape for a fine relation: drop `id: null` and storage-id `0` so the
 * backend does not look up a missing reaction file / entity.
 *
 * Updates (persisted FG id and/or generated file id) must send `regenerate: true`
 * so the backend overwrites that FileStorage row via `updateFile`, not `storeFile`.
 */
export const toWireFineGranularRelation = (
  fg: EditableFineGranularMetaModelRelation,
): EditableFineGranularMetaModelRelation => {
  const storageId = normalizeReactionFileId(fg.reactionFileStorageId);
  const persistedId = toWireReactionFileId(fg.id);
  const isUpdate = persistedId != null || storageId > 0;
  const lowCode = toWireLowCodeReactionRequestBase(fg.lowCodeReactionRequestBase, {
    regenerate: isUpdate,
  });
  return {
    id: persistedId,
    sourceId: fg.sourceId,
    targetId: fg.targetId,
    ...(storageId > 0 ? { reactionFileStorageId: storageId } : {}),
    ...(lowCode ? { lowCodeReactionRequestBase: lowCode } : {}),
  };
};

/** Aligns canvas save payload with backend expectations. */
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
      reactionFileId: toWireReactionFileId(rel.reactionFileId),
      ...(rel.fineGranularMetaModelRelationSet?.length
        ? {
            fineGranularMetaModelRelationSet:
              rel.fineGranularMetaModelRelationSet.map(toWireFineGranularRelation),
          }
        : {}),
    }));

  return {
    metaModelIds,
    metaModelRelationRequests:
      metaModelRelationRequests.length > 0 ? metaModelRelationRequests : null,
  };
};
