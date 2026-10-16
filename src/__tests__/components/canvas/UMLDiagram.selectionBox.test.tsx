/* eslint-disable import/first, testing-library/no-container, testing-library/no-node-access */

jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('../../../testSupport/umlDiagram/mockFactories').saveMetaModelEcoreMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramMinimapMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());

import { fireEvent, screen } from '@testing-library/react';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

// The mocked layout keeps the viewport at x=0, y=0, scale=1 and jsdom places the
// canvas at the page origin, so screen coordinates equal canvas coordinates.
const win = globalThis as unknown as Window;

function canvas(): HTMLElement {
  return screen.getByLabelText('UML diagram canvas');
}

function classBox(className: string): HTMLElement {
  const box = screen.getAllByRole('group').find(candidate => (
    candidate.hasAttribute('data-classbox')
      && candidate.getAttribute('aria-label')?.includes(` ${className}`)
  ));
  if (!box) throw new Error(`Missing class box ${className}`);
  return box;
}

function isSelected(className: string): boolean {
  return classBox(className).getAttribute('aria-selected') === 'true';
}

function boxCorner(className: string): { x: number; y: number } {
  const wrapper = classBox(className).parentElement as HTMLElement;
  return {
    x: Number.parseFloat(wrapper.style.left),
    y: Number.parseFloat(wrapper.style.top),
  };
}

function selectionBox(container: HTMLElement): Element | null {
  return container.querySelector('[data-uml-selection-box]');
}

function viewportTransform(): string {
  return (canvas().firstElementChild as HTMLElement).style.transform;
}

describe('UMLDiagram selection box', () => {
  it('selects every class the box touches while dragging on the empty canvas', () => {
    const { container } = renderDiagram();
    const person = boxCorner('Person');
    const employee = boxCorner('Employee');

    fireEvent.mouseDown(canvas(), { button: 0, clientX: person.x - 20, clientY: person.y - 20 });
    fireEvent.mouseMove(win, { clientX: person.x + 40, clientY: person.y + 40 });

    expect(selectionBox(container)).toBeInTheDocument();
    expect(isSelected('Person')).toBe(true);
    expect(isSelected('Employee')).toBe(false);

    fireEvent.mouseMove(win, { clientX: employee.x + 10, clientY: employee.y + 10 });
    expect(isSelected('Employee')).toBe(true);

    fireEvent.mouseUp(win);

    expect(selectionBox(container)).not.toBeInTheDocument();
    expect(isSelected('Person')).toBe(true);
    expect(isSelected('Employee')).toBe(true);
    expect(container.querySelector('[data-uml-selection-count]')).toHaveTextContent('2 classes selected');
  });

  it('deselects everything on a click on the empty canvas', () => {
    const { container } = renderDiagram();
    fireEvent.click(classBox('Person'));
    expect(container.querySelector('[data-class-edit-panel]')).toBeInTheDocument();

    fireEvent.mouseDown(canvas(), { button: 0, clientX: 5, clientY: 5 });
    fireEvent.mouseUp(win);

    expect(isSelected('Person')).toBe(false);
    expect(container.querySelector('[data-class-edit-panel]')).not.toBeInTheDocument();
    expect(selectionBox(container)).not.toBeInTheDocument();
  });

  it('adds the boxed classes to the selection with Shift+drag', () => {
    renderDiagram();
    const person = boxCorner('Person');
    fireEvent.click(classBox('Employee'));

    fireEvent.mouseDown(canvas(), {
      button: 0,
      shiftKey: true,
      clientX: person.x - 20,
      clientY: person.y - 20,
    });
    fireEvent.mouseMove(win, { clientX: person.x + 40, clientY: person.y + 40 });
    fireEvent.mouseUp(win);

    expect(isSelected('Person')).toBe(true);
    expect(isSelected('Employee')).toBe(true);
  });

  it('pans instead of drawing a box with the middle mouse button', () => {
    const { container } = renderDiagram();
    const before = viewportTransform();

    fireEvent.mouseDown(canvas(), { button: 1, clientX: 5, clientY: 5 });
    fireEvent.mouseMove(win, { clientX: 65, clientY: 45 });
    fireEvent.mouseUp(win);

    expect(viewportTransform()).not.toBe(before);
    expect(selectionBox(container)).not.toBeInTheDocument();
  });

  it('keeps drag-to-pan and draws no box in read-only mode', () => {
    const { container } = renderDiagram({ interactive: false });
    const before = viewportTransform();

    fireEvent.mouseDown(canvas(), { button: 0, clientX: 5, clientY: 5 });
    fireEvent.mouseMove(win, { clientX: 65, clientY: 45 });
    fireEvent.mouseUp(win);

    expect(viewportTransform()).not.toBe(before);
    expect(selectionBox(container)).not.toBeInTheDocument();
    expect(isSelected('Person')).toBe(false);
  });

  it('pans with two-finger scroll and zooms with Cmd+scroll', () => {
    renderDiagram();
    const before = viewportTransform();

    fireEvent.wheel(canvas(), { deltaX: 20, deltaY: 30 });
    const afterPan = viewportTransform();
    expect(afterPan).toContain('translate(-20px, -30px)');
    expect(afterPan).toContain('scale(1)');

    fireEvent.wheel(canvas(), { deltaY: -10, metaKey: true });
    expect(viewportTransform()).not.toContain('scale(1)');
    expect(before).toContain('scale(1)');
  });
});
