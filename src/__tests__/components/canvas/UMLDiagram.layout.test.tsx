jest.mock('../../../utils/ecoreToUml', () => require('./diagramMockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('./diagramMockFactories').saveMetaModelEcoreMock());
jest.mock('../../../utils/umlValidation', () => require('./diagramMockFactories').umlValidationMock());
jest.mock('../../../utils/reactionFile', () => require('./diagramMockFactories').reactionFileMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => require('./diagramMockFactories').umlDiagramMinimapMock());
jest.mock('../../../components/flow/ReactionEditorModal', () => require('./diagramMockFactories').reactionEditorModalMock());
jest.mock('../../../components/canvas/ReactionConfigPopup', () => require('./diagramMockFactories').reactionConfigPopupMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('./diagramMockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('./diagramMockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('./diagramMockFactories').umlLayoutStorageMock());

import { loadUmlLayout } from '../../../utils/umlLayoutStorage';
import { fileName, scopeId, SIMPLE_ECORE } from './diagramTestFixtures';
import { renderDiagram } from './diagramTestUtils';

describe('UMLDiagram layout', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('mounts with layout scope and persists positions on unmount', () => {
    const { unmount } = renderDiagram({
      ecoreContent: SIMPLE_ECORE,
      fileName,
      layoutScopeId: scopeId,
    });

    unmount();
    expect(loadUmlLayout(scopeId, fileName)).not.toBeNull();
  });
});
