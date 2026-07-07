import {
  extractCreatePayload,
  fetchLibraryMetaModels,
  fetchLibraryMetaModelsAfterCreate,
  findMatchingCreatedModel,
  mergeCreatedMetaModel,
  normalizeCreatedMetaModel,
} from '../../utils/metaModelList';
import { apiService } from '../../services/api';

jest.mock('../../services/api', () => ({
  apiService: {
    findMetaModels: jest.fn(),
  },
}));

describe('fetchLibraryMetaModels', () => {
  const findMetaModels = apiService.findMetaModels as jest.Mock;

  beforeEach(() => {
    findMetaModels.mockReset();
  });

  it('merges owned, shared, and unscoped results by id', async () => {
    findMetaModels
      .mockResolvedValueOnce({ data: [{ id: 1, name: 'Unscoped' }] })
      .mockResolvedValueOnce({ data: [{ id: 2, name: 'Owned' }] })
      .mockResolvedValueOnce({ data: [{ id: 2, name: 'Owned duplicate' }, { id: 3, name: 'Shared' }] });

    const models = await fetchLibraryMetaModels({ name: 'eco' });

    expect(findMetaModels).toHaveBeenCalledTimes(3);
    expect(models.map(m => m.id).sort()).toEqual([1, 2, 3]);
  });

  it('returns empty array when all requests fail', async () => {
    findMetaModels.mockRejectedValue(new Error('network'));
    await expect(fetchLibraryMetaModels({})).resolves.toEqual([]);
  });
});

describe('normalizeCreatedMetaModel', () => {
  it('maps create response fields to a library row when id is present', () => {
    expect(normalizeCreatedMetaModel({
      id: 5,
      name: 'Eco',
      description: 'desc',
      domain: 'test',
      keyword: ['a'],
      ecoreFileId: 1,
      genModelFileId: 2,
    })).toMatchObject({ id: 5, name: 'Eco', domain: 'test' });
  });

  it('builds a pending row from form payload when create returns no id', () => {
    const pending = normalizeCreatedMetaModel({
      name: 'Eco',
      description: 'desc',
      domain: 'test',
      keyword: ['a'],
      ecoreFileId: 1,
      genModelFileId: 2,
    });
    expect(pending?.id).toBeLessThan(0);
    expect(pending?.name).toBe('Eco');
  });
});

describe('extractCreatePayload', () => {
  it('returns null when name is missing', () => {
    expect(extractCreatePayload({ description: 'x' })).toBeNull();
  });
});

describe('findMatchingCreatedModel', () => {
  it('matches by name and file ids', () => {
    const match = findMatchingCreatedModel(
      [{ id: 10, name: 'Eco', ecoreFileId: 1, genModelFileId: 2 }],
      { name: 'Eco', ecoreFileId: 1, genModelFileId: 2 },
    );
    expect(match?.id).toBe(10);
  });
});

describe('mergeCreatedMetaModel', () => {
  it('prepends a pending model when the API list does not include it yet', () => {
    const created = { id: -1, name: 'New' };
    const merged = mergeCreatedMetaModel([{ id: 1, name: 'Old' }], created);
    expect(merged.map(m => m.name)).toEqual(['New', 'Old']);
  });
});

describe('fetchLibraryMetaModelsAfterCreate', () => {
  const findMetaModels = apiService.findMetaModels as jest.Mock;

  beforeEach(() => {
    findMetaModels.mockReset();
  });

  it('returns immediately when the created model is already in find-all', async () => {
    findMetaModels.mockResolvedValue({ data: [{ id: 2, name: 'Eco', ecoreFileId: 1, genModelFileId: 2 }] });

    const models = await fetchLibraryMetaModelsAfterCreate({}, {
      name: 'Eco',
      ecoreFileId: 1,
      genModelFileId: 2,
    }, { maxAttempts: 1, delayMs: 0 });

    expect(models.some(m => m.id === 2)).toBe(true);
  });

  it('shows an optimistic row when find-all does not include the new model yet', async () => {
    findMetaModels.mockResolvedValue({ data: [{ id: 1, name: 'Old' }] });

    const models = await fetchLibraryMetaModelsAfterCreate({}, {
      name: 'Eco',
      ecoreFileId: 1,
      genModelFileId: 2,
    }, { maxAttempts: 1, delayMs: 0 });

    expect(models[0].name).toBe('Eco');
    expect(models[0].id).toBeLessThan(0);
  });
});
