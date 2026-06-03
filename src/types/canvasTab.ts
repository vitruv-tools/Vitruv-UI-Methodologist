import { Edge, Node } from 'reactflow';
import { DrawerModel } from '../components/canvas/ModelDrawer';
import { WorkspaceSnapshot } from './workspace';

export interface CanvasUmlPanelState {
  id: string;
  title: string;
  /** Ecore file name used as the layout persistence key */
  fileName: string;
  ecoreContent: string;
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
