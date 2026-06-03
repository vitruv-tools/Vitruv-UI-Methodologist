import { Edge, Node } from 'reactflow';
import { MetaModelRelationRequest } from '../services/api';
import { StoredDocumentMeta } from '../utils/flowUtils';

export interface WorkspaceSnapshot {
  metaModelIds: number[];
  metaModelRelationRequests: MetaModelRelationRequest[];
}

export interface WorkspaceSnapshotRequest {
  resolve: (snapshot: WorkspaceSnapshot) => void;
}

export interface ProjectEditorSession {
  nodes: Node[];
  edges: Edge[];
  expandedMetaModelName: string | null;
  cachedWorkspaceSnapshot: WorkspaceSnapshot | null;
  documents: StoredDocumentMeta[];
  selectedFileBoxId: string | null;
}

export interface CaptureEditorSessionRequest {
  resolve: (session: ProjectEditorSession) => void;
}