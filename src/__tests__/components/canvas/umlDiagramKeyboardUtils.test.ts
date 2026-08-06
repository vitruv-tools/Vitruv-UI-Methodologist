import { createElement, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  handleUmlInlineEditKeyDown,
  isKeyboardInputField,
  tryHandleDeleteShortcut,
  tryHandleEscapeShortcut,
  tryHandleUndoRedoShortcut,
} from '../../../components/canvas/umlDiagramKeyboardUtils';

const FIELD_TAGS = ['input', 'textarea', 'select'] as const;

function createKeyboardEvent(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
}

function mountInlineEditor(
  onEnter: () => void,
  onEscape: () => void,
): HTMLElement {
  render(createElement('input', {
    'aria-label': 'Inline UML editor',
    onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => {
      handleUmlInlineEditKeyDown(event, onEnter, onEscape);
    },
  }));

  return screen.getByRole('textbox', { name: 'Inline UML editor' });
}

describe('umlDiagramKeyboardUtils', () => {
  describe('handleUmlInlineEditKeyDown', () => {
    it.each([
      ['Enter', 'Enter', 1, 0],
      ['Escape', 'Escape', 0, 1],
    ] as const)('routes %s correctly', (
      _label,
      key,
      expectedEnterCalls,
      expectedEscapeCalls,
    ) => {
      const onEnter = jest.fn<void, []>();
      const onEscape = jest.fn<void, []>();
      const input = mountInlineEditor(onEnter, onEscape);

      fireEvent(input, createKeyboardEvent({ key }));

      expect(onEnter).toHaveBeenCalledTimes(expectedEnterCalls);
      expect(onEscape).toHaveBeenCalledTimes(expectedEscapeCalls);
    });
  });

  describe('isKeyboardInputField', () => {
    it('recognizes only INPUT, TEXTAREA, and SELECT elements', () => {
      FIELD_TAGS.forEach(tagName => {
        expect(isKeyboardInputField(document.createElement(tagName))).toBe(true);
      });
      const contenteditable = document.createElement('div');
      contenteditable.contentEditable = 'true';

      expect(isKeyboardInputField(document.createElement('div'))).toBe(false);
      expect(isKeyboardInputField(contenteditable)).toBe(false);
      expect(isKeyboardInputField(null)).toBe(false);
    });
  });

  describe('tryHandleUndoRedoShortcut', () => {
    interface ShortcutCase {
      label: string;
      init: KeyboardEventInit;
      expected: 'undo' | 'redo';
    }

    const shortcutCases: ShortcutCase[] = [
      {
        label: 'Ctrl+Z',
        init: { key: 'z', ctrlKey: true },
        expected: 'undo',
      },
      {
        label: 'Cmd+Z with an uppercase key',
        init: { key: 'Z', metaKey: true },
        expected: 'undo',
      },
      {
        label: 'Ctrl+Shift+Z',
        init: { key: 'z', ctrlKey: true, shiftKey: true },
        expected: 'redo',
      },
      {
        label: 'Cmd+Y with an uppercase key',
        init: { key: 'Y', metaKey: true },
        expected: 'redo',
      },
    ];

    it.each(shortcutCases)(
      'routes $label and suppresses the handled event',
      ({ init, expected }) => {
        const event = createKeyboardEvent(init);
        const stopPropagation = jest.spyOn(event, 'stopPropagation');
        const handleUndo = jest.fn<void, []>();
        const handleRedo = jest.fn<void, []>();

        const handled = tryHandleUndoRedoShortcut(
          event,
          false,
          handleUndo,
          handleRedo,
        );

        expect(handled).toBe(true);
        expect(handleUndo).toHaveBeenCalledTimes(expected === 'undo' ? 1 : 0);
        expect(handleRedo).toHaveBeenCalledTimes(expected === 'redo' ? 1 : 0);
        expect(event.defaultPrevented).toBe(true);
        expect(stopPropagation).toHaveBeenCalledTimes(1);
      },
    );
  });

  describe('tryHandleEscapeShortcut', () => {
    it.each([
      ['handled Escape', true, true, 1],
      ['unhandled Escape', false, false, 0],
    ] as const)('handles %s correctly', (
      _label,
      escapeResult,
      expectedDefaultPrevented,
      expectedStopCalls,
    ) => {
      const event = createKeyboardEvent({ key: 'Escape' });
      const stopPropagation = jest.spyOn(event, 'stopPropagation');
      const tryEscape = jest.fn<boolean, []>(() => escapeResult);

      tryHandleEscapeShortcut(event, tryEscape);

      expect(tryEscape).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(expectedDefaultPrevented);
      expect(stopPropagation).toHaveBeenCalledTimes(expectedStopCalls);
    });
  });

  describe('tryHandleDeleteShortcut', () => {
    interface DeleteCase {
      label: string;
      key: string;
      inField: boolean;
      selectedRelationshipId: string | null;
      selectedClassId: string | null;
      expectedHandled: boolean;
    }

    const deleteCases: DeleteCase[] = [
      {
        label: 'Delete with a selected relationship',
        key: 'Delete',
        inField: false,
        selectedRelationshipId: 'relationship-1',
        selectedClassId: null,
        expectedHandled: true,
      },
      {
        label: 'Backspace with a selected class',
        key: 'Backspace',
        inField: false,
        selectedRelationshipId: null,
        selectedClassId: 'class-1',
        expectedHandled: true,
      },
      {
        label: 'Delete in a field',
        key: 'Delete',
        inField: true,
        selectedRelationshipId: 'relationship-1',
        selectedClassId: null,
        expectedHandled: false,
      },
      {
        label: 'Backspace without a selection',
        key: 'Backspace',
        inField: false,
        selectedRelationshipId: null,
        selectedClassId: null,
        expectedHandled: false,
      },
    ];

    it.each(deleteCases)(
      'handles $label according to the delete gates',
      ({
        key,
        inField,
        selectedRelationshipId,
        selectedClassId,
        expectedHandled,
      }) => {
        const event = createKeyboardEvent({ key });
        const stopPropagation = jest.spyOn(event, 'stopPropagation');
        const handleDeleteSelected = jest.fn<void, []>();

        tryHandleDeleteShortcut(
          event,
          inField,
          selectedRelationshipId,
          selectedClassId,
          handleDeleteSelected,
        );

        expect(handleDeleteSelected).toHaveBeenCalledTimes(
          expectedHandled ? 1 : 0,
        );
        expect(event.defaultPrevented).toBe(expectedHandled);
        expect(stopPropagation).not.toHaveBeenCalled();
      },
    );
  });
});
