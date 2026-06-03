import { createCanvasTabInstanceId } from '../../utils/canvasTabId';

describe('createCanvasTabInstanceId', () => {
  it('returns ids prefixed with project id and unique per call', () => {
    const a = createCanvasTabInstanceId(42);
    const b = createCanvasTabInstanceId(42);
    expect(a).toMatch(/^42-\d+-\d+$/);
    expect(b).toMatch(/^42-\d+-\d+$/);
    expect(a).not.toBe(b);
  });

  it('uses different prefixes for different projects', () => {
    expect(createCanvasTabInstanceId(1)).toMatch(/^1-/);
    expect(createCanvasTabInstanceId(2)).toMatch(/^2-/);
  });
});
