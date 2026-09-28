/* eslint-disable import/first, testing-library/no-container, testing-library/no-node-access */

jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('../../../testSupport/umlDiagram/mockFactories').saveMetaModelEcoreMock());
jest.mock('../../../utils/umlValidation', () => require('../../../testSupport/umlDiagram/mockFactories').umlValidationMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramMinimapMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());

import React, { createRef } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import type { UMLDiagramHandle } from '../../../components/canvas/UMLDiagram';
import type { UMLModel } from '../../../utils/ecoreToUml';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

type DiagramRef = React.RefObject<UMLDiagramHandle | null>;

function renderEditingDiagram() {
  const diagramRef = createRef<UMLDiagramHandle>();
  const view = renderDiagram({ ref: diagramRef });
  return { ...view, diagramRef };
}

function currentModel(diagramRef: DiagramRef): UMLModel {
  const model = diagramRef.current?.getModel();
  if (!model) throw new Error('Expected the UMLDiagram imperative handle');
  return model;
}

function classBox(className: string): HTMLElement {
  const box = screen.getAllByRole('group').find(candidate => (
    candidate.hasAttribute('data-classbox')
      && candidate.getAttribute('aria-label')?.includes(` ${className}`)
  ));
  if (!box) throw new Error(`Missing class box ${className}`);
  return box;
}

function connectClasses(source: string, target: string): void {
  fireEvent.click(screen.getByTitle('Connect two classes'));
  fireEvent.click(classBox(source));
  fireEvent.click(classBox(target));
}

function undo(diagramRef: DiagramRef): void {
  act(() => diagramRef.current?.undo());
}

describe('UMLDiagram primary editing', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates, edits, deletes, and restores an association with keyboard history', () => {
    jest.spyOn(Date, 'now').mockReturnValue(5001);
    const { container, diagramRef } = renderEditingDiagram();
    const selectAssociation = () => fireEvent.click(container.querySelector(
      '[data-rel-hit-line][data-rel-id="rel-5001"]',
    ) as Element);

    connectClasses('Person', 'Employee');
    expect(currentModel(diagramRef).relationships).toContainEqual(expect.objectContaining({
      id: 'rel-5001', sourceId: 'Person', targetId: 'Employee', type: 'association',
    }));

    selectAssociation();
    fireEvent.change(screen.getByLabelText('Connection name'), { target: { value: 'manages' } });
    fireEvent.keyDown(globalThis, { key: 'z', ctrlKey: true });
    expect(currentModel(diagramRef).relationships.find(({ id }) => id === 'rel-5001'))
      .not.toHaveProperty('label');
    fireEvent.keyDown(globalThis, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(currentModel(diagramRef).relationships).toContainEqual(
      expect.objectContaining({ id: 'rel-5001', label: 'manages' }),
    );

    selectAssociation();
    fireEvent.keyDown(globalThis, { key: 'Delete' });
    expect(currentModel(diagramRef).relationships.some(({ id }) => id === 'rel-5001')).toBe(false);

    undo(diagramRef);
    expect(currentModel(diagramRef).relationships).toContainEqual(
      expect.objectContaining({ id: 'rel-5001', label: 'manages' }),
    );
  });
});
