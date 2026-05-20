import { MetaModelRelationRequest } from '../services/api';

export interface ViewRequest {
  metaModelIds: number[];
  fileStorageId: number;
}

export interface WorkspaceSnapshot {
  metaModelIds: number[];
  metaModelRelationRequests: MetaModelRelationRequest[];
  viewRequests: ViewRequest[];
}

export interface WorkspaceSnapshotRequest {
  resolve: (snapshot: WorkspaceSnapshot) => void;
}