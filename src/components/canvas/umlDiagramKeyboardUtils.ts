import type { KeyboardEvent } from 'react';

export function handleUmlInlineEditKeyDown(
  event: KeyboardEvent,
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
