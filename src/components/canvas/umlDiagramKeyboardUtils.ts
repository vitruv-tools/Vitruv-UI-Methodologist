import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

export function handleUmlInlineEditKeyDown(
  event: ReactKeyboardEvent,
  onEnter: () => void,
  onEscape: () => void,
): void {
  if (event.key === 'Enter') {
    onEnter();
    return;
  }
  if (event.key === 'Escape') {
    onEscape();
  }
}

export function isKeyboardInputField(target: EventTarget | null): boolean {
  const tag = target instanceof Element ? target.tagName : undefined;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function tryHandleUndoRedoShortcut(
  event: KeyboardEvent,
  inField: boolean,
  handleUndo: () => void,
  handleRedo: () => void,
): boolean {
  if (!((event.ctrlKey || event.metaKey) && !inField)) return false;
  const key = event.key.toLowerCase();
  if (key === 'z') {
    event.preventDefault();
    event.stopPropagation();
    if (event.shiftKey) handleRedo();
    else handleUndo();
    return true;
  }
  if (key === 'y') {
    event.preventDefault();
    event.stopPropagation();
    handleRedo();
    return true;
  }
  return false;
}

export function tryHandleEscapeShortcut(
  event: KeyboardEvent,
  tryEscape: () => boolean,
): void {
  if (event.key !== 'Escape') return;
  if (tryEscape()) {
    event.preventDefault();
    event.stopPropagation();
  }
}

export function tryHandleDeleteShortcut(
  event: KeyboardEvent,
  inField: boolean,
  selectedRelationshipId: string | null,
  selectedClassId: string | null,
  handleDeleteSelected: () => void,
): void {
  if (event.key !== 'Delete' && event.key !== 'Backspace') return;
  if (inField) return;
  if (!selectedRelationshipId && !selectedClassId) return;
  event.preventDefault();
  handleDeleteSelected();
}

function hasTextSelection(): boolean {
  const selection = globalThis.getSelection?.();
  return Boolean(selection && !selection.isCollapsed && selection.toString().length > 0);
}

export interface UmlClipboardShortcutHandlers {
  /** Returns false if nothing was copied. */
  onCopy: () => boolean;
  /** Returns false if nothing was pasted. */
  onPaste: () => boolean;
  onDuplicate: () => void;
}

/**
 * Ctrl/Cmd+C copies the selected classes, Ctrl/Cmd+V pastes them and
 * Ctrl/Cmd+D duplicates them. Ignored while typing in a field, and C is
 * ignored while page text is selected, so normal text copy and paste keep
 * working. Ctrl/Cmd+D never opens the browser's bookmark dialog here.
 */
export function tryHandleClipboardShortcut(
  event: KeyboardEvent,
  inField: boolean,
  { onCopy, onPaste, onDuplicate }: UmlClipboardShortcutHandlers,
): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey || inField) {
    return false;
  }
  const key = event.key.toLowerCase();
  let handled = false;
  if (key === 'c' && !hasTextSelection()) {
    handled = onCopy();
  } else if (key === 'v') {
    handled = onPaste();
  } else if (key === 'd') {
    onDuplicate();
    handled = true;
  }
  if (handled) event.preventDefault();
  return handled;
}
