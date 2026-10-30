import { MODEL_MANIFESTS, modelBasePath, type EmbeddingModelId } from './modelManifest';
import type { EmbeddingAvailability } from './types';

/** Shown to developers when the model is not part of the build. */
export const FETCH_MODEL_HINT = 'Developers: run `node scripts/fetch-embedding-model.mjs`.';

const results = new Map<string, Promise<EmbeddingAvailability>>();

/**
 * Whether the app serves a model: a GET of its `manifest.json` under the asset base, checked against
 * the pinned revision. Cached per page load and model.
 */
export function probeEmbeddingModel(
  id: EmbeddingModelId,
  assetBase: string,
  fetchFile: (url: string) => Promise<Response> = url => fetch(url),
): Promise<EmbeddingAvailability> {
  const url = `${assetBase.endsWith('/') ? assetBase : `${assetBase}/`}${modelBasePath(id)}manifest.json`;
  if (!results.has(url)) {
    results.set(url, fetchFile(url)
      .then(async (response): Promise<EmbeddingAvailability> => {
        if (!response.ok) return { state: 'unavailable', reason: 'The sentence-embedding model is not in this build.' };
        const manifest = await response.json() as { revision?: string };
        return manifest.revision === MODEL_MANIFESTS[id].revision
          ? { state: 'ready' }
          : { state: 'unavailable', reason: 'The sentence-embedding model files do not match the expected version.' };
      })
      .catch(() => ({ state: 'unavailable', reason: 'The sentence-embedding model is not in this build.' })));
  }
  return results.get(url)!;
}

/** Forgets cached probe results (tests). */
export const resetEmbeddingProbe = () => results.clear();
