jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('../../../testSupport/umlDiagram/mockFactories').saveMetaModelEcoreMock());
jest.mock('../../../utils/umlValidation', () => require('../../../testSupport/umlDiagram/mockFactories').umlValidationMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramMinimapMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());

import React, { createRef } from 'react';
import { act, screen, waitFor } from '@testing-library/react';
import { saveMetaModelEcore } from '../../../utils/saveMetaModelEcore';
import type { UMLDiagramHandle } from '../../../components/canvas/UMLDiagram';
import { SIMPLE_ECORE } from '../../../testSupport/umlDiagram/fixtures';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

describe('UMLDiagram save', () => {
  it('workspace save calls onSaved without hitting the library API', async () => {
    const ref = createRef<UMLDiagramHandle>();
    const onSaved = jest.fn();

    renderDiagram({
      ref,
      ecoreContent: SIMPLE_ECORE,
      saveContext: {
        metaModelId: '1',
        ecoreFileId: 42,
        modelName: 'simple',
        saveTarget: 'workspace',
        onSaved,
      },
    });

    await act(async () => {
      await ref.current?.save();
    });

    await waitFor(() => {
      expect(saveMetaModelEcore).not.toHaveBeenCalled();
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ ecoreFileId: 42 }));
    });
    expect(screen.getByText('Saved to project')).toBeInTheDocument();
  });
});

