/* eslint-disable import/first, testing-library/no-container, testing-library/no-node-access */

jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('../../../testSupport/umlDiagram/mockFactories').saveMetaModelEcoreMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramMinimapMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());

import React, { createRef, type PropsWithChildren } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import type { UMLDiagramHandle } from '../../../components/canvas/UMLDiagram';
import type { UMLModel } from '../../../utils/ecoreToUml';
import { REF_ECORE } from '../../../testSupport/umlDiagram/fixtures';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

type DiagramRef = React.RefObject<UMLDiagramHandle | null>;

function renderInteractionDiagram(
  props: Parameters<typeof renderDiagram>[0] = {},
  options?: Parameters<typeof renderDiagram>[1],
) {
  const diagramRef = createRef<UMLDiagramHandle>();
  const view = renderDiagram({ ref: diagramRef, ...props }, options);
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

function classNameButton(className: string): HTMLElement {
  return screen.getByRole('button', {
    name: new RegExp(`^Class name: ${className}\\.`),
  });
}

function relationshipHit(container: HTMLElement, relationshipId?: string): HTMLElement {
  const suffix = relationshipId ? `[data-rel-id="${relationshipId}"]` : '';
  const hit = container.querySelector<HTMLElement>(`[data-rel-hit-line]${suffix}`);
  if (!hit) throw new Error(`Missing relationship hit target ${relationshipId ?? ''}`);
  return hit;
}

function getConnectBanner(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-uml-connect-banner]');
}

function tryEscape(diagramRef: DiagramRef): boolean {
  let handled = false;
  act(() => {
    handled = diagramRef.current?.tryEscape() ?? false;
  });
  return handled;
}

interface DispatchedKeyboardEvent {
  event: KeyboardEvent;
  stopPropagation: jest.SpyInstance;
}

function dispatchKeyboard(
  target: EventTarget,
  init: KeyboardEventInit,
): DispatchedKeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  const stopPropagation = jest.spyOn(event, 'stopPropagation');
  act(() => {
    target.dispatchEvent(event);
  });
  return { event, stopPropagation };
}

function expectHandledShortcut(result: DispatchedKeyboardEvent): void {
  expect(result.event.defaultPrevented).toBe(true);
  expect(result.stopPropagation).toHaveBeenCalledTimes(1);
}

function relationshipPanel(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-rel-edit-panel]');
}

function classPanel(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-class-edit-panel]');
}

describe('UMLDiagram interaction characterization', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('connect workflow', () => {
    it('flushes inline editing, creates a relationship, then cancels a second connection', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1101);
      const { container, diagramRef } = renderInteractionDiagram();
      const initialRelationshipCount = currentModel(diagramRef).relationships.length;
      fireEvent.click(classBox('Person'));
      fireEvent.doubleClick(classNameButton('Person'));
      fireEvent.change(screen.getByRole('textbox', { name: 'Class name for Person' }), {
        target: { value: 'Agent' },
      });

      fireEvent.click(screen.getByTitle('Connect two classes'));
      expect(screen.getByTitle('Cancel connect mode (Esc)')).toBeInTheDocument();
      expect(getConnectBanner(container)).toHaveTextContent(
        'Click the source class, then the target class',
      );

      fireEvent.click(classBox('Employee'));

      expect(currentModel(diagramRef).classes.some(({ id }) => id === 'Agent')).toBe(true);
      expect(currentModel(diagramRef).classes.some(({ id }) => id === 'Person')).toBe(false);
      expect(screen.queryByRole('textbox', { name: 'Class name for Person' }))
        .not.toBeInTheDocument();
      expect(classBox('Employee')).toHaveAttribute(
        'aria-label',
        'UML class Employee, connection source',
      );
      expect(classBox('Employee')).toHaveAttribute('aria-selected', 'true');
      expect(getConnectBanner(container)).toHaveTextContent(
        'Click the target class to create a connection',
      );

      fireEvent.click(classBox('Agent'));

      expect(currentModel(diagramRef).relationships).toHaveLength(
        initialRelationshipCount + 1,
      );
      expect(currentModel(diagramRef).relationships).toContainEqual({
        id: 'rel-1101',
        sourceId: 'Employee',
        targetId: 'Agent',
        type: 'association',
        targetMultiplicity: '0..1',
        sourceMultiplicity: '1',
      });
      expect(classBox('Agent')).toHaveAttribute('aria-label', 'UML class Agent, selected');
      expect(screen.getByTitle('Connect two classes')).toBeInTheDocument();
      expect(getConnectBanner(container)).not.toBeInTheDocument();

      fireEvent.click(screen.getByTitle('Connect two classes'));
      fireEvent.click(classBox('Employee'));
      expect(classBox('Employee')).toHaveAttribute(
        'aria-label',
        'UML class Employee, connection source',
      );
      expect(screen.getByTitle('Cancel connect mode (Esc)')).toBeInTheDocument();
      expect(getConnectBanner(container)).toHaveTextContent(
        'Click the target class to create a connection',
      );

      fireEvent.click(classBox('Employee'));

      expect(currentModel(diagramRef).relationships).toHaveLength(
        initialRelationshipCount + 1,
      );
      expect(classBox('Employee')).toHaveAttribute(
        'aria-label',
        'UML class Employee, selected',
      );
      expect(screen.getByTitle('Connect two classes')).toBeInTheDocument();
      expect(getConnectBanner(container)).not.toBeInTheDocument();
    });
  });

  describe('selection and relationship interaction', () => {
    it('keeps class selection while selecting and cycling a relationship without bubbling', () => {
      const parentClick = jest.fn();
      const Wrapper = ({ children }: PropsWithChildren) => (
        <div onClick={parentClick}>{children}</div>
      );
      const { container, diagramRef } = renderInteractionDiagram(
        { ecoreContent: REF_ECORE },
        { wrapper: Wrapper },
      );
      const type = () => currentModel(diagramRef).relationships[0].type;

      fireEvent.click(classBox('Order'));
      fireEvent.click(relationshipHit(container, 'rel-order-lines'), { detail: 1 });
      expect(parentClick).not.toHaveBeenCalled();
      expect(classPanel()).toBeInTheDocument();
      expect(relationshipPanel()).toBeInTheDocument();
      expect(type()).toBe('association');

      fireEvent.click(relationshipHit(container, 'rel-order-lines'), { detail: 2 });
      expect(type()).toBe('composition');
      fireEvent.click(relationshipHit(container, 'rel-order-lines'), { detail: 2 });
      expect(type()).toBe('inheritance');
      fireEvent.click(relationshipHit(container, 'rel-order-lines'), { detail: 3 });
      expect(type()).toBe('association');
      expect(parentClick).not.toHaveBeenCalled();
    });

    it('selects relationships read-only without cycling their type', () => {
      const { container, diagramRef } = renderInteractionDiagram({
        ecoreContent: REF_ECORE,
        interactive: false,
      });

      fireEvent.click(relationshipHit(container, 'rel-order-lines'), { detail: 2 });

      expect(currentModel(diagramRef).relationships[0].type).toBe('association');
      expect(tryEscape(diagramRef)).toBe(true);
      expect(tryEscape(diagramRef)).toBe(false);
    });
  });

  describe('delete behavior', () => {
    it('deletes the relationship before the co-selected class and only prevents default', () => {
      const { container, diagramRef } = renderInteractionDiagram();
      fireEvent.click(classBox('Person'));
      fireEvent.click(relationshipHit(container, 'rel-inherit'));

      const relationshipDelete = dispatchKeyboard(globalThis, { key: 'Delete' });
      expect(relationshipDelete.event.defaultPrevented).toBe(true);
      expect(relationshipDelete.stopPropagation).not.toHaveBeenCalled();
      expect(currentModel(diagramRef).relationships).toEqual([]);
      expect(currentModel(diagramRef).classes.some(({ id }) => id === 'Person')).toBe(true);
      expect(classPanel()).toBeInTheDocument();

      const classDelete = dispatchKeyboard(globalThis, { key: 'Delete' });
      expect(classDelete.event.defaultPrevented).toBe(true);
      expect(classDelete.stopPropagation).not.toHaveBeenCalled();
      expect(currentModel(diagramRef).classes.some(({ id }) => id === 'Person')).toBe(false);
      expect(classPanel()).not.toBeInTheDocument();
    });
  });

  describe('Escape behavior', () => {
    it('suppresses handled keyboard Escape and clears one layer per imperative call', () => {
      const { container, diagramRef } = renderInteractionDiagram();
      fireEvent.click(classBox('Person'));
      fireEvent.doubleClick(classNameButton('Person'));
      fireEvent.click(relationshipHit(container, 'rel-inherit'));
      fireEvent.click(screen.getByTitle('Connect two classes'));

      const handled = dispatchKeyboard(globalThis, { key: 'Escape' });
      expectHandledShortcut(handled);
      expect(getConnectBanner(container)).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Class name for Person' })).toBeInTheDocument();
      expect(classPanel()).toBeInTheDocument();
      expect(relationshipPanel()).toBeInTheDocument();

      expect(tryEscape(diagramRef)).toBe(true);
      expect(screen.queryByRole('textbox', { name: 'Class name for Person' }))
        .not.toBeInTheDocument();
      expect(classPanel()).toBeInTheDocument();
      expect(relationshipPanel()).toBeInTheDocument();

      expect(tryEscape(diagramRef)).toBe(true);
      expect(relationshipPanel()).not.toBeInTheDocument();
      expect(classPanel()).toBeInTheDocument();

      expect(tryEscape(diagramRef)).toBe(true);
      expect(classPanel()).not.toBeInTheDocument();
      expect(tryEscape(diagramRef)).toBe(false);

      const unhandled = dispatchKeyboard(globalThis, { key: 'Escape' });
      expect(unhandled.event.defaultPrevented).toBe(false);
      expect(unhandled.stopPropagation).not.toHaveBeenCalled();
    });
  });

  describe('native canvas double-click behavior', () => {
    it('uses native empty-canvas double-click to flush and dismiss only class editing', () => {
      const { container, diagramRef } = renderInteractionDiagram();
      fireEvent.click(relationshipHit(container, 'rel-inherit'));
      fireEvent.click(classBox('Person'));
      fireEvent.doubleClick(classNameButton('Person'));
      fireEvent.change(screen.getByRole('textbox', { name: 'Class name for Person' }), {
        target: { value: 'Agent' },
      });
      const canvas = screen.getByRole('region', { name: 'UML diagram canvas' });
      const event = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
      const stopPropagation = jest.spyOn(event, 'stopPropagation');

      act(() => {
        canvas.dispatchEvent(event);
      });

      expect(event.defaultPrevented).toBe(true);
      expect(stopPropagation).toHaveBeenCalledTimes(1);
      expect(currentModel(diagramRef).classes.some(({ id }) => id === 'Agent')).toBe(true);
      expect(screen.queryByRole('textbox', { name: 'Class name for Person' }))
        .not.toBeInTheDocument();
      expect(classPanel()).not.toBeInTheDocument();
      expect(relationshipPanel()).toBeInTheDocument();
    });

  });
});
