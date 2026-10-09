/* eslint-disable import/first, testing-library/no-container, testing-library/no-node-access */

jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('../../../testSupport/umlDiagram/mockFactories').saveMetaModelEcoreMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramMinimapMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());

import { createRef } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import type { UMLDiagramHandle } from '../../../components/canvas/UMLDiagram';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

const win = globalThis as unknown as Window;

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

function classPanel(container: HTMLElement): Element | null {
  return container.querySelector('[data-class-edit-panel]');
}

function selectionCount(container: HTMLElement): Element | null {
  return container.querySelector('[data-uml-selection-count]');
}

function boxLeft(className: string): number {
  return Number.parseFloat((classBox(className).parentElement as HTMLElement).style.left);
}

function boxTop(className: string): number {
  return Number.parseFloat((classBox(className).parentElement as HTMLElement).style.top);
}

function dragClass(className: string, dx: number, dy: number) {
  fireEvent.mouseDown(classBox(className), { clientX: 100, clientY: 100, button: 0 });
  fireEvent.mouseMove(win, { clientX: 100 + dx, clientY: 100 + dy });
  fireEvent.mouseUp(win, { clientX: 100 + dx, clientY: 100 + dy });
}

function undo() {
  fireEvent.keyDown(win, { key: 'z', ctrlKey: true });
}

describe('UMLDiagram multi-selection', () => {
  it('adds classes to the selection with Shift+click and Cmd+click', () => {
    const { container } = renderDiagram();

    fireEvent.click(classBox('Person'));
    fireEvent.click(classBox('Employee'), { shiftKey: true });

    expect(isSelected('Person')).toBe(true);
    expect(isSelected('Employee')).toBe(true);

    fireEvent.click(classBox('Employee'), { metaKey: true });
    expect(isSelected('Employee')).toBe(false);

    fireEvent.click(classBox('Employee'), { metaKey: true });
    expect(isSelected('Person')).toBe(true);
    expect(isSelected('Employee')).toBe(true);
    expect(selectionCount(container)).toHaveTextContent('2 classes selected');
  });

  it('hides the edit panel while several classes are selected', () => {
    const { container } = renderDiagram();

    fireEvent.click(classBox('Person'));
    expect(classPanel(container)).toBeInTheDocument();

    fireEvent.click(classBox('Employee'), { shiftKey: true });
    expect(classPanel(container)).not.toBeInTheDocument();

    fireEvent.click(classBox('Employee'), { shiftKey: true });
    expect(classPanel(container)).toBeInTheDocument();
    expect(selectionCount(container)).not.toBeInTheDocument();
  });

  it('narrows the selection to one class on a plain click', () => {
    renderDiagram();

    fireEvent.click(classBox('Person'), { shiftKey: true });
    fireEvent.click(classBox('Employee'), { shiftKey: true });
    fireEvent.click(classBox('Employee'));

    expect(isSelected('Person')).toBe(false);
    expect(isSelected('Employee')).toBe(true);
  });

  it('narrows the selection instead of renaming when a selected class name is clicked', () => {
    renderDiagram();

    fireEvent.click(classBox('Person'), { shiftKey: true });
    fireEvent.click(classBox('Employee'), { shiftKey: true });
    fireEvent.click(screen.getByRole('button', { name: /Class name: Person/ }));

    expect(isSelected('Person')).toBe(true);
    expect(isSelected('Employee')).toBe(false);
    expect(screen.queryByRole('textbox', { name: 'Class name for Person' })).not.toBeInTheDocument();
  });

  it('clears the whole selection with Escape', () => {
    const { container } = renderDiagram();

    fireEvent.click(classBox('Person'), { shiftKey: true });
    fireEvent.click(classBox('Employee'), { shiftKey: true });
    fireEvent.keyDown(win, { key: 'Escape' });

    expect(isSelected('Person')).toBe(false);
    expect(isSelected('Employee')).toBe(false);
    expect(selectionCount(container)).not.toBeInTheDocument();
  });

  it('deletes all selected classes and their relationships as one undo step', () => {
    const ref = createRef<UMLDiagramHandle>();
    renderDiagram({ ref });

    fireEvent.click(classBox('Person'), { shiftKey: true });
    fireEvent.click(classBox('Employee'), { shiftKey: true });
    fireEvent.keyDown(win, { key: 'Delete' });

    expect(ref.current!.getModel().classes).toHaveLength(0);
    expect(ref.current!.getModel().relationships).toHaveLength(0);

    undo();

    expect(ref.current!.getModel().classes.map(c => c.id)).toEqual(['Person', 'Employee']);
    expect(ref.current!.getModel().relationships.map(r => r.id)).toEqual(['rel-inherit']);
  });

  it('deletes the selection with the toolbar delete button', () => {
    const ref = createRef<UMLDiagramHandle>();
    renderDiagram({ ref });

    fireEvent.click(classBox('Person'), { shiftKey: true });
    fireEvent.click(classBox('Employee'), { shiftKey: true });
    fireEvent.click(screen.getByTitle('Delete selected class or connection'));

    expect(ref.current!.getModel().classes).toHaveLength(0);
  });

  it('moves all selected classes together when one of them is dragged', () => {
    renderDiagram();
    const personBefore = { x: boxLeft('Person'), y: boxTop('Person') };
    const employeeBefore = { x: boxLeft('Employee'), y: boxTop('Employee') };

    fireEvent.click(classBox('Person'), { shiftKey: true });
    fireEvent.click(classBox('Employee'), { shiftKey: true });
    dragClass('Person', 60, 40);

    const personDelta = { x: boxLeft('Person') - personBefore.x, y: boxTop('Person') - personBefore.y };
    const employeeDelta = { x: boxLeft('Employee') - employeeBefore.x, y: boxTop('Employee') - employeeBefore.y };
    expect(personDelta.x).not.toBe(0);
    expect(employeeDelta).toEqual(personDelta);
    expect(isSelected('Person')).toBe(true);
    expect(isSelected('Employee')).toBe(true);

    undo();

    expect({ x: boxLeft('Person'), y: boxTop('Person') }).toEqual(personBefore);
    expect({ x: boxLeft('Employee'), y: boxTop('Employee') }).toEqual(employeeBefore);
  });

  it('moves only the dragged class when it is not part of the selection', () => {
    renderDiagram();
    const employeeBefore = boxLeft('Employee');
    const personBefore = boxLeft('Person');

    fireEvent.click(classBox('Employee'));
    dragClass('Person', 60, 40);

    expect(boxLeft('Person')).not.toBe(personBefore);
    expect(boxLeft('Employee')).toBe(employeeBefore);
  });

  it('ignores Shift+click in read-only mode', () => {
    const { container } = renderDiagram({ interactive: false });

    fireEvent.click(classBox('Person'), { shiftKey: true });
    fireEvent.click(classBox('Employee'), { shiftKey: true });

    expect(isSelected('Person')).toBe(false);
    expect(isSelected('Employee')).toBe(false);
    expect(selectionCount(container)).not.toBeInTheDocument();
  });
});
