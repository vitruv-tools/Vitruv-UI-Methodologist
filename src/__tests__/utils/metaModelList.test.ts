import {
  buildPendingMetaModelFromCreate,
  createPayloadKey,
  extractCreatePayload,
  fetchLibraryMetaModels,
  fetchLibraryMetaModelsAfterCreate,
  findMatchingCreatedModel,
  forgetPendingCreate,
  isSameCreatePayload,
  mergeCreatedMetaModel,
  mergePendingCreates,
  normalizeCreatedMetaModel,
  readPendingCreates,
  rememberPendingCreate,
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
    sessionStorage.clear();
  });

  it('merges owned, shared, and unscoped results by id', async () => {
    findMetaModels
      .mockResolvedValueOnce({ data: [{ id: 2, name: 'Owned' }] })
      .mockResolvedValueOnce({ data: [{ id: 1, name: 'Unscoped' }] })
      .mockResolvedValueOnce({ data: [{ id: 3, name: 'Shared' }] });

    const models = await fetchLibraryMetaModels({ name: 'eco' });

    expect(findMetaModels).toHaveBeenCalledTimes(3);
    expect(findMetaModels).toHaveBeenNthCalledWith(1, { name: 'eco', ownedByUser: true });
    expect(findMetaModels).toHaveBeenNthCalledWith(2, { name: 'eco' });
    expect(findMetaModels).toHaveBeenNthCalledWith(3, { name: 'eco', ownedByUser: false });
    expect(models.map(m => m.id).sort()).toEqual([1, 2, 3]);
  });

  it('returns empty array when all requests fail', async () => {
    findMetaModels.mockRejectedValue(new Error('network'));
    await expect(fetchLibraryMetaModels({})).resolves.toEqual([]);
  });

  it('restores pending creates from session storage after reload', async () => {
    rememberPendingCreate({ name: 'Eco', ecoreFileId: 1, genModelFileId: 2 });
    findMetaModels.mockResolvedValue({ data: [{ id: 1, name: 'Old' }] });

    const models = await fetchLibraryMetaModels({});

    expect(models.map(m => m.name)).toEqual(['Eco', 'Old']);
  });

  it('normalizes paginated find-all responses', async () => {
    findMetaModels
      .mockResolvedValueOnce({ data: { content: [{ id: 4, name: 'Paged', createdAt: '2024-01-02' }] } })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });

    const models = await fetchLibraryMetaModels({});
    expect(models).toEqual([{ id: 4, name: 'Paged', createdAt: '2024-01-02' }]);
  });

  it('ignores malformed find-all payloads', async () => {
    findMetaModels
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { content: 'not-an-array' } })
      .mockResolvedValueOnce({ data: [{ id: 6, name: 'Valid' }] });

    const models = await fetchLibraryMetaModels({});
    expect(models).toEqual([{ id: 6, name: 'Valid' }]);
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

  it('returns null when the payload cannot be parsed', () => {
    expect(normalizeCreatedMetaModel({ description: 'missing name' })).toBeNull();
  });
});

describe('extractCreatePayload', () => {
  it('returns null when name is missing', () => {
    expect(extractCreatePayload({ description: 'x' })).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(extractCreatePayload(null)).toBeNull();
    expect(extractCreatePayload('Eco')).toBeNull();
  });

  it('maps optional fields and filters invalid keywords', () => {
    expect(extractCreatePayload({
      name: ' Eco ',
      description: 'desc',
      domain: 'Testing',
      keyword: ['a', 1, 'b'],
      ecoreFileId: '3',
      genModelFileId: '4',
    })).toEqual({
      name: 'Eco',
      description: 'desc',
      domain: 'Testing',
      keyword: ['a', 'b'],
      ecoreFileId: 3,
      genModelFileId: 4,
    });
  });
});

describe('create payload helpers', () => {
  it('builds stable keys and compares payloads', () => {
    const payload = { name: 'Eco', ecoreFileId: 1, genModelFileId: 2 };
    expect(createPayloadKey(payload)).toBe('eco|1|2');
    expect(isSameCreatePayload(payload, { ...payload })).toBe(true);
    expect(isSameCreatePayload(payload, { name: 'Other', ecoreFileId: 1, genModelFileId: 2 })).toBe(false);
  });

  it('builds pending rows from create payloads', () => {
    const row = buildPendingMetaModelFromCreate({
      name: 'Eco',
      description: 'desc',
      domain: 'Testing',
      keyword: ['uml'],
      ecoreFileId: 1,
      genModelFileId: 2,
    });
    expect(row.id).toBeLessThan(0);
    expect(row.name).toBe('Eco');
    expect(row.createdAt).toBeDefined();
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

  it('ignores optimistic rows and mismatched file ids', () => {
    expect(findMatchingCreatedModel(
      [{ id: -1, name: 'Eco', ecoreFileId: 1, genModelFileId: 2 }],
      { name: 'Eco', ecoreFileId: 1, genModelFileId: 2 },
    )).toBeNull();
    expect(findMatchingCreatedModel(
      [{ id: 10, name: 'Eco', ecoreFileId: 9, genModelFileId: 2 }],
      { name: 'Eco', ecoreFileId: 1, genModelFileId: 2 },
    )).toBeNull();
  });
});

describe('mergeCreatedMetaModel', () => {
  it('prepends a pending model when the API list does not include it yet', () => {
    const created = { id: -1, name: 'New' };
    const merged = mergeCreatedMetaModel([{ id: 1, name: 'Old' }], created);
    expect(merged.map(m => m.name)).toEqual(['New', 'Old']);
  });

  it('returns the original list when created model is null', () => {
    const models = [{ id: 1, name: 'Old' }];
    expect(mergeCreatedMetaModel(models, null)).toBe(models);
  });

  it('promotes an existing real model when create returns an id', () => {
    const existing = { id: 5, name: 'Eco', createdAt: '2024-01-01' };
    const merged = mergeCreatedMetaModel(
      [{ id: 1, name: 'Old' }, existing],
      { id: 5, name: 'Eco', createdAt: '2024-02-01' },
    );
    expect(merged.map(m => m.id)).toEqual([5, 1]);
    expect(merged[0]).toBe(existing);
  });

  it('does not duplicate rows that already exist by id', () => {
    const existing = { id: -99, name: 'Pending' };
    expect(mergeCreatedMetaModel([existing], existing)).toEqual([existing]);
  });
});

describe('pending create storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns an empty list when storage is missing or invalid', () => {
    expect(readPendingCreates()).toEqual([]);

    sessionStorage.setItem('vitruv.pendingMetaModelCreates', '{bad json');
    expect(readPendingCreates()).toEqual([]);

    sessionStorage.setItem('vitruv.pendingMetaModelCreates', '{"name":"Eco"}');
    expect(readPendingCreates()).toEqual([]);
  });

  it('remembers and merges pending creates across reloads', () => {
    const payload = { name: 'Eco', ecoreFileId: 1, genModelFileId: 2 };
    rememberPendingCreate(payload);

    const merged = mergePendingCreates([{ id: 10, name: 'Old' }], readPendingCreates());
    expect(merged.map(m => m.name)).toEqual(['Eco', 'Old']);
    expect(merged[0].id).toBeLessThan(0);
  });

  it('forgets pending creates once the API returns the model', () => {
    const payload = { name: 'Eco', ecoreFileId: 1, genModelFileId: 2 };
    rememberPendingCreate(payload);

    mergePendingCreates(
      [{ id: 5, name: 'Eco', ecoreFileId: 1, genModelFileId: 2 }],
      readPendingCreates(),
    );

    expect(readPendingCreates()).toEqual([]);
  });

  it('deduplicates remembered payloads and supports explicit forget', () => {
    const payload = { name: 'Eco', ecoreFileId: 1, genModelFileId: 2 };
    rememberPendingCreate(payload);
    rememberPendingCreate(payload);
    expect(readPendingCreates()).toHaveLength(1);

    forgetPendingCreate(payload);
    expect(readPendingCreates()).toEqual([]);
  });
});

describe('fetchLibraryMetaModelsAfterCreate', () => {
  const findMetaModels = apiService.findMetaModels as jest.Mock;

  beforeEach(() => {
    findMetaModels.mockReset();
    sessionStorage.clear();
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
    expect(readPendingCreates()).toHaveLength(1);
  });

  it('polls find-all until the created model appears', async () => {
    findMetaModels
      .mockResolvedValueOnce({ data: [{ id: 1, name: 'Old' }] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 2, name: 'Eco', ecoreFileId: 1, genModelFileId: 2 }] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });

    const models = await fetchLibraryMetaModelsAfterCreate({}, {
      name: 'Eco',
      ecoreFileId: 1,
      genModelFileId: 2,
    }, { maxAttempts: 2, delayMs: 0 });

    expect(models.some(m => m.id === 2)).toBe(true);
    expect(readPendingCreates()).toEqual([]);
  });
});
