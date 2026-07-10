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
import { act, screen, waitFor } from '@testing-library/react';
import { saveMetaModelEcore } from '../../../utils/saveMetaModelEcore';
import type { UMLDiagramHandle } from '../../../components/canvas/UMLDiagram';
import { SIMPLE_ECORE } from './diagramTestFixtures';
import { renderDiagram } from './diagramTestUtils';

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
