import { apiService } from '../services/api';

import { UMLModel } from './ecoreToUml';

import { umlToEcore } from './umlToEcore';

function parseUploadedFileId(data: unknown): number | null {
  if (typeof data === 'number' && Number.isFinite(data)) return data;
  if (typeof data === 'string') {
    const parsed = Number(data);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (data && typeof data === 'object' && 'id' in (data as Record<string, unknown>)) {
    const parsed = Number((data as Record<string, unknown>).id);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isUpdateEndpointMissing(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = Number((err as { status: unknown }).status);
    if (status === 404 || status === 405 || status === 501) return true;
  }
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('not found') || msg.includes('404')
    || msg.includes('method not allowed') || msg.includes('405')
    || msg.includes('not supported');
}

function isDuplicateNameError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = Number((err as { status: unknown }).status);
    if (status === 409) return true;
  }
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('already exist') || msg.includes('duplicate');
}

function buildEcoreFile(content: string, fileName: string): File {
  return new File([content], fileName, { type: 'application/xml' });
}

function normalizeKeywords(keyword: unknown): string[] {
  if (!Array.isArray(keyword)) return [];
  return keyword.filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
}

function buildUpdatePayload(
  meta: Record<string, unknown>,
  newFileId: number,
): Parameters<typeof apiService.updateMetaModel>[1] {
  const keyword = normalizeKeywords(meta.keyword);
  const payload: Parameters<typeof apiService.updateMetaModel>[1] = {
    name: typeof meta.name === 'string' ? meta.name : '',
    description: typeof meta.description === 'string' ? meta.description : '',
    domain: typeof meta.domain === 'string' ? meta.domain : '',
    keyword,
    ecoreFileId: newFileId,
  };
  if (meta.genModelFileId != null) {
    payload.genModelFileId = Number(meta.genModelFileId);
  }
  return payload;
}

export interface MetaModelSaveMetadata {
  description: string;
  domain: string;
  keyword: string[];
  genModelFileId?: number;
}

/** Overwrite ecore content for an existing uploaded file id (no new upload). */
async function overwriteEcoreInPlace(
  ecoreFileId: number,
  ecoreContent: string,
  baseName: string,
): Promise<void> {
  const candidates = [
    `ecore-${ecoreFileId}-${Date.now()}.ecore`,
    `ecore-${ecoreFileId}.ecore`,
    `${baseName}.ecore`,
  ];

  let lastError: unknown;
  for (const name of candidates) {
    try {
      await apiService.updateEcoreFile(ecoreFileId, buildEcoreFile(ecoreContent, name));
      return;
    } catch (err) {
      lastError = err;
      if (isUpdateEndpointMissing(err)) throw err;
      if (isDuplicateNameError(err)) continue;
      throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to overwrite ecore file.');
}

async function resolveMetaModelForRelink(
  metaModelId: string,
  modelName: string,
  hint?: MetaModelSaveMetadata,
): Promise<Parameters<typeof apiService.updateMetaModel>[1]> {
  if (hint) {
    return buildUpdatePayload({ ...hint, name: modelName }, 0);
  }

  try {
    const { data: meta } = await apiService.getMetaModel(metaModelId);
    if (!meta) throw new Error('Metamodel not found.');
    return buildUpdatePayload(meta, 0);
  } catch (getErr) {
    if (!isUpdateEndpointMissing(getErr)) throw getErr;
  }

  const { data: models } = await apiService.getMetaModels();
  const meta = (models ?? []).find((m: { id?: number }) => String(m.id) === String(metaModelId));
  if (!meta) {
    throw new Error('Metamodel not found.');
  }
  return buildUpdatePayload(meta, 0);
}

async function relinkMetaModelEcoreFile(
  metaModelId: string,
  modelName: string,
  newFileId: number,
  hint?: MetaModelSaveMetadata,
): Promise<void> {
  const payload = await resolveMetaModelForRelink(metaModelId, modelName, hint);
  await apiService.updateMetaModel(metaModelId, { ...payload, ecoreFileId: newFileId });
}

async function uploadEcoreRevision(ecoreContent: string, ecoreFileId: number): Promise<number> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    const revisionName = `ecore-${ecoreFileId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.ecore`;
    try {
      const uploadResult = await apiService.uploadFile(
        buildEcoreFile(ecoreContent, revisionName),
        'ECORE',
      );
      const newFileId = parseUploadedFileId(uploadResult?.data);
      if (newFileId != null) return newFileId;
      throw new Error('Ecore upload succeeded but did not return a file ID.');
    } catch (err) {
      lastError = err;
      if (isDuplicateNameError(err) && attempt < 4) continue;
      throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to upload ecore revision.');
}

export interface SaveMetaModelEcoreParams {
  metaModelId: string;
  ecoreFileId: number;
  modelName: string;
  model: UMLModel;
  originalEcore: string;
  /** When set, relink after upload does not need GET /meta-models/{id} (unsupported on some backends). */
  metaModelMetadata?: MetaModelSaveMetadata;
}

export interface SaveMetaModelEcoreResult {
  ecoreContent: string;
  ecoreFileId: number;
}

/** Serialize UML edits to ecore and persist to the backend metamodel library. */
export async function saveMetaModelEcore(
  params: SaveMetaModelEcoreParams,
): Promise<SaveMetaModelEcoreResult> {
  const { metaModelId, ecoreFileId, modelName, model, originalEcore, metaModelMetadata } = params;
  const ecoreContent = umlToEcore(model, originalEcore);
  const baseName = modelName.replace(/\.ecore$/i, '').trim() || 'model';

  try {
    await overwriteEcoreInPlace(ecoreFileId, ecoreContent, baseName);
    return { ecoreContent, ecoreFileId };
  } catch (err) {
    if (!isUpdateEndpointMissing(err)) throw err;

    // Backend has no in-place update endpoint — upload a unique revision and relink.
    const newFileId = await uploadEcoreRevision(ecoreContent, ecoreFileId);
    await relinkMetaModelEcoreFile(metaModelId, modelName, newFileId, metaModelMetadata);
    return { ecoreContent, ecoreFileId: newFileId };
  }
}
