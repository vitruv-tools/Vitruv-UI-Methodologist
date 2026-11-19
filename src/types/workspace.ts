import { MetaModelRelationRequest, ViewRequest } from '../services/api';

export interface WorkspaceSnapshot {
  metaModelIds: number[];
  metaModelRelationRequests: MetaModelRelationRequest[];
  viewRequests?: ViewRequest[];
}

export interface WorkspaceSnapshotRequest {
  resolve: (snapshot: WorkspaceSnapshot) => void;
}
