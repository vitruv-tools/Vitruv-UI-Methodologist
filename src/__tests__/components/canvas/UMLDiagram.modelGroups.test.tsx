/* eslint-disable import/first, testing-library/no-node-access */

const mockMinimapSpy = jest.fn();

jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('../../../testSupport/umlDiagram/mockFactories').saveMetaModelEcoreMock());
jest.mock('../../../utils/umlValidation', () => require('../../../testSupport/umlDiagram/mockFactories').umlValidationMock());
jest.mock('../../../utils/reactionFile', () => require('../../../testSupport/umlDiagram/mockFactories').reactionFileMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => ({
  UMLDiagramMinimap: (props: unknown) => {
    mockMinimapSpy(props);
    const mockReact = require('react');
    return mockReact.createElement('div', { 'data-testid': 'uml-minimap-stub' });
  },
}));
jest.mock('../../../components/flow/ReactionEditorModal', () => require('../../../testSupport/umlDiagram/mockFactories').reactionEditorModalMock());
jest.mock('../../../components/canvas/ReactionConfigPopup', () => require('../../../testSupport/umlDiagram/mockFactories').reactionConfigPopupMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());

import React, { createRef } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { UMLDiagram, UMLDiagramHandle } from '../../../components/canvas/UMLDiagram';
import { REF_ECORE, SIMPLE_ECORE } from '../../../testSupport/umlDiagram/fixtures';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

interface MinimapClass {
  id: string;
  x: number;
  y: number;
}

interface MinimapRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
}

interface MinimapModelGroup {
  name: string;
  color: string;
  fill: string;
  minX: number;
  minY: number;
  width: number;
  height: number;
}

interface MinimapProps {
  classes: MinimapClass[];
  relationships: MinimapRelationship[];
  modelGroups: MinimapModelGroup[];
  offsetX: number;
  offsetY: number;
}

const referenceModel = {
  id: 2,
  name: 'Reference',
  ecoreContent: REF_ECORE,
  color: '#dc2626',
  fill: 'rgba(220,38,38,0.06)',
};

const billingModel = {
  id: 3,
  name: 'Billing',
  ecoreContent: REF_ECORE,
  color: '#059669',
  fill: 'rgba(5,150,105,0.06)',
};

const singleAdditionalModel = [referenceModel];
const multipleAdditionalModels = [referenceModel, billingModel];

function latestMinimapProps(): MinimapProps {
  const call = mockMinimapSpy.mock.calls[mockMinimapSpy.mock.calls.length - 1];
  if (!call) throw new Error('Expected the UML minimap to render');
  return call[0] as MinimapProps;
}

function classPosition(classId: string): { x: number; y: number } {
  const classItem = latestMinimapProps().classes.find(item => item.id === classId);
  if (!classItem) throw new Error(`Missing minimap class ${classId}`);
  return { x: classItem.x, y: classItem.y };
}

function groupWrapper(groupName: string): HTMLElement {
  const button = screen.getByRole('button', { name: groupName });
  const header = button.closest('[data-wrapper-header]');
  const wrapper = header?.parentElement;
  if (!wrapper) throw new Error(`Missing wrapper for ${groupName}`);
  return wrapper;
}

function classBox(className: string): HTMLElement {
  return screen.getByRole('group', { name: new RegExp(`^UML class ${className}`) });
}

function expectPositionDelta(
  before: { x: number; y: number },
  after: { x: number; y: number },
  dx: number,
  dy: number,
): void {
  expect(after.x).toBeCloseTo(before.x + dx);
  expect(after.y).toBeCloseTo(before.y + dy);
}

function expectPositionUnchanged(
  before: { x: number; y: number },
  after: { x: number; y: number },
): void {
  expect(after).toEqual(before);
}

beforeEach(() => {
  mockMinimapSpy.mockClear();
});

describe('UMLDiagram model groups', () => {
  it('renders primary and additional models with namespaced, offset render data and wrappers', () => {
    renderDiagram({
      ecoreContent: SIMPLE_ECORE,
      fileName: 'simple.ecore',
      additionalModels: multipleAdditionalModels,
    });

    expect(screen.getByText('Person')).toBeInTheDocument();
    expect(screen.getByText('Employee')).toBeInTheDocument();
    expect(screen.getAllByText('Order')).toHaveLength(2);
    expect(screen.getAllByText('LineItem')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'simple' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reference' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Billing' })).toBeInTheDocument();

    const minimap = latestMinimapProps();
    expect(minimap.classes.map(item => item.id)).toEqual([
      'Person',
      'Employee',
      'addl-2-Order',
      'addl-2-LineItem',
      'addl-3-Order',
      'addl-3-LineItem',
    ]);
    expect(minimap.relationships).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'addl-2-rel-order-lines',
        sourceId: 'addl-2-Order',
        targetId: 'addl-2-LineItem',
      }),
      expect.objectContaining({
        id: 'addl-3-rel-order-lines',
        sourceId: 'addl-3-Order',
        targetId: 'addl-3-LineItem',
      }),
    ]));
    expect(minimap.relationships[0].id).toBe('rel-inherit');
    expect(classPosition('addl-2-Order')).toEqual({ x: 490, y: 40 });
    expect(classPosition('addl-2-LineItem')).toEqual({ x: 730, y: 40 });
    expect(classPosition('addl-3-Order')).toEqual({ x: 940, y: 40 });
    expect(classPosition('addl-3-LineItem')).toEqual({ x: 1180, y: 40 });

    expect(minimap.modelGroups.map(group => group.name)).toEqual([
      'simple',
      'Reference',
      'Billing',
    ]);
    expect(minimap.modelGroups[0]).toEqual(expect.objectContaining({
      color: '#2563eb',
      fill: 'rgba(37,99,235,0.06)',
    }));
    expect(minimap.modelGroups[1]).toEqual(expect.objectContaining({
      color: referenceModel.color,
      fill: referenceModel.fill,
    }));

    const expectedGroupMembers: Record<string, string[]> = {
      simple: ['Person', 'Employee'],
      Reference: ['addl-2-Order', 'addl-2-LineItem'],
      Billing: ['addl-3-Order', 'addl-3-LineItem'],
    };
    for (const group of minimap.modelGroups) {
      const wrapper = groupWrapper(group.name);
      expect(Number.parseFloat(wrapper.style.left)).toBe(group.minX + minimap.offsetX);
      expect(Number.parseFloat(wrapper.style.top)).toBe(group.minY + minimap.offsetY);
      expect(Number.parseFloat(wrapper.style.width)).toBe(group.width);
      expect(Number.parseFloat(wrapper.style.height)).toBe(group.height);
      for (const classId of expectedGroupMembers[group.name]) {
        const item = minimap.classes.find(candidate => candidate.id === classId)!;
        expect(item.x).toBeGreaterThanOrEqual(group.minX);
        expect(item.x + 190).toBeLessThanOrEqual(group.minX + group.width);
        expect(item.y).toBeGreaterThan(group.minY);
        expect(item.y).toBeLessThan(group.minY + group.height);
      }
    }
  });

  it('moves all and only primary classes from captured origins using scale-correct deltas', () => {
    const diagramRef = createRef<UMLDiagramHandle>();
    renderDiagram({
      ref: diagramRef,
      fileName: 'simple.ecore',
      additionalModels: singleAdditionalModel,
    });
    const before = {
      person: classPosition('Person'),
      employee: classPosition('Employee'),
      order: classPosition('addl-2-Order'),
      lineItem: classPosition('addl-2-LineItem'),
    };

    act(() => diagramRef.current?.zoomIn());
    const primaryHeader = screen.getByRole('button', { name: 'simple' });
    fireEvent.mouseDown(primaryHeader, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 165, clientY: 126 });
    fireEvent.mouseMove(window, { clientX: 230, clientY: 152 });
    fireEvent.mouseUp(window);

    expectPositionDelta(before.person, classPosition('Person'), 100, 40);
    expectPositionDelta(before.employee, classPosition('Employee'), 100, 40);
    expectPositionUnchanged(before.order, classPosition('addl-2-Order'));
    expectPositionUnchanged(before.lineItem, classPosition('addl-2-LineItem'));
  });

  it('moves all and only the dragged additional model group', () => {
    renderDiagram({
      fileName: 'simple.ecore',
      additionalModels: multipleAdditionalModels,
    });
    const before = new Map(latestMinimapProps().classes.map(item => [
      item.id,
      { x: item.x, y: item.y },
    ]));

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Reference' }), {
      clientX: 20,
      clientY: 30,
    });
    fireEvent.mouseMove(window, { clientX: 80, clientY: 65 });
    fireEvent.mouseUp(window);

    expectPositionDelta(before.get('addl-2-Order')!, classPosition('addl-2-Order'), 60, 35);
    expectPositionDelta(before.get('addl-2-LineItem')!, classPosition('addl-2-LineItem'), 60, 35);
    expectPositionUnchanged(before.get('Person')!, classPosition('Person'));
    expectPositionUnchanged(before.get('Employee')!, classPosition('Employee'));
    expectPositionUnchanged(before.get('addl-3-Order')!, classPosition('addl-3-Order'));
    expectPositionUnchanged(before.get('addl-3-LineItem')!, classPosition('addl-3-LineItem'));
  });

  it('keeps individual additional classes draggable without moving their peers', () => {
    renderDiagram({
      fileName: 'simple.ecore',
      additionalModels: singleAdditionalModel,
    });
    const orderBefore = classPosition('addl-2-Order');
    const lineItemBefore = classPosition('addl-2-LineItem');
    const personBefore = classPosition('Person');

    fireEvent.mouseDown(classBox('Order'), { clientX: 200, clientY: 200 });
    fireEvent.mouseMove(window, { clientX: 245, clientY: 225 });
    fireEvent.mouseUp(window);

    expectPositionDelta(orderBefore, classPosition('addl-2-Order'), 45, 25);
    expectPositionUnchanged(lineItemBefore, classPosition('addl-2-LineItem'));
    expectPositionUnchanged(personBefore, classPosition('Person'));
  });

  it('preserves live additional-class positions when refreshed props keep the same IDs', () => {
    const { rerender } = renderDiagram({
      fileName: 'simple.ecore',
      additionalModels: singleAdditionalModel,
    });

    fireEvent.mouseDown(classBox('Order'), { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 175, clientY: 145 });
    fireEvent.mouseUp(window);
    const movedOrder = classPosition('addl-2-Order');

    rerender(
      <UMLDiagram
        ecoreContent={SIMPLE_ECORE}
        fileName="simple.ecore"
        additionalModels={[{
          ...referenceModel,
          ecoreContent: `${REF_ECORE} refreshed`,
        }]}
        interactive
      />,
    );

    expect(classPosition('addl-2-Order')).toEqual(movedOrder);
    expect(latestMinimapProps().relationships).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'addl-2-rel-order-lines' }),
    ]));
  });

  it('offers removal only for interactive additional groups and forwards the exact name', () => {
    const onRemoveAdditionalModel = jest.fn();
    const { unmount } = renderDiagram({
      fileName: 'simple.ecore',
      additionalModels: singleAdditionalModel,
      onRemoveAdditionalModel,
    });

    expect(screen.queryByTitle('Remove simple')).not.toBeInTheDocument();
    const removeButton = screen.getByTitle('Remove Reference');
    expect(removeButton).toHaveAccessibleName('Remove Reference');
    fireEvent.click(removeButton);
    expect(onRemoveAdditionalModel).toHaveBeenCalledTimes(1);
    expect(onRemoveAdditionalModel).toHaveBeenCalledWith('Reference');

    unmount();
    renderDiagram({
      fileName: 'simple.ecore',
      additionalModels: singleAdditionalModel,
    });
    expect(screen.queryByTitle('Remove Reference')).not.toBeInTheDocument();
  });

  it('keeps read-only wrappers visible but prevents dragging and removal', () => {
    const onRemoveAdditionalModel = jest.fn();
    renderDiagram({
      fileName: 'simple.ecore',
      additionalModels: singleAdditionalModel,
      onRemoveAdditionalModel,
      interactive: false,
    });
    const before = classPosition('addl-2-Order');
    const groupButton = screen.getByRole('button', { name: 'Reference' });

    expect(groupWrapper('simple')).toBeInTheDocument();
    expect(groupWrapper('Reference')).toBeInTheDocument();
    expect(groupButton).toHaveStyle({ cursor: 'default' });
    expect(screen.queryByTitle('Remove Reference')).not.toBeInTheDocument();
    fireEvent.mouseDown(groupButton, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(window, { clientX: 80, clientY: 60 });
    fireEvent.mouseUp(window);

    expectPositionUnchanged(before, classPosition('addl-2-Order'));
    expect(onRemoveAdditionalModel).not.toHaveBeenCalled();
  });

  it('allows same-model connections and rejects cross-model UML connections', () => {
    renderDiagram({
      fileName: 'simple.ecore',
      additionalModels: singleAdditionalModel,
    });

    fireEvent.click(screen.getByTitle('Connect two classes in the same model'));
    fireEvent.click(classBox('Order'));
    fireEvent.click(classBox('LineItem'));
    expect(latestMinimapProps().relationships).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceId: 'addl-2-Order',
        targetId: 'addl-2-LineItem',
        type: 'association',
      }),
    ]));

    const relationshipCount = latestMinimapProps().relationships.length;
    fireEvent.click(screen.getByTitle('Connect two classes in the same model'));
    fireEvent.click(classBox('Person'));
    fireEvent.click(classBox('Order'));

    expect(latestMinimapProps().relationships).toHaveLength(relationshipCount);
    expect(latestMinimapProps().relationships).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceId: 'Person',
        targetId: 'addl-2-Order',
      }),
    ]));
  });
});
