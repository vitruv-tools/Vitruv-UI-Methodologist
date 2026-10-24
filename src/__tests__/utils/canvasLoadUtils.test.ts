import { waitForMetaModelsOnCanvas } from '../../utils/canvasLoadUtils';

describe('waitForMetaModelsOnCanvas', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves immediately when no metamodels have ecore files', async () => {
    const getNodes = vi.fn(() => []);
    const promise = waitForMetaModelsOnCanvas(getNodes, [{ id: 1, sourceId: 1 } as any]);
    await expect(promise).resolves.toBeUndefined();
    expect(getNodes).not.toHaveBeenCalled();
  });

  it('resolves when matching ecore nodes exist', async () => {
    const getNodes = vi.fn(() => [
      { type: 'ecoreFile', data: { metaModelId: 5 } },
    ] as any);
    const promise = waitForMetaModelsOnCanvas(
      getNodes,
      [{ id: 5, sourceId: 50, ecoreFileId: 99 } as any],
      { pollMs: 50, maxWaitMs: 500 },
    );
    await promise;
    expect(getNodes).toHaveBeenCalled();
  });

  it('warns and resolves after timeout when nodes never appear', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const getNodes = vi.fn(() => []);
    const promise = waitForMetaModelsOnCanvas(
      getNodes,
      [{ id: 2, sourceId: 20, ecoreFileId: 1 } as any],
      { pollMs: 100, maxWaitMs: 300 },
    );

    vi.advanceTimersByTime(350);
    await promise;

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Timed out waiting for metamodel boxes'),
    );
    warn.mockRestore();
  });
});
