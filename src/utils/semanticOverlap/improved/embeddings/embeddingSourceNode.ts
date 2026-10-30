import { existsSync, readFileSync } from 'node:fs';
import { sourceFromFiles } from './embeddingSource';
import { modelBasePath, type EmbeddingModelId } from './modelManifest';
import type { EmbeddingSource } from './types';

/*
 * Node-only loader of the sentence-embedding model (benchmark, ablation and model contract test);
 * kept apart from `embeddingSource.ts` so `node:fs` never reaches the browser bundle.
 */

/** Node (benchmark): reads the same files from `<root>/models/…`; null when they are missing. */
export async function loadEmbeddingSourceFromDisk(id: EmbeddingModelId, root = 'public'): Promise<EmbeddingSource | null> {
  const dir = `${root}/${modelBasePath(id)}`;
  const files = ['manifest.json', 'tokenizer.json', 'tokenizer_config.json', 'model.onnx'];
  if (!files.every(file => existsSync(`${dir}${file}`))) return null;
  const json = (file: string) => JSON.parse(readFileSync(`${dir}${file}`, 'utf8')) as object;
  return sourceFromFiles(id, {
    manifest: json('manifest.json'), tokenizer: json('tokenizer.json'), tokenizerConfig: json('tokenizer_config.json'),
    model: new Uint8Array(readFileSync(`${dir}model.onnx`)),
  });
}
