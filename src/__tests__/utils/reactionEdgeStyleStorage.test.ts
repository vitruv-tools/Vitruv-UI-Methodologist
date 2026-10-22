import {
  applyReactionLineStyle,
  DEFAULT_REACTION_LINE_STYLE,
  readStoredReactionLineStyle,
  REACTION_LINE_STYLE_STORAGE_KEY,
  writeStoredReactionLineStyle,
} from '../../utils/reactionEdgeStyleStorage';

describe('reactionEdgeStyleStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty('--reaction-line-dasharray');
    document.documentElement.style.removeProperty('--reaction-line-animation');
  });

  it('defaults to dashed when nothing is stored', () => {
    expect(readStoredReactionLineStyle()).toBe(DEFAULT_REACTION_LINE_STYLE);
  });

  it('round-trips a stored style', () => {
    writeStoredReactionLineStyle('solid');
    expect(localStorage.getItem(REACTION_LINE_STYLE_STORAGE_KEY)).toBe('solid');
    expect(readStoredReactionLineStyle()).toBe('solid');
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem(REACTION_LINE_STYLE_STORAGE_KEY, 'zigzag');
    expect(readStoredReactionLineStyle()).toBe('dashed');
  });

  it('applies CSS variables for dashed and solid', () => {
    applyReactionLineStyle('dashed');
    expect(document.documentElement.style.getPropertyValue('--reaction-line-dasharray')).toBe('5');
    expect(document.documentElement.style.getPropertyValue('--reaction-line-animation'))
      .toContain('dashdraw');

    applyReactionLineStyle('solid');
    expect(document.documentElement.style.getPropertyValue('--reaction-line-dasharray')).toBe('none');
    expect(document.documentElement.style.getPropertyValue('--reaction-line-animation')).toBe('none');
  });
});
