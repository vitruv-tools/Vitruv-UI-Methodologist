import { Edge, Node } from 'reactflow';
import { DrawerModel } from '../components/canvas/ModelDrawer';
import { WorkspaceSnapshot } from './workspace';

export interface EcoreFileExpandMeta {
  metaModelId?: number;
  metaModelSourceId?: number;
  ecoreFileId?: number;
}

export interface CanvasUmlPanelState {
  id: string;
  title: string;
  /** Ecore file name on the canvas (used to match flow nodes) */
  fileName: string;
  ecoreContent: string;
  /** Library meta-model id (for save); prefer metaModelSourceId when present on canvas nodes */
  metaModelId?: number;
  metaModelSourceId?: number;
  ecoreFileId?: number;
  /** Frozen localStorage scope for UML box positions */
  layoutScopeId?: string;
  /** Frozen localStorage key for UML box positions */
  layoutStorageKey?: string;
  top: number;
  right: number;
  width: number;
  height: number;
}

export interface CanvasTabSession {
  nodes: Node[];
  edges: Edge[];
  vsumName: string;
  drawerModels: DrawerModel[];
  myLibraryModels: DrawerModel[];
  publicLibraryModels: DrawerModel[];
  addedModelIds: number[];
  umlPanels: CanvasUmlPanelState[];
  topPanelId: string | null;
  workspaceSnapshot: WorkspaceSnapshot;
}

export interface OpenCanvasTab {
  instanceId: string;
  projectId: number;
  name: string;
}
