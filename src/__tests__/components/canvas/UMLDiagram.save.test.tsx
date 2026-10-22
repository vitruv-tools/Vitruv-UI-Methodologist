vi.mock('../../../utils/ecoreToUml', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).ecoreToUmlMock());
vi.mock('../../../utils/saveMetaModelEcore', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).saveMetaModelEcoreMock());
vi.mock('../../../utils/umlValidation', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlValidationMock());
vi.mock('../../../components/canvas/UMLDiagramMinimap', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlDiagramMinimapMock());
vi.mock('../../../utils/umlDiagramGeometry', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlDiagramGeometryMock());
vi.mock('../../../utils/umlClassLayout', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlClassLayoutMock());
vi.mock('../../../utils/umlLayoutStorage', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlLayoutStorageMock());

import React, { createRef } from 'react';
import { act, screen, waitFor } from '@testing-library/react';
import { saveMetaModelEcore } from '../../../utils/saveMetaModelEcore';
import type { UMLDiagramHandle } from '../../../components/canvas/UMLDiagram';
import { SIMPLE_ECORE } from '../../../testSupport/umlDiagram/fixtures';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

describe('UMLDiagram save', () => {
  it('workspace save calls onSaved without hitting the library API', async () => {
    const ref = createRef<UMLDiagramHandle>();
    const onSaved = vi.fn();

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

  it('workspace save persists the serialized ecore before reporting success', async () => {
    const ref = createRef<UMLDiagramHandle>();
    const onSaved = vi.fn();
    const persistWorkspaceEcore = vi.fn().mockResolvedValue(undefined);

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

    expect(persistWorkspaceEcore).toHaveBeenCalledTimes(1);
    const persisted = persistWorkspaceEcore.mock.calls[0][0];
    expect(typeof persisted).toBe('string');
    expect(onSaved).toHaveBeenCalledWith({ ecoreContent: persisted, ecoreFileId: 42 });
    expect(screen.getByText('Saved to project')).toBeInTheDocument();
  });

  it('workspace save shows the backend error and keeps changes unsaved when persisting fails', async () => {
    const ref = createRef<UMLDiagramHandle>();
    const onSaved = vi.fn();
    const onError = vi.fn();
    const persistWorkspaceEcore = vi.fn().mockRejectedValue(new Error('Access denied'));

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
        onError,
      },
    });

    await act(async () => {
      await ref.current?.save();
    });

    expect(onSaved).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('Access denied');
    expect(screen.getByText('Access denied')).toBeInTheDocument();
    expect(screen.queryByText('Saved to project')).not.toBeInTheDocument();
  });
});

