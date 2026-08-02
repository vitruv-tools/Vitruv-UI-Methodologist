export interface Vsum {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  removedAt?: string | null;
  /** Current user's access role when returned from list APIs */
  role?: string;
  roleEn?: string;
  /** Project owner (may be returned on shared-project list items) */
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerEmail?: string;
}

export interface VsumMetaModelRef {
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

export interface VsumMetaModelRelation {
  id: number;
  sourceId: number;
  targetId: number;
  reactionFileId?: number | null;
  reactionFileStorageId?: number | null;
}

export interface VsumDetails extends Vsum {
  metaModels: VsumMetaModelRef[];
  metaModelsRelation?: VsumMetaModelRelation[];
}

export interface ApiResponse<T> {
  data: T;
  message: string;
}


