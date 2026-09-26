/* eslint-disable import/first, testing-library/no-container, testing-library/no-node-access */

jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('../../../testSupport/umlDiagram/mockFactories').saveMetaModelEcoreMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramMinimapMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());

import { fireEvent, screen } from '@testing-library/react';
import { REF_ECORE } from '../../../testSupport/umlDiagram/fixtures';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

function classBox(className: string): HTMLElement {
  const box = screen.getAllByRole('group').find(candidate => (
    candidate.hasAttribute('data-classbox')
      && candidate.getAttribute('aria-label')?.includes(` ${className}`)
  ));
  if (!box) throw new Error(`Missing class box ${className}`);
  return box;
}

function relationshipHitLine(container: HTMLElement, relationshipId: string): Element {
  const line = container.querySelector(
    `[data-rel-hit-line][data-rel-id="${relationshipId}"]`,
  );
  if (!line) throw new Error(`Missing relationship ${relationshipId}`);
  return line;
}

function classPanel(container: HTMLElement): Element | null {
  return container.querySelector('[data-class-edit-panel]');
}

function relationshipPanel(container: HTMLElement): Element | null {
  return container.querySelector('[data-rel-edit-panel]');
}

describe('UMLDiagram interaction', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('enters connect mode and cancels the armed connection with Escape', () => {
    const { container } = renderDiagram();

    fireEvent.click(screen.getByTitle('Connect two classes'));
    fireEvent.click(classBox('Employee'));
    expect(container.querySelector('[data-uml-connect-banner]'))
      .toHaveTextContent('Click the target class to create a connection');
    fireEvent.keyDown(globalThis, { key: 'Escape' });

    expect(container.querySelector('[data-uml-connect-banner]')).not.toBeInTheDocument();
    expect(screen.getByTitle('Connect two classes')).toBeInTheDocument();
  });

  it('switches from the class panel to the relationship panel and back without losing edits', () => {
    const { container } = renderDiagram({ ecoreContent: REF_ECORE });

    fireEvent.click(classBox('Order'));
    expect(classPanel(container)).toBeInTheDocument();
    fireEvent.change(container.querySelector('#class-edit-documentation-Order')!, {
      target: { value: 'An order placed by a customer.' },
    });

    fireEvent.click(relationshipHitLine(container, 'rel-order-lines'));
    expect(relationshipPanel(container)).toBeInTheDocument();
    expect(classPanel(container)).not.toBeInTheDocument();

    fireEvent.click(classBox('Order'));
    expect(classPanel(container)).toBeInTheDocument();
    expect(relationshipPanel(container)).not.toBeInTheDocument();
    expect(container.querySelector('#class-edit-documentation-Order'))
      .toHaveValue('An order placed by a customer.');
  });

  it('switches from the relationship panel to the class panel and back without losing edits', () => {
    const { container } = renderDiagram({ ecoreContent: REF_ECORE });

    fireEvent.click(relationshipHitLine(container, 'rel-order-lines'));
    expect(relationshipPanel(container)).toBeInTheDocument();
    fireEvent.change(container.querySelector('#rel-edit-label-rel-order-lines')!, {
      target: { value: 'lines' },
    });

    fireEvent.click(classBox('LineItem'));
    expect(classPanel(container)).toBeInTheDocument();
    expect(relationshipPanel(container)).not.toBeInTheDocument();

    fireEvent.click(relationshipHitLine(container, 'rel-order-lines'));
    expect(relationshipPanel(container)).toBeInTheDocument();
    expect(classPanel(container)).not.toBeInTheDocument();
    expect(container.querySelector('#rel-edit-label-rel-order-lines')).toHaveValue('lines');
  });
});
