/* eslint-disable import/first */

jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('../../../testSupport/umlDiagram/mockFactories').saveMetaModelEcoreMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramMinimapMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: unknown) => node,
}));

import { createRef } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { UMLDiagramHandle } from '../../../components/canvas/UMLDiagram';
import { FloatingUMLPanel } from '../../../components/canvas/FloatingUMLPanel';
import { UML_PASTE_OFFSET } from '../../../components/canvas/umlClassClipboard';
import { useUmlClassClipboardStore } from '../../../store/UmlClassClipboard';
import { saveMetaModelEcore } from '../../../utils/saveMetaModelEcore';
import { REF_ECORE, SIMPLE_ECORE } from '../../../testSupport/umlDiagram/fixtures';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

const win = globalThis as unknown as Window;

function classBox(className: string, scope: HTMLElement = document.body): HTMLElement {
  const label = new RegExp(String.raw`^UML (class|abstract class|interface) ${className}(,|$)`);
  return within(scope).getByRole('group', { name: label });
}

function isSelected(className: string): boolean {
  return classBox(className).getAttribute('aria-selected') === 'true';
}

function copy(target: Element | Window = win, modifier: 'ctrlKey' | 'metaKey' = 'ctrlKey'): boolean {
  return fireEvent.keyDown(target, { key: 'c', [modifier]: true });
}

function paste(target: Element | Window = win, modifier: 'ctrlKey' | 'metaKey' = 'ctrlKey'): boolean {
  return fireEvent.keyDown(target, { key: 'v', [modifier]: true });
}

/** Clicks an empty spot of the canvas, which sets where Ctrl/Cmd+V pastes. */
function clickCanvas(clientX: number, clientY: number) {
  const canvas = screen.getByRole('region', { name: 'UML diagram canvas' });
  fireEvent.mouseDown(canvas, { clientX, clientY, button: 0 });
  fireEvent.mouseUp(win, { clientX, clientY, button: 0 });
}

function undo() {
  fireEvent.keyDown(win, { key: 'z', ctrlKey: true });
}

function setupDiagram(props: Parameters<typeof renderDiagram>[0] = {}) {
  const ref = createRef<UMLDiagramHandle>();
  const { container } = renderDiagram({ ref, ...props });
  const model = () => ref.current!.getModel();
  const classIds = () => model().classes.map(classItem => classItem.id);
  return { container, ref, model, classIds };
}

beforeEach(() => {
  useUmlClassClipboardStore.setState({ snapshot: null });
  jest.clearAllMocks();
});

describe('UMLDiagram copy and paste', () => {
  it('copies a class with Ctrl+C and pastes it with Ctrl+V as a standalone class', () => {
    const { model, classIds } = setupDiagram();
    const personBefore = structuredClone(model().classes[0]);

    fireEvent.click(classBox('Person'));
    expect(copy()).toBe(false);
    expect(paste()).toBe(false);

    expect(classIds()).toEqual(['Person', 'Employee', 'Person_copy']);
    const { x, y, ...pasted } = model().classes[2];
    const { x: _x, y: _y, ...original } = personBefore;
    expect(pasted).toEqual({
      ...original,
      id: 'Person_copy',
      name: 'Person_copy',
      attributes: [{ ...personBefore.attributes[0], id: 'Person_copy-0' }],
    });
    expect(model().relationships.map(relationship => relationship.id)).toEqual(['rel-inherit']);
    expect(model().classes[0]).toEqual(personBefore);
  });

  it('pastes at the spot the user clicked on the canvas', () => {
    const { model } = setupDiagram();

    fireEvent.click(classBox('Person'));
    copy();
    clickCanvas(500, 400);
    paste();
    clickCanvas(620, 450);
    paste();

    const [firstPaste, secondPaste] = model().classes.slice(2);
    expect(secondPaste.x - firstPaste.x).toBe(120);
    expect(secondPaste.y - firstPaste.y).toBe(50);
  });

  it('moves several pasted classes together to the clicked spot', () => {
    const { model } = setupDiagram();

    fireEvent.click(classBox('Person'), { shiftKey: true });
    fireEvent.click(classBox('Employee'), { shiftKey: true });
    copy();
    clickCanvas(500, 400);
    paste();
    const firstPersonCopy = model().classes[2];
    clickCanvas(700, 500);
    paste();

    const [person, employee, , , personCopy, employeeCopy] = model().classes;
    expect(personCopy.x - firstPersonCopy.x).toBe(200);
    expect(personCopy.y - firstPersonCopy.y).toBe(100);
    expect(employeeCopy.x - personCopy.x).toBe(employee.x - person.x);
    expect(employeeCopy.y - personCopy.y).toBe(employee.y - person.y);
  });

  it('pastes at the spot of the last click on a class', () => {
    const { model } = setupDiagram();

    clickCanvas(500, 400);
    fireEvent.mouseDown(classBox('Person'), { clientX: 560, clientY: 430, button: 0 });
    fireEvent.mouseUp(win, { clientX: 560, clientY: 430, button: 0 });
    fireEvent.click(classBox('Person'));
    copy();
    paste();
    clickCanvas(500, 400);
    paste();

    const [atClass, atCanvas] = model().classes.slice(2);
    expect(atClass.x - atCanvas.x).toBe(60);
    expect(atClass.y - atCanvas.y).toBe(30);
  });

  it('selects the pasted classes', () => {
    setupDiagram();

    fireEvent.click(classBox('Person'));
    copy();
    paste();

    expect(isSelected('Person_copy')).toBe(true);
    expect(isSelected('Person')).toBe(false);
  });

  it('recreates relationships between several copied classes with Cmd+C and Cmd+V', () => {
    const { model, classIds } = setupDiagram();

    fireEvent.click(classBox('Person'), { shiftKey: true });
    fireEvent.click(classBox('Employee'), { shiftKey: true });
    copy(win, 'metaKey');
    paste(win, 'metaKey');

    expect(classIds()).toEqual(['Person', 'Employee', 'Person_copy', 'Employee_copy']);
    expect(model().relationships).toEqual([
      { id: 'rel-inherit', sourceId: 'Employee', targetId: 'Person', type: 'inheritance' },
      { id: 'rel-inherit-copy', sourceId: 'Employee_copy', targetId: 'Person_copy', type: 'inheritance' },
    ]);
    const [person, employee, personCopy, employeeCopy] = model().classes;
    expect(employeeCopy.x - personCopy.x).toBe(employee.x - person.x);
    expect(employeeCopy.y - personCopy.y).toBe(employee.y - person.y);
    expect(isSelected('Person_copy')).toBe(true);
    expect(isSelected('Employee_copy')).toBe(true);
  });

  it('drops relationships to classes that were not copied', () => {
    const { model, classIds } = setupDiagram();

    fireEvent.click(classBox('Employee'));
    copy();
    paste();

    expect(classIds()).toEqual(['Person', 'Employee', 'Employee_copy']);
    expect(model().relationships.map(relationship => relationship.id)).toEqual(['rel-inherit']);
  });

  it('renames again and moves aside when pasting twice at the same spot', () => {
    const { model, classIds } = setupDiagram();

    fireEvent.click(classBox('Person'));
    copy();
    clickCanvas(500, 400);
    paste();
    paste();

    expect(classIds()).toEqual(['Person', 'Employee', 'Person_copy', 'Person_copy2']);
    const [firstPaste, secondPaste] = model().classes.slice(2);
    expect(secondPaste.x - firstPaste.x).toBe(UML_PASTE_OFFSET);
    expect(secondPaste.y - firstPaste.y).toBe(UML_PASTE_OFFSET);
  });

  it('pastes after the copied class was changed or deleted', () => {
    const { classIds } = setupDiagram();

    fireEvent.click(classBox('Person'));
    copy();
    fireEvent.keyDown(win, { key: 'Delete' });
    expect(classIds()).toEqual(['Employee']);

    paste();

    expect(classIds()).toEqual(['Employee', 'Person']);
  });

  it('does nothing when nothing was copied or nothing is selected', () => {
    const { classIds } = setupDiagram();

    expect(paste()).toBe(true);
    expect(copy()).toBe(true);
    expect(paste()).toBe(true);

    expect(classIds()).toEqual(['Person', 'Employee']);
  });

  it('removes everything added by one paste with one undo', () => {
    const { model, classIds } = setupDiagram();

    fireEvent.click(classBox('Person'), { shiftKey: true });
    fireEvent.click(classBox('Employee'), { shiftKey: true });
    copy();
    paste();
    undo();

    expect(classIds()).toEqual(['Person', 'Employee']);
    expect(model().relationships.map(relationship => relationship.id)).toEqual(['rel-inherit']);
  });

  it('marks the diagram as unsaved without saving it', () => {
    const { ref } = setupDiagram({
      saveContext: { metaModelId: '1', ecoreFileId: 42, modelName: 'simple' },
    });
    expect(ref.current!.isDirty()).toBe(false);

    fireEvent.click(classBox('Person'));
    copy();
    paste();

    expect(ref.current!.isDirty()).toBe(true);
    expect(screen.getByTitle('Save metamodel changes')).toBeEnabled();
    expect(saveMetaModelEcore).not.toHaveBeenCalled();
  });

  it('ignores Ctrl+C and Ctrl+V while typing in an input field', () => {
    const { classIds } = setupDiagram();

    fireEvent.click(classBox('Person'));
    copy();
    const input = screen.getByLabelText('Class name');
    input.focus();

    expect(copy(input)).toBe(true);
    expect(paste(input)).toBe(true);

    expect(classIds()).toEqual(['Person', 'Employee']);
  });

  it('is not available when the editor is read-only', () => {
    setupDiagram();
    fireEvent.click(classBox('Person'));
    copy();
    const snapshot = useUmlClassClipboardStore.getState().snapshot;
    expect(snapshot?.classes.map(classItem => classItem.id)).toEqual(['Person']);

    const { container: readOnlyContainer } = render(
      <FloatingUMLPanel
        id="read-only"
        title="Read only"
        fileName="read-only.ecore"
        layoutScopeId="test"
        ecoreContent={REF_ECORE}
        viewOnly
        zIndex={1}
        onFocus={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    paste();

    expect(within(readOnlyContainer).getAllByRole('group', { name: /^UML class/ })).toHaveLength(2);
    fireEvent.click(classBox('Order', readOnlyContainer));
    expect(within(readOnlyContainer).queryByRole('button', { name: 'Duplicate class' })).not.toBeInTheDocument();
  });

  it('pastes only into the editor that was used last', () => {
    const first = setupDiagram();
    const second = setupDiagram({ ecoreContent: REF_ECORE });

    const person = classBox('Person', first.container);
    fireEvent.mouseDown(person);
    fireEvent.click(person);
    copy();
    paste();

    expect(first.classIds()).toEqual(['Person', 'Employee', 'Person_copy']);
    expect(second.classIds()).toEqual(['Order', 'LineItem']);
  });
});

describe('UMLDiagram duplicate', () => {
  function duplicateButton(): HTMLElement {
    return screen.getByRole('button', { name: 'Duplicate class' });
  }

  it('duplicates a class in one step from the edit panel', () => {
    const { model, classIds } = setupDiagram();
    const person = model().classes[0];

    fireEvent.click(classBox('Person'));
    fireEvent.click(duplicateButton());

    expect(classIds()).toEqual(['Person', 'Employee', 'Person_copy']);
    expect(model().classes[2]).toEqual(expect.objectContaining({
      name: 'Person_copy',
      attributes: [{ ...person.attributes[0], id: 'Person_copy-0' }],
      x: person.x + UML_PASTE_OFFSET,
      y: person.y + UML_PASTE_OFFSET,
    }));
    expect(model().relationships.map(relationship => relationship.id)).toEqual(['rel-inherit']);
    expect(isSelected('Person_copy')).toBe(true);

    undo();
    expect(classIds()).toEqual(['Person', 'Employee']);
  });

  it('does not change what was copied', () => {
    const { classIds } = setupDiagram();

    fireEvent.click(classBox('Employee'));
    copy();
    fireEvent.click(classBox('Person'));
    fireEvent.click(duplicateButton());
    paste();

    expect(classIds()).toEqual(['Person', 'Employee', 'Person_copy', 'Employee_copy']);
  });
});

describe('full-screen UML editor', () => {
  it('removes only the pasted classes with one Ctrl+Z', () => {
    render(
      <FloatingUMLPanel
        id="panel"
        title="Project model"
        fileName="simple.ecore"
        layoutScopeId="test"
        ecoreContent={SIMPLE_ECORE}
        zIndex={1}
        onFocus={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    const classCount = () => screen.getAllByRole('group', { name: /^UML class/ }).length;

    fireEvent.click(screen.getByTitle('Add class'));
    fireEvent.click(classBox('Person'));
    copy();
    paste();
    expect(classCount()).toBe(4);

    undo();

    expect(classCount()).toBe(3);
    expect(screen.queryByRole('group', { name: /^UML class Person_copy/ })).not.toBeInTheDocument();
  });
});
