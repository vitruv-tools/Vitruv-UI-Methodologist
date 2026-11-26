import type { Mock } from 'vitest';
import { loadSharedMetaModel } from '../../collaboration/loadSharedMetaModel';
import { apiService } from '../../services/api';

vi.mock('../../services/api', () => ({ apiService: { getFile: vi.fn() } }));

/** XD as another user added it: the project's copy (60) with its own files. */
const xd = {
  sourceId: 22,
  name: 'XD',
  position: { x: 5, y: 5 },
  copy: { projectMetaModelId: 60, ecoreFileId: 253, genModelFileId: 254 },
};

afterEach(() => vi.clearAllMocks());

describe('loadSharedMetaModel', () => {
  it("loads the ecore file of the project's copy, never the library's", async () => {
    (apiService.getFile as Mock).mockResolvedValue('<ecore/>');

    const resolved = await loadSharedMetaModel(xd, []);

    expect(apiService.getFile).toHaveBeenCalledTimes(1);
    expect(apiService.getFile).toHaveBeenCalledWith(253);
    expect(resolved).toEqual({
      fileName: 'XD.ecore',
      fileContent: '<ecore/>',
      meta: {
        version: undefined,
        domain: undefined,
        description: undefined,
        metaModelId: 60,
        metaModelSourceId: 22,
        ecoreFileId: 253,
        genModelFileId: 254,
      },
    });
  });

  it('takes version, domain and description from the library entry this user knows, not its file', async () => {
    (apiService.getFile as Mock).mockResolvedValue('<ecore/>');
    const library = [{ id: 22, name: 'XD original', version: '1.0', domain: 'cars', description: 'Parts', ecoreFileId: 154 }];

    const resolved = await loadSharedMetaModel(xd, library);

    expect(apiService.getFile).toHaveBeenCalledWith(253);
    expect(resolved?.fileName).toBe('XD (1.0).ecore');
    expect(resolved?.meta).toMatchObject({ version: '1.0', domain: 'cars', description: 'Parts', ecoreFileId: 253 });
  });

  it('resolves null for a metamodel without copy, without asking the backend', async () => {
    await expect(loadSharedMetaModel({ ...xd, copy: undefined }, [])).resolves.toBeNull();

    expect(apiService.getFile).not.toHaveBeenCalled();
  });

  it('fails if the file of the copy cannot be loaded', async () => {
    (apiService.getFile as Mock).mockRejectedValue(new Error('Failed to fetch file: '));

    await expect(loadSharedMetaModel(xd, [])).rejects.toThrow('Failed to fetch file');
  });
});
