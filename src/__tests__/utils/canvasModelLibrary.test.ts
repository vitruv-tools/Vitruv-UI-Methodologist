import {
  fetchEcoreFileById,
  fetchLibraryDrawerModels,
  metaModelToDrawerModel,
} from '../../utils/canvasModelLibrary';
import { apiService } from '../../services/api';
import type { VsumMetaModelRef } from '../../types/vsum';

jest.mock('../../services/api', () => ({
  apiService: {
    findMetaModels: jest.fn(),
    getFile: jest.fn(),
  },
}));

const createMetaModel = (
  overrides: Partial<VsumMetaModelRef> = {},
): VsumMetaModelRef => ({
  id: 7,
  name: 'Orders',
  description: 'Order domain',
  domain: 'commerce',
  sourceId: 70,
  keyword: ['orders', 'sales'],
  createdAt: '2026-01-02T03:04:05.000Z',
  updatedAt: '2026-01-03T03:04:05.000Z',
  removedAt: null,
  ecoreFileId: 71,
  genModelFileId: 72,
  ...overrides,
});

describe('canvasModelLibrary', () => {
  const findMetaModels = apiService.findMetaModels as jest.MockedFunction<
    typeof apiService.findMetaModels
  >;
  const getFile = apiService.getFile as jest.MockedFunction<typeof apiService.getFile>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps project and library models while preserving fields and source-ID fallback', () => {
    const projectMetaModel = createMetaModel();
    const libraryMetaModel = createMetaModel({
      id: 8,
      name: 'Inventory',
      sourceId: undefined,
    });

    expect(metaModelToDrawerModel(projectMetaModel, true)).toEqual({
      id: 7,
      name: 'Orders',
      sourceId: 70,
      domain: 'commerce',
      ecoreFileId: 71,
      genModelFileId: 72,
      inProject: true,
      description: 'Order domain',
      keyword: ['orders', 'sales'],
      createdAt: '2026-01-02T03:04:05.000Z',
    });
    expect(metaModelToDrawerModel(libraryMetaModel, false)).toEqual({
      id: 8,
      name: 'Inventory',
      sourceId: 8,
      domain: 'commerce',
      ecoreFileId: 71,
      genModelFileId: 72,
      inProject: false,
      description: 'Order domain',
      keyword: ['orders', 'sales'],
      createdAt: '2026-01-02T03:04:05.000Z',
    });
  });

  it('loads owned and public libraries concurrently', async () => {
    let resolveOwned: ((value: { data: VsumMetaModelRef[]; message: string }) => void) | undefined;
    let resolvePublic: ((value: { data: VsumMetaModelRef[]; message: string }) => void) | undefined;
    const ownedResponse = new Promise<{ data: VsumMetaModelRef[]; message: string }>(resolve => {
      resolveOwned = resolve;
    });
    const publicResponse = new Promise<{ data: VsumMetaModelRef[]; message: string }>(resolve => {
      resolvePublic = resolve;
    });
    findMetaModels
      .mockReturnValueOnce(ownedResponse)
      .mockReturnValueOnce(publicResponse);

    const resultPromise = fetchLibraryDrawerModels();

    expect(findMetaModels).toHaveBeenNthCalledWith(1, { ownedByUser: true });
    expect(findMetaModels).toHaveBeenNthCalledWith(2, { ownedByUser: false });

    resolveOwned?.({ data: [createMetaModel({ id: 1, name: 'Owned' })], message: '' });
    resolvePublic?.({ data: [createMetaModel({ id: 2, name: 'Public' })], message: '' });

    await expect(resultPromise).resolves.toEqual({
      myModels: [
        expect.objectContaining({ id: 1, name: 'Owned', inProject: false }),
      ],
      publicModels: [
        expect.objectContaining({ id: 2, name: 'Public', inProject: false }),
      ],
    });
  });

  it('keeps public models when the owned-library request fails', async () => {
    findMetaModels
      .mockRejectedValueOnce(new Error('owned failed'))
      .mockResolvedValueOnce({
        data: [createMetaModel({ id: 2, name: 'Public' })],
        message: '',
      });

    await expect(fetchLibraryDrawerModels()).resolves.toEqual({
      myModels: [],
      publicModels: [
        expect.objectContaining({ id: 2, name: 'Public', inProject: false }),
      ],
    });
  });

  it('keeps owned models when the public-library request fails', async () => {
    findMetaModels
      .mockResolvedValueOnce({
        data: [createMetaModel({ id: 1, name: 'Owned' })],
        message: '',
      })
      .mockRejectedValueOnce(new Error('public failed'));

    await expect(fetchLibraryDrawerModels()).resolves.toEqual({
      myModels: [
        expect.objectContaining({ id: 1, name: 'Owned', inProject: false }),
      ],
      publicModels: [],
    });
  });

  it('returns empty collections when both library requests fail', async () => {
    findMetaModels
      .mockRejectedValueOnce(new Error('owned failed'))
      .mockRejectedValueOnce(new Error('public failed'));

    await expect(fetchLibraryDrawerModels()).resolves.toEqual({
      myModels: [],
      publicModels: [],
    });
  });

  it('delegates Ecore-file loading and returns its content', async () => {
    getFile.mockResolvedValue('<ecore:EPackage />');

    await expect(fetchEcoreFileById(71)).resolves.toBe('<ecore:EPackage />');
    expect(getFile).toHaveBeenCalledWith(71);
  });
});
