import type { SetStateAction } from 'react';

/**
 * Applies a single-class selection update to the multi-class selection.
 *
 * Existing editing code updates the selection like a single id: it sets an id,
 * clears it with `null`, or maps it with an updater (e.g. rename or delete).
 * An id or `null` replaces the whole selection; an updater is applied to every
 * selected id, so renaming or deleting one class keeps the others selected.
 */
export function applyClassSelectionUpdate(
  previousIds: string[],
  next: SetStateAction<string | null>,
): string[] {
  if (typeof next !== 'function') {
    return next === null ? [] : [next];
  }
  const mappedIds = previousIds
    .map(id => next(id))
    .filter((id): id is string => id !== null);
  const uniqueIds = Array.from(new Set(mappedIds));
  const unchanged = uniqueIds.length === previousIds.length
    && uniqueIds.every((id, index) => id === previousIds[index]);
  return unchanged ? previousIds : uniqueIds;
}

/** Adds the class to the selection, or removes it if it is already selected. */
export function toggleClassInSelection(
  previousIds: string[],
  classId: string,
): string[] {
  return previousIds.includes(classId)
    ? previousIds.filter(id => id !== classId)
    : [...previousIds, classId];
}

/** Shift, Cmd (macOS) or Ctrl adds to or removes from the selection. */
export function isAdditiveSelectionEvent(
  event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean },
): boolean {
  return event.shiftKey || event.metaKey || event.ctrlKey;
}
