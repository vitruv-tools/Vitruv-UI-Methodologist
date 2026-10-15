import { apiService } from '../services/api';
import { MetaModelFindFilters } from './metaModelSearchFilters';
import { displayMetaModelVersion } from './metaModelVersion';

export interface LibraryMetaModel {
  id: number;
  name: string;
  version?: string;
  description?: string;
  domain?: string;
  keyword?: string[];
  createdAt?: string;
  updatedAt?: string;
  ecoreFileId?: number;
  genModelFileId?: number;
  /** Projects (V-SUMs) using this model through a clone, one entry per project. */
  vsums?: MetaModelVsumUsage[];
  projects?: unknown[];
  /** True when the current user owns this model (derived from the `ownedByUser: true` fetch bucket). */
  isOwnedByCurrentUser?: boolean;
}

/**
 * A project (V-SUM) that uses a library model. The backend leaves all fields empty for projects
 * the current user is not a member of, so only the entry itself counts for those.
 */
export interface MetaModelVsumUsage {
  id?: number | null;
  name?: string | null;
  /** Set when the project is in the trash; it still blocks deleting the model. */
  removedAt?: string | null;
}

/** Number of projects that use the model. */
export function getProjectUsageCount(model: LibraryMetaModel): number {
  return Math.max(model.vsums?.length ?? 0, model.projects?.length ?? 0);
}

/** True when a model is referenced by at least one project in any V-SUM. */
export function isModelReferencedByProjects(model: LibraryMetaModel): boolean {
  return getProjectUsageCount(model) > 0;
}

const pluralizeProjects = (count: number) => `${count} ${count === 1 ? 'project' : 'projects'}`;

/** Short badge text such as "1 project" or "3 projects". */
export function formatProjectUsageLabel(model: LibraryMetaModel): string {
  return pluralizeProjects(getProjectUsageCount(model));
}

/**
 * Names of the projects using the model, e.g. "Alpha, Beta (in trash), 1 other project".
 * Projects the current user cannot see are only counted.
 */
export function describeProjectUsage(model: LibraryMetaModel): string {
  const visibleNames = (model.vsums ?? [])
    .filter((vsum): vsum is MetaModelVsumUsage & { name: string } => Boolean(vsum?.name))
    .map((vsum) => (vsum.removedAt ? `${vsum.name} (in trash)` : vsum.name));
  const hiddenCount = getProjectUsageCount(model) - visibleNames.length;
  if (hiddenCount <= 0) return visibleNames.join(', ');
  const hidden = visibleNames.length > 0
    ? `${hiddenCount} other ${hiddenCount === 1 ? 'project' : 'projects'}`
    : pluralizeProjects(hiddenCount);
  return [...visibleNames, hidden].join(', ');
}

export interface CreateMetaModelPayload {
  name: string;
  version?: string;
  description?: string;
  domain?: string;
  keyword?: string[];
  ecoreFileId?: number;
  genModelFileId?: number;
}

const sleep = (ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); });

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

  const version = typeof obj.version === 'string' ? obj.version.trim() : '';

  return {
    name,
    version: version || undefined,
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
        isOwnedByCurrentUser: true,
      };
    }
  }

  return buildPendingMetaModelFromCreate(payload);
}

export function buildPendingMetaModelFromCreate(payload: CreateMetaModelPayload): LibraryMetaModel {
  return {
    id: -Math.abs(Date.now()),
    name: payload.name,
    version: payload.version,
    description: payload.description,
    domain: payload.domain,
    keyword: payload.keyword,
    createdAt: new Date().toISOString(),
    ecoreFileId: payload.ecoreFileId,
    genModelFileId: payload.genModelFileId,
    // The current user always owns a model they just created.
    isOwnedByCurrentUser: true,
  };
}

export function findMatchingCreatedModel(
  models: LibraryMetaModel[],
  payload: CreateMetaModelPayload,
): LibraryMetaModel | null {
  const targetName = payload.name.trim().toLowerCase();
  return models.find((model) => {
    if (model.name.trim().toLowerCase() !== targetName) return false;
    if (
      payload.version != null
      && displayMetaModelVersion(model.version) !== displayMetaModelVersion(payload.version)
    ) {
      return false;
    }
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
 * Queries owned, shared, and unscoped lists — backends may place newly created
 * models in different buckets depending on ownership flags.
 */
export async function fetchLibraryMetaModels(
  filters: MetaModelFindFilters,
): Promise<LibraryMetaModel[]> {
  const baseFilters = stripOwnedByUser(filters);

  const [unscopedResult, ownedResult, sharedResult] = await Promise.allSettled([
    apiService.findMetaModels(baseFilters),
    apiService.findMetaModels({ ...baseFilters, ownedByUser: true }),
    apiService.findMetaModels({ ...baseFilters, ownedByUser: false }),
  ]);

  const lists: LibraryMetaModel[][] = [];
  for (const result of [unscopedResult, ownedResult, sharedResult]) {
    if (result.status === 'fulfilled') {
      lists.push(normalizeMetaModelList(result.value.data));
    }
  }

  const ownedIds = new Set(
    ownedResult.status === 'fulfilled'
      ? normalizeMetaModelList(ownedResult.value.data).map(m => m.id)
      : [],
  );

  return mergeMetaModelsById(lists).map(model => ({
    ...model,
    isOwnedByCurrentUser: ownedIds.has(model.id),
  }));
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
  const maxAttempts = options?.maxAttempts ?? 4;
  const delayMs = options?.delayMs ?? 700;

  let lastModels: LibraryMetaModel[] = [];
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) await sleep(delayMs);
    lastModels = await fetchLibraryMetaModels(filters);
    if (findMatchingCreatedModel(lastModels, created)) {
      return lastModels;
    }
  }

  return mergeCreatedMetaModel(lastModels, buildPendingMetaModelFromCreate(created));
}
