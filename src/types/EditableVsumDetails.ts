import { EObject } from "ecore-ts";

/**
 * Editable top-level VSUM metadata.
 */
export interface EditableVsum {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  removedAt?: string | null;
}

/**
 * Editable meta model reference assigned to a VSUM.
 */
export interface EditableVsumMetaModelRef {
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
}

/**
 * Editable relation between two meta models inside a VSUM.
 */
export interface EditableVsumMetaModelRelation {
  id: number | null;
  sourceId: number;
  //sourceSourceId: number;
  targetId: number;
  //targetSourceId: number;
  reactionFileStorageId?: number | null;
  fineGranularMetaModelRelationSet: EditableFineGranularMetaModelRelation[];
}

/**
 * Full editable VSUM details including graph relations and identifier mappings.
 */
export interface EditableVsumDetails extends EditableVsum {
  metaModels: EditableVsumMetaModelRef[];
  metaModelsRelation?: EditableVsumMetaModelRelation[];
  identifiersToEObject?: Map<string, EObject>;
  identifiersToBackendMetaModelId?: Map<string, number>;
}

/**
 * Editable fine-granular relation between two concrete EObjects.
 */
export type EditableFineGranularMetaModelRelation = {
  id: number | null; // null for new relations
  sourceId: string;
  targetId: string;
  reactionFileStorageId?: number;
  lowCodeReactionRequestBase?: { [key: string]: unknown };
}