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

import React, { createRef } from 'react';
import type { UMLDiagramHandle } from '../../../components/canvas/UMLDiagram';
import { renderDiagram } from './diagramTestUtils';

describe('UMLDiagram ref', () => {
  it('exposes zoom and fit helpers without throwing', () => {
    const ref = createRef<UMLDiagramHandle>();
    renderDiagram({ ref });

    expect(() => {
      ref.current?.zoomIn();
      ref.current?.zoomOut();
      ref.current?.fitToView();
    }).not.toThrow();
  });
});
