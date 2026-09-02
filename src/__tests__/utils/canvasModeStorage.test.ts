import {
  canvasModeStorageKey,
  readStoredCanvasMode,
  writeStoredCanvasMode,
} from '../../utils/canvasModeStorage';

describe('canvasModeStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to modeling when no mode is stored', () => {
    expect(readStoredCanvasMode(1)).toBe('modeling');
  });

  it('reads a valid stored mode', () => {
    localStorage.setItem(canvasModeStorageKey(1), 'constraints');

    expect(readStoredCanvasMode(1)).toBe('constraints');
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem(canvasModeStorageKey(1), 'invalid');

    expect(readStoredCanvasMode(1)).toBe('modeling');
  });

  it('writes modes per project', () => {
    writeStoredCanvasMode(1, 'constraints');
    writeStoredCanvasMode(2, 'views');
    writeStoredCanvasMode(3, 'metrics');

    expect(readStoredCanvasMode(1)).toBe('constraints');
    expect(readStoredCanvasMode(2)).toBe('views');
    expect(readStoredCanvasMode(3)).toBe('metrics');
  });
});
