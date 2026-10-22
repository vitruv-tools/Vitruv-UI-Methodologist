import { downloadBlobAsFile } from '../../utils/downloadFile';

describe('downloadBlobAsFile', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('creates a link, clicks it, and revokes the object URL after a delay', () => {
    const revoke = vi.fn();
    const create = vi.fn().mockReturnValue('blob:mock');
    const originalUrl = globalThis.URL;

    globalThis.URL = {
      ...originalUrl,
      createObjectURL: create,
      revokeObjectURL: revoke,
    } as typeof URL;

    const click = vi.fn();
    const remove = vi.fn();
    const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      Object.assign(node as HTMLAnchorElement, { click, remove });
      return node;
    });

    try {
      downloadBlobAsFile(new Blob(['zip']), 'artifact.zip');

      expect(create).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
      expect(revoke).not.toHaveBeenCalled();

      vi.runAllTimers();

      expect(remove).toHaveBeenCalled();
      expect(revoke).toHaveBeenCalledWith('blob:mock');
    } finally {
      globalThis.URL = originalUrl;
      appendChild.mockRestore();
    }
  });
});
