export interface Vsum {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  removedAt?: string | null;
}

export interface VsumMetaModelRef {
  id: number;
  name: string;
  description: string;
  domain: string;
  keyword: string[];
  createdAt: string;
  updatedAt: string;
  removedAt?: string | null;
  ecoreFileId: number;
  genModelFileId: number;
}

export interface VsumDetails extends Vsum {
  metaModels: VsumMetaModelRef[];
}

export interface ApiResponse<T> {
  data: T;
  message: string;
}


