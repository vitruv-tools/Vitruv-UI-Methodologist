import models from './models.json';

/** Sentence-embedding models the improved approach can use (served by the app, never committed). */
export type EmbeddingModelId = 'minilm' | 'bge-small';

export interface EmbeddingModelManifest {
  id: EmbeddingModelId;
  /** Hugging Face repository the files are fetched from at build time. */
  hfRepo: string;
  /** Pinned commit of {@link hfRepo}. */
  revision: string;
  /** Path of the ONNX model within the repository; stored as `model.onnx`. */
  file: string;
  /** SHA-256 (hex) of the ONNX model. */
  sha256: string;
  pooling: 'mean' | 'cls';
  dimensions: 384;
  licence: string;
  sizeBytes: number;
}

/** Pinned models; `models.json` is shared with `scripts/fetch-embedding-model.mjs`. */
export const MODEL_MANIFESTS = models as Record<EmbeddingModelId, EmbeddingModelManifest>;

export const EMBEDDING_MODEL_IDS = Object.keys(MODEL_MANIFESTS) as EmbeddingModelId[];

export const DEFAULT_EMBEDDING_MODEL: EmbeddingModelId = 'minilm';

export const isEmbeddingModelId = (value: unknown): value is EmbeddingModelId =>
  typeof value === 'string' && (EMBEDDING_MODEL_IDS as string[]).includes(value);

/** Folder of a model relative to the app's asset base, e.g. `models/minilm/<revision>/`. */
export const modelBasePath = (id: EmbeddingModelId) => `models/${id}/${MODEL_MANIFESTS[id].revision}/`;
