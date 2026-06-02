import { MetaModelRelationRequest } from '../services/api';

export interface WorkspaceSnapshot {
  metaModelIds: number[];
  metaModelRelationRequests: MetaModelRelationRequest[];
}

export interface WorkspaceSnapshotRequest {
  resolve: (snapshot: WorkspaceSnapshot) => void;
}