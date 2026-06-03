import { downloadBlobAsFile } from '../../utils/downloadFile';

describe('downloadBlobAsFile', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('creates a link, clicks it, and revokes the object URL after a delay', () => {
    const revoke = jest.fn();
    const create = jest.fn().mockReturnValue('blob:mock');
    const originalUrl = globalThis.URL;

    globalThis.URL = {
      ...originalUrl,
      createObjectURL: create,
      revokeObjectURL: revoke,
    } as typeof URL;

    const click = jest.fn();
    const remove = jest.fn();
    const appendChild = jest.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      Object.assign(node as HTMLAnchorElement, { click, remove });
      return node;
    });

    try {
      downloadBlobAsFile(new Blob(['zip']), 'artifact.zip');

      expect(create).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
      expect(revoke).not.toHaveBeenCalled();

      jest.runAllTimers();

      expect(remove).toHaveBeenCalled();
      expect(revoke).toHaveBeenCalledWith('blob:mock');
    } finally {
      globalThis.URL = originalUrl;
      appendChild.mockRestore();
    }
  });
});
