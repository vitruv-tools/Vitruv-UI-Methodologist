jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('../../../testSupport/umlDiagram/mockFactories').saveMetaModelEcoreMock());
jest.mock('../../../utils/umlValidation', () => require('../../../testSupport/umlDiagram/mockFactories').umlValidationMock());
jest.mock('../../../utils/reactionFile', () => require('../../../testSupport/umlDiagram/mockFactories').reactionFileMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramMinimapMock());
jest.mock('../../../components/flow/ReactionEditorModal', () => require('../../../testSupport/umlDiagram/mockFactories').reactionEditorModalMock());
jest.mock('../../../components/canvas/ReactionConfigPopup', () => require('../../../testSupport/umlDiagram/mockFactories').reactionConfigPopupMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());

import { loadUmlLayout } from '../../../utils/umlLayoutStorage';
import { fileName, scopeId, SIMPLE_ECORE } from '../../../testSupport/umlDiagram/fixtures';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

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

