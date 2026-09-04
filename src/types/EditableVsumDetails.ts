import type { EditableFineGranularMetaModelRelation } from './FineGranularMetaModelRelation';

/**
 * Editable counterpart of VsumMetaModelRef.
 * Adds mutable fields needed by the Low Code stores.
 */
export type EditableVsumMetaModelRef = {
  id: number;
  name: string;
  description: string;
  domain: string;
  sourceId: number;
  keyword: string[];
  createdAt: string;
  updatedAt: string;
  removedAt?: string | null;
  ecoreFileId: number;
  genModelFileId: number;
};

/**
 * Editable counterpart of VsumMetaModelRelation.
 * Includes the fine-granular relation set and reaction file tracking.
 */
export type EditableVsumMetaModelRelation = {
  id: number;
  sourceId: number;
  targetId: number;
  reactionFileId: number | null;
  reactionFileStorageId: number | null;
  fineGranularMetaModelRelationSet: EditableFineGranularMetaModelRelation[];
};

/**
 * Full editable VSUM details, used as the source of truth in the
 * VsumDetails Zustand store.
 */
export type EditableVsumDetails = {
  metaModels: EditableVsumMetaModelRef[];
  metaModelsRelation: EditableVsumMetaModelRelation[];
};
