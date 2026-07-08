import { apiService } from '../services/api';
import { MetaModelFindFilters } from './metaModelSearchFilters';

export interface LibraryMetaModel {
  id: number;
  name: string;
  description?: string;
  domain?: string;
  keyword?: string[];
  createdAt?: string;
  updatedAt?: string;
  ecoreFileId?: number;
  genModelFileId?: number;
  vsums?: unknown[];
  projects?: unknown[];
}

export interface CreateMetaModelPayload {
  name: string;
  description?: string;
  domain?: string;
  keyword?: string[];
  ecoreFileId?: number;
  genModelFileId?: number;
}

const sleep = (ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); });

const PENDING_CREATES_STORAGE_KEY = 'vitruv.pendingMetaModelCreates';

export function createPayloadKey(payload: CreateMetaModelPayload): string {
  return `${payload.name.trim().toLowerCase()}|${payload.ecoreFileId ?? ''}|${payload.genModelFileId ?? ''}`;
}

export function isSameCreatePayload(a: CreateMetaModelPayload, b: CreateMetaModelPayload): boolean {
  return createPayloadKey(a) === createPayloadKey(b);
}

export function readPendingCreates(): CreateMetaModelPayload[] {
  try {
    const raw = sessionStorage.getItem(PENDING_CREATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(item => extractCreatePayload(item))
      .filter((item): item is CreateMetaModelPayload => item != null);
  } catch {
    return [];
  }
}

export function rememberPendingCreate(payload: CreateMetaModelPayload): void {
  const pending = readPendingCreates().filter(item => !isSameCreatePayload(item, payload));
  sessionStorage.setItem(PENDING_CREATES_STORAGE_KEY, JSON.stringify([payload, ...pending]));
}

export function forgetPendingCreate(payload: CreateMetaModelPayload): void {
  const pending = readPendingCreates().filter(item => !isSameCreatePayload(item, payload));
  sessionStorage.setItem(PENDING_CREATES_STORAGE_KEY, JSON.stringify(pending));
}

export function mergePendingCreates(
  models: LibraryMetaModel[],
  pending: CreateMetaModelPayload[],
): LibraryMetaModel[] {
  let merged = models;
  for (const payload of pending) {
    if (findMatchingCreatedModel(merged, payload)) {
      forgetPendingCreate(payload);
      continue;
    }
    merged = mergeCreatedMetaModel(merged, buildPendingMetaModelFromCreate(payload));
  }
  return merged;
}

function normalizeMetaModelList(data: unknown): LibraryMetaModel[] {
  if (Array.isArray(data)) return data as LibraryMetaModel[];
  if (data && typeof data === 'object' && Array.isArray((data as { content?: unknown[] }).content)) {
    return (data as { content: LibraryMetaModel[] }).content;
  }
  return [];
}

export function extractCreatePayload(data: unknown): CreateMetaModelPayload | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  if (!name) return null;

  return {
    name,
    description: typeof obj.description === 'string' ? obj.description : undefined,
    domain: typeof obj.domain === 'string' ? obj.domain : undefined,
    keyword: Array.isArray(obj.keyword)
      ? obj.keyword.filter((k): k is string => typeof k === 'string')
      : undefined,
    ecoreFileId: Number.isFinite(Number(obj.ecoreFileId)) ? Number(obj.ecoreFileId) : undefined,
    genModelFileId: Number.isFinite(Number(obj.genModelFileId)) ? Number(obj.genModelFileId) : undefined,
  };
}

export function normalizeCreatedMetaModel(data: unknown): LibraryMetaModel | null {
  const payload = extractCreatePayload(data);
  if (!payload) return null;

  if (data && typeof data === 'object') {
    const id = Number((data as Record<string, unknown>).id);
    if (Number.isFinite(id)) {
      return {
        id,
        ...payload,
        createdAt: typeof (data as Record<string, unknown>).createdAt === 'string'
          ? (data as Record<string, unknown>).createdAt as string
          : new Date().toISOString(),
      };
    }
  }

  return buildPendingMetaModelFromCreate(payload);
}

export function buildPendingMetaModelFromCreate(payload: CreateMetaModelPayload): LibraryMetaModel {
  return {
    id: -Math.abs(Date.now()),
    name: payload.name,
    description: payload.description,
    domain: payload.domain,
    keyword: payload.keyword,
    createdAt: new Date().toISOString(),
    ecoreFileId: payload.ecoreFileId,
    genModelFileId: payload.genModelFileId,
  };
}

export function findMatchingCreatedModel(
  models: LibraryMetaModel[],
  payload: CreateMetaModelPayload,
): LibraryMetaModel | null {
  const targetName = payload.name.trim().toLowerCase();
  return models.find((model) => {
    if (model.name.trim().toLowerCase() !== targetName) return false;
    if (payload.ecoreFileId != null && model.ecoreFileId !== payload.ecoreFileId) return false;
    if (payload.genModelFileId != null && model.genModelFileId !== payload.genModelFileId) return false;
    return model.id > 0;
  }) ?? null;
}

export function mergeCreatedMetaModel(
  models: LibraryMetaModel[],
  createdModel: LibraryMetaModel | null,
): LibraryMetaModel[] {
  if (!createdModel) return models;

  const realMatch = createdModel.id > 0
    ? models.find(m => m.id === createdModel.id)
    : findMatchingCreatedModel(models, createdModel);

  if (realMatch) {
    return [realMatch, ...models.filter(m => m.id !== realMatch.id && m.id !== createdModel.id)];
  }

  if (models.some(m => m.id === createdModel.id)) return models;
  return [createdModel, ...models];
}

function mergeMetaModelsById(lists: LibraryMetaModel[][]): LibraryMetaModel[] {
  const byId = new Map<number, LibraryMetaModel>();
  for (const list of lists) {
    for (const model of list) {
      if (model?.id != null && model.id > 0) byId.set(model.id, model);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
  );
}

function stripOwnedByUser(filters: MetaModelFindFilters): Omit<MetaModelFindFilters, 'ownedByUser'> {
  const copy = { ...filters };
  delete copy.ownedByUser;
  return copy;
}

/**
 * Load models for the Model Library page.
 * User uploads appear under ownedByUser=true; we also merge shared/public buckets
 * so older entries remain visible across backend variants.
 */
export async function fetchLibraryMetaModels(
  filters: MetaModelFindFilters,
): Promise<LibraryMetaModel[]> {
  const baseFilters = stripOwnedByUser(filters);

  const requests = [
    apiService.findMetaModels({ ...baseFilters, ownedByUser: true }),
    apiService.findMetaModels(baseFilters),
    apiService.findMetaModels({ ...baseFilters, ownedByUser: false }),
  ];

  const results = await Promise.allSettled(requests);
  const lists: LibraryMetaModel[][] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      lists.push(normalizeMetaModelList(result.value.data));
    }
  }

  const merged = mergeMetaModelsById(lists);
  return mergePendingCreates(merged, readPendingCreates());
}

/**
 * POST /meta-models returns void in the OpenAPI spec, so we poll find-all briefly
 * and fall back to an optimistic row built from the create form payload.
 */
export async function fetchLibraryMetaModelsAfterCreate(
  filters: MetaModelFindFilters,
  created: CreateMetaModelPayload,
  options?: { maxAttempts?: number; delayMs?: number },
): Promise<LibraryMetaModel[]> {
  const maxAttempts = options?.maxAttempts ?? 6;
  const delayMs = options?.delayMs ?? 1000;

  let lastModels: LibraryMetaModel[] = [];
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) await sleep(delayMs);
    lastModels = await fetchLibraryMetaModels(filters);
    if (findMatchingCreatedModel(lastModels, created)) {
      forgetPendingCreate(created);
      return lastModels;
    }
  }

  rememberPendingCreate(created);
  return mergeCreatedMetaModel(lastModels, buildPendingMetaModelFromCreate(created));
}
