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
  it('workspace save sends the ecore to the project copy', async () => {
    const ref = createRef<UMLDiagramHandle>();
    const onSaved = jest.fn();
    const persistWorkspaceEcore = jest.fn().mockResolvedValue(undefined);

    renderDiagram({
      ref,
      ecoreContent: SIMPLE_ECORE,
      saveContext: {
        metaModelId: '1',
        ecoreFileId: 42,
        modelName: 'simple',
        saveTarget: 'workspace',
        persistWorkspaceEcore,
        onSaved,
      },
    });

    await act(async () => {
      await ref.current?.save();
    });

    await waitFor(() => {
      expect(persistWorkspaceEcore).toHaveBeenCalledWith(expect.stringContaining('name="Person"'));
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
        ecoreFileId: 42,
        ecoreContent: expect.stringContaining('name="Person"'),
      }));
    });
    expect(saveMetaModelEcore).not.toHaveBeenCalled();
    expect(screen.getByText('Saved to project')).toBeInTheDocument();
  });

  it('keeps the open diagram when the project rejects the save', async () => {
    const ref = createRef<UMLDiagramHandle>();
    const onSaved = jest.fn();
    const persistWorkspaceEcore = jest.fn().mockRejectedValue(new Error('Access denied'));

    renderDiagram({
      ref,
      ecoreContent: SIMPLE_ECORE,
      saveContext: {
        metaModelId: '1',
        ecoreFileId: 42,
        modelName: 'simple',
        saveTarget: 'workspace',
        persistWorkspaceEcore,
        onSaved,
      },
    });

    await act(async () => {
      await ref.current?.save();
    });

    expect(screen.getByText('Access denied')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(ref.current?.getModel().classes.map(classItem => classItem.name)).toEqual([
      'Person',
      'Employee',
    ]);
  });
});
