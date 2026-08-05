/* eslint-disable import/first, testing-library/no-container, testing-library/no-node-access */

const mockScheduleDebouncedLayoutSave = jest.fn();
const mockScheduleLayoutSave = jest.fn();
const mockGetCurrentViewport = jest.fn(() => ({ x: 20, y: 30, scale: 2 }));
const mockGetCurrentLayoutOffset = jest.fn(() => ({ offsetX: 100, offsetY: 80 }));

jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('../../../testSupport/umlDiagram/mockFactories').saveMetaModelEcoreMock());
jest.mock('../../../utils/umlValidation', () => require('../../../testSupport/umlDiagram/mockFactories').umlValidationMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramMinimapMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());
jest.mock('../../../hooks/useUmlDiagramViewport', () => ({
  useUmlDiagramViewport: (options: { onBeforePan: () => void }) => {
    const mockReact = require('react');
    const containerRef = mockReact.useRef(null);
    mockReact.useEffect(() => {
      const element = containerRef.current as HTMLElement | null;
      if (!element) return undefined;
      const handleMouseDown = () => options.onBeforePan();
      element.addEventListener('mousedown', handleMouseDown);
      return () => element.removeEventListener('mousedown', handleMouseDown);
    }, [options.onBeforePan]);
    return {
      containerRef,
      vx: 0,
      vy: 0,
      vscale: 1,
      panning: false,
      layout: {
        totalW: 1400, totalH: 900, minX: 0, minY: 0,
        maxX: 1200, maxY: 700, offsetX: 100, offsetY: 80,
      },
      zoomIn: jest.fn(),
      zoomOut: jest.fn(),
      fitToView: jest.fn(),
      clientToDiagram: (x: number, y: number) => ({ x, y }),
      handleMinimapPan: jest.fn(),
      persistLayout: jest.fn(),
      scheduleLayoutSave: mockScheduleLayoutSave,
      scheduleDebouncedLayoutSave: mockScheduleDebouncedLayoutSave,
      getCurrentViewport: mockGetCurrentViewport,
      restoreViewportAfterReload: jest.fn(),
      getCurrentLayoutOffset: mockGetCurrentLayoutOffset,
    };
  },
}));

import React, { createRef } from 'react';
import { act, fireEvent, screen, within, type RenderResult } from '@testing-library/react';
import type { UMLDiagramHandle } from '../../../components/canvas/UMLDiagram';
import type { UMLModel } from '../../../utils/ecoreToUml';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

type DiagramRef = React.RefObject<UMLDiagramHandle | null>;

interface RenderedEditingDiagram extends RenderResult {
  diagramRef: DiagramRef;
  diagramElement: HTMLElement;
}

function renderEditingDiagram(
  props: Parameters<typeof renderDiagram>[0] = {},
): RenderedEditingDiagram {
  const diagramRef = createRef<UMLDiagramHandle>();
  const view = renderDiagram({
    ref: diagramRef,
    fileName: 'primary-editing.ecore',
    layoutScopeId: 'primary-editing',
    ...props,
  });
  const diagramElement = view.container.firstElementChild as HTMLElement;
  Object.defineProperties(diagramElement, {
    clientWidth: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 800 },
  });
  return { ...view, diagramRef, diagramElement };
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

function classNameButton(className: string): HTMLElement {
  return classView(className).getByRole('button', {
    name: new RegExp(`^Class name: ${className}\\.`),
  });
}

function classView(className: string) {
  return within(classBox(className));
}

function selectClass(className: string): void {
  fireEvent.click(classBox(className));
}

function clickToolbar(title: string): void {
  fireEvent.click(screen.getByTitle(title));
}

function changeValue(element: Element, value: string): void {
  fireEvent.change(element, { target: { value } });
}

function undo(diagramRef: DiagramRef): void {
  act(() => diagramRef.current?.undo());
}

function redo(diagramRef: DiagramRef): void {
  act(() => diagramRef.current?.redo());
}

function connectClasses(source: string, target: string): void {
  clickToolbar('Connect two classes');
  selectClass(source);
  selectClass(target);
}

function modelClass(model: UMLModel, classId: string) {
  const classItem = model.classes.find(candidate => candidate.id === classId);
  if (!classItem) throw new Error(`Missing class ${classId}`);
  return classItem;
}

function diagramClass(diagramRef: DiagramRef, classId: string) {
  return modelClass(currentModel(diagramRef), classId);
}

function relationships(diagramRef: DiagramRef) {
  return currentModel(diagramRef).relationships;
}

describe('UMLDiagram primary editing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentViewport.mockReturnValue({ x: 20, y: 30, scale: 2 });
    mockGetCurrentLayoutOffset.mockReturnValue({ offsetX: 100, offsetY: 80 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('trims and saves inline class names, remaps identity, and ignores a later blank save', () => {
    const { diagramRef } = renderEditingDiagram();
    selectClass('Person');
    fireEvent.doubleClick(classNameButton('Person'));

    const input = screen.getByRole('textbox', { name: 'Class name for Person' });
    changeValue(input, '  Renamed Person  ');
    fireEvent.keyDown(input, { key: 'Enter' });

    const renamed = currentModel(diagramRef);
    expect(modelClass(renamed, 'Renamed_Person')).toMatchObject({
      name: 'Renamed Person',
      attributes: [expect.objectContaining({ id: 'Renamed_Person-0' })],
    });
    expect(renamed.relationships).toContainEqual(expect.objectContaining({
      id: 'rel-inherit', sourceId: 'Employee', targetId: 'Renamed_Person',
    }));
    expect(classBox('Renamed Person')).toHaveAttribute('aria-selected', 'true');

    fireEvent.doubleClick(classNameButton('Renamed Person'));
    const blankInput = screen.getByRole('textbox', { name: 'Class name for Renamed Person' });
    changeValue(blankInput, '   ');
    fireEvent.keyDown(blankInput, { key: 'Enter' });

    expect(screen.queryByRole('textbox', { name: 'Class name for Renamed Person' }))
      .not.toBeInTheDocument();
    expect(diagramClass(diagramRef, 'Renamed_Person').name).toBe('Renamed Person');
    undo(diagramRef);
    expect(diagramClass(diagramRef, 'Person').name).toBe('Person');
  });

  it('commits pending name, attribute, and operation edits through canvas blur and cancels without mutation', () => {
    const { diagramRef, diagramElement } = renderEditingDiagram();

    fireEvent.doubleClick(classNameButton('Person'));
    changeValue(screen.getByRole('textbox', { name: 'Class name for Person' }), 'Agent');
    fireEvent.mouseDown(diagramElement);
    expect(diagramClass(diagramRef, 'Agent').name).toBe('Agent');

    const attributeRow = classView('Agent').getByRole('button', {
      name: 'Attribute name: String. Press Enter to edit.',
    });
    fireEvent.doubleClick(attributeRow);
    changeValue(classView('Agent').getByRole('textbox'), 'age');
    fireEvent.mouseDown(diagramElement);
    expect(diagramClass(diagramRef, 'Agent').attributes[0].name).toBe('age');

    fireEvent.click(classView('Agent').getByRole('button', { name: 'Add operation' }));
    changeValue(classView('Agent').getByRole('textbox'), 'calculate');
    fireEvent.mouseDown(diagramElement);
    expect(diagramClass(diagramRef, 'Agent').operations[0].name).toBe('calculate');

    fireEvent.doubleClick(classView('Agent').getByRole('button', {
      name: 'Operation calculate: Void. Press Enter to edit.',
    }));
    changeValue(classView('Agent').getByRole('textbox'), 'discarded');
    fireEvent.keyDown(classView('Agent').getByRole('textbox'), { key: 'Escape' });
    expect(diagramClass(diagramRef, 'Agent').operations[0].name).toBe('calculate');
  });

  it('preserves attribute defaults, IDs, unique names, normalization, deletion, and undo', () => {
    jest.spyOn(Date, 'now').mockReturnValueOnce(1001).mockReturnValueOnce(1002);
    const { diagramRef } = renderEditingDiagram();
    selectClass('Person');
    const person = () => diagramClass(diagramRef, 'Person');
    const addAttribute = () => fireEvent.click(classView('Person')
      .getByRole('button', { name: 'Add attribute' }));

    addAttribute();
    expect(person().attributes[1]).toEqual({
      id: 'Person-1001', name: 'attribute', type: 'String', visibility: '+',
    });
    fireEvent.keyDown(classView('Person').getByRole('textbox'), { key: 'Enter' });
    addAttribute();
    expect(person().attributes[2]).toEqual({
      id: 'Person-1002', name: 'attribute2', type: 'String', visibility: '+',
    });

    const secondInput = classView('Person').getByRole('textbox');
    changeValue(secondInput, ' name ');
    changeValue(classView('Person').getByTitle('Visibility'), '#');
    expect(person().attributes[2]).toMatchObject({
      name: 'name2', type: 'String', visibility: '#',
    });

    fireEvent.doubleClick(classView('Person').getByRole('button', {
      name: 'Attribute name2: String. Press Enter to edit.',
    }));
    changeValue(classView('Person').getByTitle('Attribute type (primitive only)'), 'Int');
    expect(person().attributes[2].type).toBe('Int');

    fireEvent.doubleClick(classView('Person').getByRole('button', {
      name: 'Attribute name2: Int. Press Enter to edit.',
    }));
    const blankInput = classView('Person').getByRole('textbox');
    changeValue(blankInput, '   ');
    fireEvent.blur(blankInput);
    expect(person().attributes[2]).toMatchObject({ name: 'name2', type: 'Int' });

    const targetRow = classView('Person').getByRole('button', {
      name: 'Attribute name2: Int. Press Enter to edit.',
    }).parentElement as HTMLElement;
    fireEvent.click(within(targetRow).getByRole('button', { name: 'Delete attribute' }));
    expect(person().attributes.map(attribute => attribute.name)).toEqual(['name', 'attribute']);

    undo(diagramRef);
    expect(person().attributes.map(attribute => attribute.name))
      .toEqual(['name', 'attribute', 'name2']);
  });

  it('preserves operation defaults, IDs, unique names, normalization, deletion, and undo', () => {
    jest.spyOn(Date, 'now').mockReturnValueOnce(2001).mockReturnValueOnce(2002);
    const { diagramRef } = renderEditingDiagram();
    selectClass('Person');
    const person = () => diagramClass(diagramRef, 'Person');
    const addOperation = () => fireEvent.click(classView('Person')
      .getByRole('button', { name: 'Add operation' }));

    addOperation();
    expect(person().operations[0]).toEqual({
      id: 'Person-op-2001', name: 'operation', returnType: 'Void', visibility: '+',
    });
    fireEvent.keyDown(classView('Person').getByRole('textbox'), { key: 'Enter' });
    addOperation();
    expect(person().operations[1]).toEqual({
      id: 'Person-op-2002', name: 'operation2', returnType: 'Void', visibility: '+',
    });

    const secondInput = classView('Person').getByRole('textbox');
    changeValue(secondInput, ' operation ');
    const [visibilitySelect] = classView('Person').getAllByRole('combobox');
    changeValue(visibilitySelect, '-');
    expect(person().operations[1]).toMatchObject({
      name: 'operation2', returnType: 'Void', visibility: '-',
    });

    fireEvent.doubleClick(classView('Person').getByRole('button', {
      name: 'Operation operation2: Void. Press Enter to edit.',
    }));
    const [, returnTypeSelect] = classView('Person').getAllByRole('combobox');
    changeValue(returnTypeSelect, 'Int');
    expect(person().operations[1].returnType).toBe('Int');

    fireEvent.doubleClick(classView('Person').getByRole('button', {
      name: 'Operation operation2: Int. Press Enter to edit.',
    }));
    const blankInput = classView('Person').getByRole('textbox');
    changeValue(blankInput, '   ');
    fireEvent.blur(blankInput);
    expect(person().operations[1]).toMatchObject({ name: 'operation2', returnType: 'Int' });

    const targetRow = classView('Person').getByRole('button', {
      name: 'Operation operation: Void. Press Enter to edit.',
    }).parentElement as HTMLElement;
    fireEvent.click(within(targetRow).getByRole('button', { name: 'Delete operation' }));
    expect(person().operations.map(operation => operation.name)).toEqual(['operation2']);

    undo(diagramRef);
    expect(person().operations.map(operation => operation.name)).toEqual(['operation', 'operation2']);
  });

  it('renames and patches classes through the panel while remapping relationships and connect source', () => {
    jest.spyOn(Date, 'now').mockReturnValue(3001);
    const { diagramRef } = renderEditingDiagram();

    clickToolbar('Connect two classes');
    selectClass('Person');
    changeValue(screen.getByLabelText('Class name'), '  Human Being  ');

    const renamed = diagramClass(diagramRef, 'Human_Being');
    expect(renamed).toMatchObject({
      name: 'Human Being',
      attributes: [expect.objectContaining({ id: 'Human_Being-0' })],
    });
    expect(relationships(diagramRef)[0]).toMatchObject({
      sourceId: 'Employee', targetId: 'Human_Being',
    });
    expect(classBox('Human Being')).toHaveAttribute('aria-selected', 'true');

    selectClass('Employee');
    expect(relationships(diagramRef)).toContainEqual({
      id: 'rel-3001', sourceId: 'Human_Being', targetId: 'Employee',
      type: 'association', sourceMultiplicity: '1', targetMultiplicity: '0..1',
    });

    selectClass('Human Being');
    fireEvent.click(screen.getByLabelText('Abstract class'));
    fireEvent.click(screen.getByLabelText('Interface'));
    expect(diagramClass(diagramRef, 'Human_Being')).toMatchObject({
      isAbstract: true, isInterface: true,
    });
  });

  it('replaces, clears, and assigns inheritance while keeping self out of the panel', () => {
    jest.spyOn(Date, 'now').mockReturnValueOnce(4001).mockReturnValueOnce(4002);
    const { diagramRef } = renderEditingDiagram();
    clickToolbar('Add class');
    selectClass('Employee');

    const parentSelect = screen.getByLabelText('Superclass (inheritance)');
    expect(parentSelect).toHaveValue('Person');
    expect(within(parentSelect).queryByRole('option', { name: 'Employee' }))
      .not.toBeInTheDocument();

    changeValue(parentSelect, 'NewClass');
    expect(relationships(diagramRef).filter(relationship => (
      relationship.type === 'inheritance' && relationship.sourceId === 'Employee'
    ))).toEqual([{
      id: 'rel-4001', sourceId: 'Employee', targetId: 'NewClass', type: 'inheritance',
    }]);

    changeValue(screen.getByLabelText('Superclass (inheritance)'), '');
    expect(relationships(diagramRef).some(relationship => (
      relationship.type === 'inheritance' && relationship.sourceId === 'Employee'
    ))).toBe(false);

    changeValue(screen.getByLabelText('Superclass (inheritance)'), 'Person');
    expect(relationships(diagramRef)).toContainEqual({
      id: 'rel-4002', sourceId: 'Employee', targetId: 'Person', type: 'inheritance',
    });
  });

  it('deletes a selected class with connected relationships, closes its editor, and supports undo', () => {
    const { diagramRef } = renderEditingDiagram();
    selectClass('Employee');
    expect(screen.getByRole('dialog', { name: 'Edit class Employee' }))
      .toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete class' }));
    expect(currentModel(diagramRef).classes.map(classItem => classItem.id))
      .toEqual(['Person']);
    expect(relationships(diagramRef)).toEqual([]);
    expect(screen.queryByRole('dialog', { name: 'Edit class Employee' }))
      .not.toBeInTheDocument();
    expect(screen.getByTitle('Delete selected class or connection'))
      .toBeDisabled();

    undo(diagramRef);
    expect(currentModel(diagramRef).classes.map(classItem => classItem.id))
      .toEqual(['Person', 'Employee']);
    expect(relationships(diagramRef)).toContainEqual(
      expect.objectContaining({ id: 'rel-inherit' }),
    );
  });

  it('adds uniquely named default classes at the current viewport center and selects them', () => {
    const { diagramRef } = renderEditingDiagram();

    clickToolbar('Add class');
    clickToolbar('Add class');
    clickToolbar('Add class');

    const added = currentModel(diagramRef).classes.slice(-3);
    expect(added.map(classItem => classItem.name)).toEqual(['NewClass', 'NewClass1', 'NewClass2']);
    expect(added.map(classItem => classItem.id)).toEqual(['NewClass', 'NewClass1', 'NewClass2']);
    for (const classItem of added) {
      expect(classItem).toMatchObject({
        isAbstract: false, isInterface: false, attributes: [], operations: [],
        x: -4, y: 33,
      });
    }
    expect(classBox('NewClass2')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('dialog', { name: 'Edit class NewClass2' }))
      .toBeInTheDocument();
    expect(mockGetCurrentViewport).toHaveBeenCalledTimes(3);
    expect(mockGetCurrentLayoutOffset).toHaveBeenCalledTimes(3);

    undo(diagramRef);
    expect(currentModel(diagramRef).classes.some(({ id }) => id === 'NewClass2')).toBe(false);
  });

  it('records one history entry per primary drag gesture and preserves layout-save timing', () => {
    const { diagramRef } = renderEditingDiagram();
    mockScheduleDebouncedLayoutSave.mockClear();
    mockScheduleLayoutSave.mockClear();

    fireEvent.mouseDown(classBox('Person'), { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 110, clientY: 120 });
    fireEvent.mouseMove(window, { clientX: 130, clientY: 140 });
    fireEvent.mouseUp(window);

    expect(diagramClass(diagramRef, 'Person')).toMatchObject({ x: 70, y: 80 });
    expect(mockScheduleDebouncedLayoutSave).toHaveBeenCalledTimes(2);
    expect(mockScheduleLayoutSave).toHaveBeenCalledTimes(1);

    undo(diagramRef);
    expect(diagramClass(diagramRef, 'Person')).toMatchObject({ x: 40, y: 40 });

    fireEvent.mouseDown(classBox('Person'), { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 15, clientY: 5 });
    fireEvent.mouseUp(window);
    expect(diagramClass(diagramRef, 'Person')).toMatchObject({ x: 55, y: 45 });
    undo(diagramRef);
    expect(diagramClass(diagramRef, 'Person')).toMatchObject({ x: 40, y: 40 });
  });

  it('creates, rejects duplicate, updates, deletes, and restores primary associations', () => {
    jest.spyOn(Date, 'now').mockReturnValue(5001);
    const { container, diagramRef } = renderEditingDiagram();
    const association = {
      id: 'rel-5001',
      sourceId: 'Person',
      targetId: 'Employee',
      type: 'association',
      sourceMultiplicity: '1',
      targetMultiplicity: '0..1',
    };
    const selectAssociation = () => fireEvent.click(container.querySelector(
      '[data-rel-hit-line][data-rel-id="rel-5001"]',
    ) as Element);

    connectClasses('Person', 'Person');
    expect(relationships(diagramRef).filter(({ type }) => type === 'association')).toHaveLength(0);

    connectClasses('Person', 'Employee');
    expect(relationships(diagramRef)).toContainEqual(association);
    expect(screen.getByRole('dialog', { name: 'Edit association connection' }))
      .toBeInTheDocument();

    connectClasses('Person', 'Employee');
    expect(relationships(diagramRef).filter(({ type }) => type === 'association')).toHaveLength(1);

    undo(diagramRef);
    expect(relationships(diagramRef).some(({ id }) => id === 'rel-5001')).toBe(false);
    redo(diagramRef);
    expect(relationships(diagramRef).some(({ id }) => id === 'rel-5001')).toBe(true);

    selectAssociation();
    changeValue(screen.getByLabelText('Connection name'), 'manages');
    expect(relationships(diagramRef).find(({ id }) => id === 'rel-5001'))
      .toEqual({ ...association, label: 'manages' });

    undo(diagramRef);
    expect(relationships(diagramRef)).toContainEqual(association);
    redo(diagramRef);
    expect(relationships(diagramRef)).toContainEqual(
      expect.objectContaining({ id: 'rel-5001', label: 'manages' }),
    );

    selectAssociation();
    clickToolbar('Delete selected class or connection');
    expect(relationships(diagramRef).map(({ id }) => id)).toEqual(['rel-inherit']);
    expect(screen.queryByRole('dialog', { name: 'Edit association connection: manages' }))
      .not.toBeInTheDocument();

    undo(diagramRef);
    expect(relationships(diagramRef)).toContainEqual(
      expect.objectContaining({ id: 'rel-5001', label: 'manages' }),
    );
  });

  it('hides semantic editing controls in read-only mode while preserving the existing drag behavior', () => {
    const { diagramRef } = renderEditingDiagram({ interactive: false });
    const before = structuredClone(currentModel(diagramRef));

    expect(screen.queryByTitle('Add class')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add attribute' }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add operation' }))
      .not.toBeInTheDocument();
    expect(classNameButton('Person')).toBeDisabled();
    expect(classBox('Person')).toHaveAttribute('tabindex', '-1');

    fireEvent.click(classBox('Person'));
    fireEvent.keyDown(classBox('Person'), { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(currentModel(diagramRef)).toEqual(before);

    fireEvent.mouseDown(classBox('Person'), { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(window, { clientX: 25, clientY: 20 });
    fireEvent.mouseUp(window);
    expect(diagramClass(diagramRef, 'Person')).toMatchObject({ x: 55, y: 50 });
  });
});
