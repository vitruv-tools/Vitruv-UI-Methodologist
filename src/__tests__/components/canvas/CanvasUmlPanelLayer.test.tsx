import React from 'react';
import { render } from '@testing-library/react';
import type { DrawerModel } from '../../../components/canvas/ModelDrawer';
import type { UmlDiagramSaveContext } from '../../../components/canvas/UMLDiagram';
import { CanvasUmlPanelLayer } from '../../../components/canvas/CanvasUmlPanelLayer';
import type { CanvasUmlPanelState } from '../../../types/canvasTab';

interface MockFloatingUMLPanelProps {
  id: string;
  title: string;
  fileName: string;
  layoutScopeId: string;
  ecoreContent: string;
  saveContext?: UmlDiagramSaveContext;
  viewOnly: boolean;
  initialTop: number;
  initialRight: number;
  panelWidth: number;
  panelHeight: number;
  onClose: (panelId: string) => void;
  onFocus: (panelId: string) => void;
  onHome: () => void;
  ecoreFileId?: number;
  fetchEcoreFile: (fileId: number) => Promise<string>;
  onEcoreContentUpdated: (content: string) => void;
  zIndex: number;
  libraryModels?: DrawerModel[];
  vsumId?: string;
}

const mockFloatingUMLPanel = jest.fn((_props: MockFloatingUMLPanelProps) => null);

jest.mock('../../../components/canvas/FloatingUMLPanel', () => ({
  FloatingUMLPanel: (props: MockFloatingUMLPanelProps) => mockFloatingUMLPanel(props),
}));

const panels: CanvasUmlPanelState[] = [
  {
    id: 'panel-1',
    title: 'First model',
    fileName: 'first.ecore',
    ecoreContent: '<first />',
    metaModelId: 11,
    metaModelSourceId: 111,
    ecoreFileId: 101,
    top: 10,
    right: 20,
    width: 640,
    height: 480,
  },
  {
    id: 'panel-2',
    title: 'Second model',
    fileName: 'second.ecore',
    ecoreContent: '<second />',
    metaModelId: 22,
    ecoreFileId: 202,
    layoutStorageKey: 'stored-layout-key',
    layoutScopeId: 'stored-layout-scope',
    top: 30,
    right: 40,
    width: 720,
    height: 520,
  },
];

const libraryModels: DrawerModel[] = [{ id: 31, name: 'Library model' }];

const createProps = () => ({
  panels,
  vsumName: '',
  activeProjectId: 42,
  topPanelId: 'panel-2',
  panelZBase: 2000,
  viewOnly: true,
  buildSaveContext: jest.fn(
    (panel: CanvasUmlPanelState): UmlDiagramSaveContext => ({
      metaModelId: String(panel.metaModelId),
      ecoreFileId: panel.ecoreFileId ?? 0,
      modelName: panel.title,
    }),
  ),
  onClose: jest.fn(),
  onFocus: jest.fn(),
  onHome: jest.fn(),
  onEcoreContentUpdated: jest.fn(),
  libraryModels,
  fetchEcoreFile: jest.fn().mockResolvedValue('<fresh />'),
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CanvasUmlPanelLayer', () => {
  it('maps panel configuration and preserves focused-panel ordering', () => {
    const props = createProps();

    render(<CanvasUmlPanelLayer {...props} />);

    expect(mockFloatingUMLPanel).toHaveBeenCalledTimes(2);
    const firstPanelProps = mockFloatingUMLPanel.mock.calls[0][0];
    const secondPanelProps = mockFloatingUMLPanel.mock.calls[1][0];

    expect(firstPanelProps).toMatchObject({
      id: 'panel-1',
      title: 'First model',
      fileName: 'metamodel-111-first.ecore',
      layoutScopeId: 'vsum-42',
      ecoreContent: '<first />',
      saveContext: {
        metaModelId: '11',
        ecoreFileId: 101,
        modelName: 'First model',
      },
      viewOnly: true,
      initialTop: 10,
      initialRight: 20,
      panelWidth: 640,
      panelHeight: 480,
      onClose: props.onClose,
      onFocus: props.onFocus,
      onHome: props.onHome,
      ecoreFileId: 101,
      fetchEcoreFile: props.fetchEcoreFile,
      zIndex: 2000,
      libraryModels,
      vsumId: '42',
    });
    expect(secondPanelProps).toMatchObject({
      id: 'panel-2',
      title: 'Second model',
      fileName: 'stored-layout-key',
      layoutScopeId: 'stored-layout-scope',
      zIndex: 2002,
    });
    expect(props.buildSaveContext).toHaveBeenNthCalledWith(1, panels[0]);
    expect(props.buildSaveContext).toHaveBeenNthCalledWith(2, panels[1]);
  });

  it('forwards shared callbacks and scopes content updates to each panel', async () => {
    const props = createProps();

    render(<CanvasUmlPanelLayer {...props} />);

    const firstPanelProps = mockFloatingUMLPanel.mock.calls[0][0];
    const secondPanelProps = mockFloatingUMLPanel.mock.calls[1][0];

    firstPanelProps.onClose('panel-1');
    firstPanelProps.onFocus('panel-1');
    firstPanelProps.onHome();
    await firstPanelProps.fetchEcoreFile(303);
    firstPanelProps.onEcoreContentUpdated('<updated-first />');
    secondPanelProps.onEcoreContentUpdated('<updated-second />');

    expect(props.onClose).toHaveBeenCalledWith('panel-1');
    expect(props.onFocus).toHaveBeenCalledWith('panel-1');
    expect(props.onHome).toHaveBeenCalledTimes(1);
    expect(props.fetchEcoreFile).toHaveBeenCalledWith(303);
    expect(props.onEcoreContentUpdated).toHaveBeenNthCalledWith(
      1,
      'panel-1',
      '<updated-first />',
    );
    expect(props.onEcoreContentUpdated).toHaveBeenNthCalledWith(
      2,
      'panel-2',
      '<updated-second />',
    );
  });

  it('uses the project name for every panel title when available', () => {
    render(<CanvasUmlPanelLayer {...createProps()} vsumName="Project name" />);

    expect(mockFloatingUMLPanel.mock.calls[0][0].title).toBe('Project name');
    expect(mockFloatingUMLPanel.mock.calls[1][0].title).toBe('Project name');
  });
});
