import {
  getSelectionBoxClassIds,
  rectsIntersect,
} from '../../hooks/useUmlSelectionBox';

const PERSON = { id: 'Person', left: 0, top: 0, right: 100, bottom: 80 };
const ADDRESS = { id: 'Address', left: 200, top: 0, right: 300, bottom: 80 };

describe('useUmlSelectionBox helpers', () => {
  it('detects overlapping and touching rectangles', () => {
    expect(rectsIntersect(PERSON, { left: 90, top: 70, right: 150, bottom: 150 })).toBe(true);
    expect(rectsIntersect(PERSON, { left: 100, top: 80, right: 120, bottom: 90 })).toBe(true);
    expect(rectsIntersect(PERSON, { left: 101, top: 0, right: 150, bottom: 10 })).toBe(false);
  });

  it('selects the classes the box touches', () => {
    const box = { left: 50, top: 10, right: 210, bottom: 20 };
    expect(getSelectionBoxClassIds(box, [PERSON, ADDRESS], [])).toEqual(['Person', 'Address']);
  });

  it('adds the touched classes to the starting selection without duplicates', () => {
    const box = { left: 50, top: 10, right: 60, bottom: 20 };
    expect(getSelectionBoxClassIds(box, [PERSON, ADDRESS], ['Address', 'Person']))
      .toEqual(['Address', 'Person']);
    expect(getSelectionBoxClassIds(box, [PERSON, ADDRESS], ['Order']))
      .toEqual(['Order', 'Person']);
  });
});
