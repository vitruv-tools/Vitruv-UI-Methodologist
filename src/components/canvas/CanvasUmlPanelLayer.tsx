import React from 'react';
import { FloatingUMLPanel } from './FloatingUMLPanel';
import type { UmlDiagramSaveContext } from './UMLDiagram';
import type { DrawerModel } from './ModelDrawer';
import type { CanvasUmlPanelState } from '../../types/canvasTab';
import { canvasUmlLayoutFileName, canvasUmlLayoutScope } from '../../utils/metaModelPreview';

interface CanvasUmlPanelLayerProps {
  panels: CanvasUmlPanelState[];
  vsumName: string;
  activeProjectId?: number;
  topPanelId: string | null;
  panelZBase: number;
  viewOnly?: boolean;
  buildSaveContext: (panel: CanvasUmlPanelState) => UmlDiagramSaveContext | undefined;
  onClose: (panelId: string) => void;
  onFocus: (panelId: string) => void;
  onHome: () => void;
  onEcoreContentUpdated: (panelId: string, content: string) => void;
  libraryModels?: DrawerModel[];
  fetchEcoreFile: (fileId: number) => Promise<string>;
}

export const CanvasUmlPanelLayer: React.FC<CanvasUmlPanelLayerProps> = ({
  panels,
  vsumName,
  activeProjectId,
  topPanelId,
  panelZBase,
  viewOnly = false,
  buildSaveContext,
  onClose,
  onFocus,
  onHome,
  onEcoreContentUpdated,
  libraryModels,
  fetchEcoreFile,
}) => (
  <>
    {panels.map((panel, idx) => (
      <FloatingUMLPanel
        key={panel.id}
        id={panel.id}
        title={vsumName || panel.title}
        fileName={panel.layoutStorageKey ?? canvasUmlLayoutFileName(panel)}
        layoutScopeId={panel.layoutScopeId ?? canvasUmlLayoutScope(activeProjectId)}
        ecoreContent={panel.ecoreContent}
        saveContext={buildSaveContext(panel)}
        viewOnly={viewOnly}
        initialTop={panel.top}
        initialRight={panel.right}
        panelWidth={panel.width}
        panelHeight={panel.height}
        onClose={onClose}
        onFocus={onFocus}
        onHome={onHome}
        ecoreFileId={panel.ecoreFileId}
        fetchEcoreFile={fetchEcoreFile}
        onEcoreContentUpdated={content => onEcoreContentUpdated(panel.id, content)}
        zIndex={panelZBase + (topPanelId === panel.id ? panels.length : idx)}
        libraryModels={libraryModels}
        vsumId={activeProjectId?.toString()}
      />
    ))}
  </>
);
