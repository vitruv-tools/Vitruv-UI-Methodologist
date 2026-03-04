import { EObject } from "ecore-ts";

export interface EditableVsum {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  removedAt?: string | null;
}

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

export interface EditableVsumMetaModelRelation {
  id: number | null;
  sourceId: number;
  targetId: number;
  reactionFileStorageId?: number | null;
  fineGranularMetaModelRelationSet: EditableFineGranularMetaModelRelation[];
}

export interface EditableVsumDetails extends EditableVsum {
  metaModels: EditableVsumMetaModelRef[];
  metaModelsRelation?: EditableVsumMetaModelRelation[];
  identifiersToEObject?: Map<string, EObject>;
}

export type EditableFineGranularMetaModelRelation = {
  id?: number; // null for new relations
  sourceId: string;
  targetId: string;
  reactionFileId?: number;
  lowCodeReactionTemplate?: string;
  lowCodeReactionTemplateParams?: any;
  action?: 'create' | 'update' | 'delete'; // null for unchanged relations
}