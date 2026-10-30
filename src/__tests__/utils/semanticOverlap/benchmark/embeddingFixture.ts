import path from 'node:path';
import { describeAll } from '../../../../utils/semanticOverlap/improved/embeddings/describe';
import { memoryEmbeddingCache } from '../../../../utils/semanticOverlap/improved/embeddings/embeddingCache';
import { buildEmbeddingTable } from '../../../../utils/semanticOverlap/improved/embeddings/embeddingSource';
import { loadEmbeddingSourceFromDisk } from '../../../../utils/semanticOverlap/improved/embeddings/embeddingSourceNode';
import type { EmbeddingModelId } from '../../../../utils/semanticOverlap/improved/embeddings/modelManifest';
import type { EmbeddingSource, EmbeddingTable } from '../../../../utils/semanticOverlap/improved/embeddings/types';
import type { LoadedScenario } from './suite';

/** Where the fetch script puts the model (`public/models/…`, git-ignored). */
export const MODEL_ROOT = path.resolve(__dirname, '../../../../../public');

const sources = new Map<EmbeddingModelId, Promise<EmbeddingSource | null>>();
const tables = new Map<string, Promise<EmbeddingTable | null>>();
const cache = memoryEmbeddingCache();

/**
 * The embedding table of a scenario with the real model read from disk, or null when the model is
 * not fetched. Covers every class, feature and path description, so all configurations of the
 * ablation share one table per scenario and model.
 */
export function embeddingTableFor(loaded: LoadedScenario, model: EmbeddingModelId = 'minilm'): Promise<EmbeddingTable | null> {
  const key = `${model}|${loaded.scenario.id}`;
  if (!tables.has(key)) {
    if (!sources.has(model)) sources.set(model, loadEmbeddingSourceFromDisk(model, MODEL_ROOT));
    tables.set(key, sources.get(model)!.then(source => (source
      ? buildEmbeddingTable(source, describeAll(loaded.source, loaded.target, { paths: true }).map(d => d.text), { cache })
      : null)));
  }
  return tables.get(key)!;
}
