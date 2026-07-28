import { useCallback, useState } from 'react';
import type { Node } from 'reactflow';
import type { UmlDiagramSaveContext } from '../components/canvas/UMLDiagram';
import {
  computeUmlPanelLayout,
  enrichEcoreMetaFromCanvas,
  loadEcoreFileContent,
} from '../components/canvas/canvasUmlPanelUtils';
import type { CanvasUmlPanelState, EcoreFileExpandMeta } from '../types/canvasTab';
import { canvasUmlLayoutFileName, canvasUmlLayoutScope } from '../utils/metaModelPreview';

export type CanvasUmlPanelLoadErrorMessage =
  | 'Could not load UML diagram for this meta-model.'
  | 'No UML content available for this meta-model.';

type UpdateEcoreFileData = (
  fileName: string,
  content: string,
  ecoreFileId?: number,
) => void;

interface UseCanvasUmlPanelsOptions {
  activeProjectId?: number;
  openTabCount: number;
  isViewOnly: boolean;
  getCanvasNodes: () => Node[];
  fetchEcoreFile: (fileId: number) => Promise<string>;
  updateEcoreFileData?: UpdateEcoreFileData;
  onLoadError: (message: CanvasUmlPanelLoadErrorMessage) => void;
}

interface UseCanvasUmlPanelsResult {
  umlPanels: CanvasUmlPanelState[];
  topPanelId: string | null;
  handleEcoreFileExpand: (
    fileName: string,
    fileContent: string,
    meta?: EcoreFileExpandMeta,
  ) => Promise<void>;
  closePanel: (panelId: string) => void;
  focusPanel: (panelId: string) => void;
  handleUmlPanelEcoreContentUpdated: (panelId: string, content: string) => void;
  buildUmlSaveContext: (panel: CanvasUmlPanelState) => UmlDiagramSaveContext | undefined;
  clearPanels: () => void;
  restorePanels: (panels: CanvasUmlPanelState[], focusedPanelId: string | null) => void;
  removePanelsForDeletedModel: (modelId: number, sourceId: number) => void;
}

function updatePanelEcoreContent(
  panels: CanvasUmlPanelState[],
  panelId: string,
  content: string,
): CanvasUmlPanelState[] {
  return panels.map(panel => (
    panel.id === panelId ? { ...panel, ecoreContent: content } : panel
  ));
}

export function useCanvasUmlPanels({
  activeProjectId,
  openTabCount,
  isViewOnly,
  getCanvasNodes,
  fetchEcoreFile,
  updateEcoreFileData,
  onLoadError,
}: UseCanvasUmlPanelsOptions): UseCanvasUmlPanelsResult {
  const [umlPanels, setUmlPanels] = useState<CanvasUmlPanelState[]>([]);
  const [topPanelId, setTopPanelId] = useState<string | null>(null);

  const handleEcoreFileExpand = useCallback(async (
    fileName: string,
    fileContent: string,
    meta?: EcoreFileExpandMeta,
  ) => {
    const layout = computeUmlPanelLayout(openTabCount);
    const resolved = enrichEcoreMetaFromCanvas(
      fileName,
      fileContent,
      meta,
      getCanvasNodes,
    );

    const loadedContent = await loadEcoreFileContent(
      fileName,
      resolved.content,
      resolved.ecoreFileId,
      fetchEcoreFile,
      updateEcoreFileData,
    );
    if (loadedContent === null) {
      onLoadError('Could not load UML diagram for this meta-model.');
      return;
    }
    if (!loadedContent.trim()) {
      onLoadError('No UML content available for this meta-model.');
      return;
    }

    const newPanel: CanvasUmlPanelState = {
      id: `panel-${Date.now()}`,
      title: fileName.replace(/\.ecore$/, ''),
      fileName,
      ecoreContent: loadedContent,
      metaModelId: resolved.metaModelId,
      metaModelSourceId: resolved.metaModelSourceId,
      ecoreFileId: resolved.ecoreFileId,
      layoutScopeId: canvasUmlLayoutScope(activeProjectId),
      layoutStorageKey: canvasUmlLayoutFileName({
        fileName,
        metaModelSourceId: resolved.metaModelSourceId,
        metaModelId: resolved.metaModelId,
      }),
      top: layout.top,
      right: 16,
      width: 200,
      height: layout.height,
    };
    setUmlPanels(previousPanels => [...previousPanels, newPanel]);
    setTopPanelId(newPanel.id);
  }, [
    activeProjectId,
    fetchEcoreFile,
    getCanvasNodes,
    onLoadError,
    openTabCount,
    updateEcoreFileData,
  ]);

  const closePanel = useCallback((panelId: string) => {
    setUmlPanels(previousPanels => previousPanels.filter(panel => panel.id !== panelId));
    setTopPanelId(previousTopPanelId => (
      previousTopPanelId === panelId ? null : previousTopPanelId
    ));
  }, []);

  const focusPanel = useCallback((panelId: string) => {
    setTopPanelId(panelId);
  }, []);

  const handleUmlPanelSaved = useCallback((
    panelId: string,
    fileName: string,
    result: { ecoreContent: string },
  ) => {
    setUmlPanels(previousPanels => (
      updatePanelEcoreContent(previousPanels, panelId, result.ecoreContent)
    ));
    updateEcoreFileData?.(fileName, result.ecoreContent);
  }, [updateEcoreFileData]);

  const handleUmlPanelEcoreContentUpdated = useCallback((
    panelId: string,
    content: string,
  ) => {
    setUmlPanels(previousPanels => updatePanelEcoreContent(previousPanels, panelId, content));
  }, []);

  const buildUmlSaveContext = useCallback((
    panel: CanvasUmlPanelState,
  ): UmlDiagramSaveContext | undefined => {
    if (isViewOnly || !panel.ecoreFileId) return undefined;
    const libraryMetaModelId = panel.metaModelSourceId ?? panel.metaModelId;
    return {
      metaModelId: libraryMetaModelId ? String(libraryMetaModelId) : '',
      ecoreFileId: panel.ecoreFileId,
      modelName: panel.title,
      saveTarget: 'workspace',
      onSaved: result => handleUmlPanelSaved(panel.id, panel.fileName, result),
    };
  }, [handleUmlPanelSaved, isViewOnly]);

  const clearPanels = useCallback(() => {
    setUmlPanels([]);
    setTopPanelId(null);
  }, []);

  const restorePanels = useCallback((
    panels: CanvasUmlPanelState[],
    focusedPanelId: string | null,
  ) => {
    setUmlPanels(panels);
    setTopPanelId(focusedPanelId);
  }, []);

  const removePanelsForDeletedModel = useCallback((modelId: number, sourceId: number) => {
    setUmlPanels(previousPanels => previousPanels.filter(
      panel => (
        panel.metaModelId !== modelId &&
        panel.metaModelSourceId !== sourceId &&
        panel.metaModelId !== sourceId
      ),
    ));
  }, []);

  return {
    umlPanels,
    topPanelId,
    handleEcoreFileExpand,
    closePanel,
    focusPanel,
    handleUmlPanelEcoreContentUpdated,
    buildUmlSaveContext,
    clearPanels,
    restorePanels,
    removePanelsForDeletedModel,
  };
}
