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
