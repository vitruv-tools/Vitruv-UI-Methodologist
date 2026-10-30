import { cacheKey, type EmbeddingCache } from './embeddingCache';
import { MODEL_MANIFESTS, modelBasePath, type EmbeddingModelId, type EmbeddingModelManifest } from './modelManifest';
import type { EmbeddingModelRef, EmbeddingSource, EmbeddingTable } from './types';

/**
 * Local sentence-embedding inference with onnxruntime-web (WASM, one thread) and the model's own
 * tokenizer. Each text is embedded alone (batch size 1): batching changes the vectors slightly, so
 * only batch size 1 gives the same result on every run.
 */

export type EmbeddingModelErrorReason = 'missing' | 'mismatch' | 'unsupported';

const ERROR_MESSAGES: Record<EmbeddingModelErrorReason, string> = {
  missing: 'The sentence-embedding model is not in this build.',
  mismatch: 'The sentence-embedding model files do not match the expected version.',
  unsupported: 'This browser cannot run the sentence-embedding model.',
};

export class EmbeddingModelError extends Error {
  constructor(public readonly reason: EmbeddingModelErrorReason) {
    super(ERROR_MESSAGES[reason]);
    this.name = 'EmbeddingModelError';
  }
}

/** The parts of an onnxruntime-web inference session that are used. */
export interface OrtSessionLike {
  readonly inputNames: readonly string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: unknown; dims: readonly number[] }>>;
  readonly outputNames: readonly string[];
}

/** Creates an `int64` tensor of shape `[1, n]`. */
export type Int64TensorFactory = (values: BigInt64Array) => unknown;

export interface TokenizerLike {
  encode(text: string): { ids: number[]; attention_mask: number[] };
}

const toInt64 = (values: readonly number[]) => BigInt64Array.from(values, value => BigInt(value));

/** Mean over the attended tokens, or the first (CLS) token; then L2 normalisation. */
function pool(hidden: Float32Array, tokens: number, mask: readonly number[], pooling: 'mean' | 'cls'): Float32Array {
  const dimensions = hidden.length / tokens;
  const vector = new Float32Array(dimensions);
  if (pooling === 'cls') {
    vector.set(hidden.subarray(0, dimensions));
  } else {
    let count = 0;
    for (let t = 0; t < tokens; t++) {
      if (!mask[t]) continue;
      count++;
      for (let d = 0; d < dimensions; d++) vector[d] += hidden[t * dimensions + d];
    }
    for (let d = 0; d < dimensions; d++) vector[d] /= Math.max(1, count);
  }
  const norm = Math.hypot(...vector) || 1;
  for (let d = 0; d < dimensions; d++) vector[d] /= norm;
  return vector;
}

/** An embedding source over an ONNX session; calls are serialised (one text at a time). */
export function createEmbeddingSource(
  session: OrtSessionLike,
  tensor: Int64TensorFactory,
  tokenizer: TokenizerLike,
  manifest: Pick<EmbeddingModelManifest, 'id' | 'revision' | 'sha256' | 'pooling'>,
): EmbeddingSource {
  let queue: Promise<unknown> = Promise.resolve();
  const embedNow = async (text: string) => {
    const { ids, attention_mask: mask } = tokenizer.encode(text);
    const feeds: Record<string, unknown> = { input_ids: tensor(toInt64(ids)), attention_mask: tensor(toInt64(mask)) };
    if (session.inputNames.includes('token_type_ids')) feeds.token_type_ids = tensor(toInt64(ids.map(() => 0)));
    const output = (await session.run(feeds))[session.outputNames[0]];
    return pool(output.data as Float32Array, ids.length, mask, manifest.pooling);
  };
  return {
    model: { id: manifest.id, revision: manifest.revision, sha256: manifest.sha256 },
    embed: text => {
      const result = queue.then(() => embedNow(text));
      queue = result.catch(() => undefined);
      return result;
    },
  };
}

/** Files of a model folder (`manifest.json`, tokenizer files, `model.onnx`). */
export interface ModelFiles {
  manifest: unknown;
  tokenizer: object;
  tokenizerConfig: object;
  model: Uint8Array;
}

/** Checks a folder's `manifest.json` against the pinned manifest. */
function checkManifest(id: EmbeddingModelId, manifest: unknown) {
  const expected = MODEL_MANIFESTS[id];
  const actual = manifest as Partial<EmbeddingModelManifest> | null;
  if (!actual || actual.id !== expected.id || actual.revision !== expected.revision || actual.sha256 !== expected.sha256) {
    throw new EmbeddingModelError('mismatch');
  }
}

export async function sourceFromFiles(id: EmbeddingModelId, files: ModelFiles, configureOrt?: (env: { wasm: object }) => void): Promise<EmbeddingSource> {
  checkManifest(id, files.manifest);
  const manifest = MODEL_MANIFESTS[id];
  try {
    const [ort, { Tokenizer }] = await Promise.all([import('onnxruntime-web/wasm'), import('@huggingface/tokenizers')]);
    ort.env.wasm.numThreads = 1;
    configureOrt?.(ort.env);
    const session = await ort.InferenceSession.create(files.model);
    const tokenizer = new Tokenizer(files.tokenizer, files.tokenizerConfig);
    return createEmbeddingSource(session, values => new ort.Tensor('int64', values, [1, values.length]), tokenizer, manifest);
  } catch (error) {
    if (error instanceof EmbeddingModelError) throw error;
    throw new EmbeddingModelError('unsupported');
  }
}

/**
 * Browser and worker: loads a model served by the app itself from `<assetBase>models/<id>/<revision>/`.
 * `assetBase` comes from the app configuration; the WASM runtime is a same-origin asset as well.
 */
export async function loadEmbeddingSource(
  id: EmbeddingModelId,
  assetBase: string,
  fetchFile: (url: string) => Promise<Response> = url => fetch(url),
): Promise<EmbeddingSource> {
  const base = `${assetBase.endsWith('/') ? assetBase : `${assetBase}/`}${modelBasePath(id)}`;
  const get = async (file: string) => {
    let response: Response;
    try {
      response = await fetchFile(`${base}${file}`);
    } catch {
      throw new EmbeddingModelError('missing');
    }
    if (!response.ok) throw new EmbeddingModelError('missing');
    return response;
  };
  const manifest: unknown = await (await get('manifest.json')).json().catch(() => null);
  checkManifest(id, manifest);
  const [tokenizer, tokenizerConfig, model] = await Promise.all([
    get('tokenizer.json').then(r => r.json() as Promise<object>),
    get('tokenizer_config.json').then(r => r.json() as Promise<object>),
    get('model.onnx').then(async r => new Uint8Array(await r.arrayBuffer())),
  ]);
  const { ORT_WASM_PATHS } = await import('./ortAssets');
  return sourceFromFiles(id, { manifest, tokenizer, tokenizerConfig, model }, env => Object.assign(env.wasm, { wasmPaths: ORT_WASM_PATHS }));
}

/** A source that is only loaded when a text is missing from the cache. */
export interface LazyEmbeddingSource {
  model: EmbeddingModelRef;
  load: () => Promise<EmbeddingSource>;
}

export interface BuildOptions {
  cache?: EmbeddingCache;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

const abortError = () => new DOMException('The embedding was cancelled.', 'AbortError');

/**
 * Embeds the distinct texts in order, one at a time. Cached vectors are used first; the source is
 * only loaded (lazy source) when a text is missing, so a fully cached run never loads the model.
 */
export async function buildEmbeddingTable(
  source: EmbeddingSource | LazyEmbeddingSource,
  texts: readonly string[],
  { cache, onProgress, signal }: BuildOptions = {},
): Promise<EmbeddingTable> {
  const distinct = [...new Set(texts)];
  const vectors = new Map<string, Float32Array>();
  const { model } = source;
  let loaded: EmbeddingSource | null = 'embed' in source ? source : null;
  for (const [k, text] of distinct.entries()) {
    if (signal?.aborted) throw abortError();
    const key = cacheKey(model.sha256, text);
    let vector = await cache?.get(key);
    if (!vector) {
      loaded ??= await (source as LazyEmbeddingSource).load();
      vector = await loaded.embed(text);
      await cache?.set(key, vector);
    }
    vectors.set(text, vector);
    onProgress?.((k + 1) / distinct.length);
  }
  return { model, vectors };
}
