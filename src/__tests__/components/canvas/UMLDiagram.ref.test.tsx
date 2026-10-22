vi.mock('../../../utils/ecoreToUml', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).ecoreToUmlMock());
vi.mock('../../../utils/saveMetaModelEcore', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).saveMetaModelEcoreMock());
vi.mock('../../../utils/umlValidation', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlValidationMock());
vi.mock('../../../components/canvas/UMLDiagramMinimap', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlDiagramMinimapMock());
vi.mock('../../../utils/umlDiagramGeometry', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlDiagramGeometryMock());
vi.mock('../../../utils/umlClassLayout', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlClassLayoutMock());
vi.mock('../../../utils/umlLayoutStorage', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlLayoutStorageMock());

import React, { createRef } from 'react';
import type { UMLDiagramHandle } from '../../../components/canvas/UMLDiagram';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

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

