import {
  applyClassSelectionUpdate,
  isAdditiveSelectionEvent,
  toggleClassInSelection,
} from '../../../components/canvas/umlClassSelection';

describe('umlClassSelection', () => {
  describe('applyClassSelectionUpdate', () => {
    it('replaces the selection with a single id or clears it with null', () => {
      expect(applyClassSelectionUpdate(['A', 'B'], 'C')).toEqual(['C']);
      expect(applyClassSelectionUpdate(['A', 'B'], null)).toEqual([]);
    });

    it('applies an updater to every selected id', () => {
      const rename = (id: string | null) => (id === 'A' ? 'A2' : id);
      const remove = (id: string | null) => (id === 'B' ? null : id);

      expect(applyClassSelectionUpdate(['A', 'B'], rename)).toEqual(['A2', 'B']);
      expect(applyClassSelectionUpdate(['A', 'B'], remove)).toEqual(['A']);
    });

    it('keeps the same array when the updater changes nothing', () => {
      const previousIds = ['A', 'B'];
      expect(applyClassSelectionUpdate(previousIds, id => id)).toBe(previousIds);
    });

    it('drops duplicates created by an updater', () => {
      expect(applyClassSelectionUpdate(['A', 'B'], () => 'C')).toEqual(['C']);
    });
  });

  it('toggles a class in the selection', () => {
    expect(toggleClassInSelection(['A'], 'B')).toEqual(['A', 'B']);
    expect(toggleClassInSelection(['A', 'B'], 'A')).toEqual(['B']);
  });

  it('treats Shift, Cmd and Ctrl as additive', () => {
    const none = { shiftKey: false, metaKey: false, ctrlKey: false };
    expect(isAdditiveSelectionEvent(none)).toBe(false);
    expect(isAdditiveSelectionEvent({ ...none, shiftKey: true })).toBe(true);
    expect(isAdditiveSelectionEvent({ ...none, metaKey: true })).toBe(true);
    expect(isAdditiveSelectionEvent({ ...none, ctrlKey: true })).toBe(true);
  });
});
