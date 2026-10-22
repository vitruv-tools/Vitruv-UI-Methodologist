import React, { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  UMLDiagram,
  type UMLDiagramHandle,
  type UmlDiagramSaveContext,
} from '../../../components/canvas/UMLDiagram';
import { loadUmlLayout } from '../../../utils/umlLayoutStorage';

const ECORE = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" name="shop" nsURI="http://shop" nsPrefix="shop">
  <eClassifiers xsi:type="ecore:EClass" name="Customer"/>
  <eClassifiers xsi:type="ecore:EClass" name="Order"/>
</ecore:EPackage>`;

const SCOPE = 'layout-persistence-test';
const FILE = 'shop.ecore';

function workspaceSaveContext(onSaved = jest.fn()): UmlDiagramSaveContext {
  return { metaModelId: '1', ecoreFileId: 1, modelName: 'shop', saveTarget: 'workspace', onSaved };
}

function renderEditor(saveContext: UmlDiagramSaveContext = workspaceSaveContext()) {
  const view = render(
    <UMLDiagram ecoreContent={ECORE} fileName={FILE} layoutScopeId={SCOPE} saveContext={saveContext} />,
  );
  advance(500);
  return view;
}

function saveButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /Save/ }) as HTMLButtonElement;
}

const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1200 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 800 });
});

afterAll(() => {
  if (originalClientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
  if (originalClientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
});

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
  localStorage.clear();
});

function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

function classBoxes(name: string): HTMLElement[] {
  return screen.getAllByRole('group', { name: new RegExp(`^UML class ${name}`) });
}

/**
 * Position of a class box on screen: canvas transform applied to the box's left/top.
 * Walks up the DOM because neither the positioned wrapper nor the canvas is exposed by role.
 */
function screenPosition(classBox: HTMLElement): { x: number; y: number } {
  let positioned: HTMLElement | null = classBox;
  // eslint-disable-next-line testing-library/no-node-access
  while (positioned && !positioned.style.left) positioned = positioned.parentElement;
  let canvas: HTMLElement | null = positioned;
  // eslint-disable-next-line testing-library/no-node-access
  while (canvas && !canvas.style.transform) canvas = canvas.parentElement;
  const match = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/
    .exec(canvas!.style.transform)!;
  const [vx, vy, scale] = match.slice(1).map(Number);
  return {
    x: Math.round(vx + Number.parseFloat(positioned!.style.left) * scale),
    y: Math.round(vy + Number.parseFloat(positioned!.style.top) * scale),
  };
}

function dragClass(classBox: HTMLElement, dx: number, dy: number) {
  fireEvent.mouseDown(classBox, { clientX: 100, clientY: 100, button: 0 });
  fireEvent.mouseMove(globalThis as unknown as Window, { clientX: 100 + dx, clientY: 100 + dy });
  fireEvent.mouseUp(globalThis as unknown as Window, { clientX: 100 + dx, clientY: 100 + dy });
  advance(500);
}

describe('UMLDiagram layout persistence', () => {
  it('enables Save when a class is moved and saves positions without touching the ecore', () => {
    const onSaved = jest.fn();
    renderEditor(workspaceSaveContext(onSaved));
    const savedBefore = loadUmlLayout(SCOPE, FILE);
    expect(saveButton()).toBeDisabled();

    dragClass(classBoxes('Customer')[0], 150, 250);

    expect(saveButton()).toBeEnabled();
    expect(saveButton()).toHaveAttribute('title', 'Save class positions');
    expect(loadUmlLayout(SCOPE, FILE)?.Customer).toEqual(savedBefore?.Customer);

    fireEvent.click(saveButton());

    expect(screen.getByText('Layout saved')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(loadUmlLayout(SCOPE, FILE)?.Customer).not.toEqual(savedBefore?.Customer);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('goes back to the saved positions when a move is not saved', () => {
    const { unmount } = renderEditor();
    const customerBefore = screenPosition(classBoxes('Customer')[0]);

    dragClass(classBoxes('Customer')[0], 150, 250);
    expect(screenPosition(classBoxes('Customer')[0])).not.toEqual(customerBefore);
    unmount();

    renderEditor();
    expect(screenPosition(classBoxes('Customer')[0])).toEqual(customerBefore);
    expect(saveButton()).toBeDisabled();
  });

  it('keeps saved classes at the same place after a remount when the left-most class was moved', () => {
    const { unmount } = renderEditor();

    dragClass(classBoxes('Customer')[0], 150, 250);
    fireEvent.click(saveButton());
    const customerAfterSave = screenPosition(classBoxes('Customer')[0]);
    const orderAfterSave = screenPosition(classBoxes('Order')[0]);
    unmount();

    renderEditor();

    expect(screenPosition(classBoxes('Customer')[0])).toEqual(customerAfterSave);
    expect(screenPosition(classBoxes('Order')[0])).toEqual(orderAfterSave);
  });

  it('lets a preview pick up positions saved in the editor without overwriting them', () => {
    const previewRef = createRef<UMLDiagramHandle>();
    const { unmount: unmountPreview } = render(
      <UMLDiagram
        ref={previewRef}
        ecoreContent={ECORE}
        fileName={FILE}
        layoutScopeId={SCOPE}
        interactive={false}
      />,
    );
    advance(500);
    const { unmount: unmountEditor } = renderEditor();

    dragClass(classBoxes('Customer')[1], 150, 250);
    fireEvent.click(saveButton());
    const savedPosition = loadUmlLayout(SCOPE, FILE)?.Customer;
    unmountEditor();

    act(() => {
      previewRef.current?.reloadLayout();
    });
    expect(previewRef.current?.isDirty()).toBe(false);
    advance(500);
    unmountPreview();

    expect(loadUmlLayout(SCOPE, FILE)?.Customer).toEqual(savedPosition);
  });
});
