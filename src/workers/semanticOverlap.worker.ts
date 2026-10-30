import {
  loadWordNetSource,
  noLexicalSource,
  type LexicalSource,
} from '../utils/semanticOverlap/lexical/wordNetSource';
import { approachOf } from '../utils/semanticOverlap/approaches/registry';
import type { ApproachId } from '../utils/semanticOverlap/approaches/types';
import { loadHypernymSource, type HypernymSource } from '../utils/semanticOverlap/improved/lexical/hypernymSource';
import { indexedDbEmbeddingCache, type EmbeddingCache } from '../utils/semanticOverlap/improved/embeddings/embeddingCache';
import { buildEmbeddingTable, loadEmbeddingSource } from '../utils/semanticOverlap/improved/embeddings/embeddingSource';
import { MODEL_MANIFESTS, type EmbeddingModelId } from '../utils/semanticOverlap/improved/embeddings/modelManifest';
import type { EmbeddingSource, EmbeddingTable } from '../utils/semanticOverlap/improved/embeddings/types';
import type { ImprovedSettings } from '../utils/semanticOverlap/improved/settings';
import type { OverlapInput, OverlapResult, ProgressPhase } from '../utils/semanticOverlap/types';

/**
 * Main thread → worker. Cancelling is `worker.terminate()`. Without `approach` the paper approach
 * runs; the settings in `input` must match the approach. `assetBase` is the app's asset base URL
 * (from the app configuration), where the sentence-embedding model is served.
 */
export type ToWorker = { type: 'start'; runId: string; approach?: ApproachId; input: OverlapInput; assetBase?: string };

/** Worker → main thread; exactly one `done` or `error` per run. */
export type FromWorker =
  | { type: 'progress'; runId: string; phase: Exclude<ProgressPhase, 'loading'>; fraction: number }
  | { type: 'warning'; runId: string; message: string }
  | { type: 'done'; runId: string; result: OverlapResult }
  | { type: 'error'; runId: string; message: string };

export interface WorkerDeps {
  loadLexicalSource: () => Promise<LexicalSource>;
  /** WordNet hypernyms, only loaded for approaches that need them. */
  loadHypernymSource?: () => Promise<HypernymSource>;
  /** Sentence-embedding model, only loaded for approaches that need it and on a cache miss. */
  loadEmbeddingSource?: (id: EmbeddingModelId, assetBase: string) => Promise<EmbeddingSource>;
  embeddingCache?: () => EmbeddingCache;
  /** Milliseconds; used to throttle progress messages. */
  now: () => number;
}

const PROGRESS_INTERVAL_MS = 100;
/** Share of the progress bar used by the embedding phase when it runs. */
const EMBEDDING_SHARE = 0.3;


/** Handles one message; separate from the worker global so it can be tested directly. */
export async function handleWorkerMessage(
  message: ToWorker,
  post: (reply: FromWorker) => void,
  deps: WorkerDeps = { loadLexicalSource: loadWordNetSource, now: Date.now },
): Promise<void> {
  if (message.type !== 'start') return;
  const { runId, input } = message;
  const approach = approachOf(message.approach ?? 'paper');
  let lastFraction = 0;
  let lastPostedAt = Number.NEGATIVE_INFINITY;
  const progress = (phase: Exclude<ProgressPhase, 'loading'>, fraction: number, force = false) => {
    if (fraction < lastFraction) return;
    const time = deps.now();
    if (!force && time - lastPostedAt < PROGRESS_INTERVAL_MS) return;
    lastFraction = fraction;
    lastPostedAt = time;
    post({ type: 'progress', runId, phase, fraction });
  };

  try {
    progress('lexicon', 0, true);
    let lexical: LexicalSource;
    try {
      lexical = await deps.loadLexicalSource();
    } catch {
      lexical = noLexicalSource;
      post({ type: 'warning', runId, message: 'WordNet synonyms could not be loaded; names are compared without synonyms.' });
    }
    let hypernyms: HypernymSource | null = null;
    if (approach.requiredResources(input.settings).includes('hypernyms')) {
      try {
        hypernyms = await (deps.loadHypernymSource ?? loadHypernymSource)();
      } catch {
        post({ type: 'warning', runId, message: 'WordNet hypernyms could not be loaded; hypernym similarity was skipped.' });
      }
    }
    let embeddings: EmbeddingTable | null = null;
    const embeddingWarnings: string[] = [];
    const embeddingsRequired = approach.requiredResources(input.settings).includes('embeddings');
    if (embeddingsRequired) {
      progress('embeddings', 0, true);
      embeddings = await prepareEmbeddings(message, approach.describe?.(input) ?? [], deps,
        fraction => progress('embeddings', fraction * EMBEDDING_SHARE), warning => {
          embeddingWarnings.push(warning);
          post({ type: 'warning', runId, message: warning });
        });
    }
    const offset = embeddingsRequired ? EMBEDDING_SHARE : 0;
    const result = approach.run(input, {
      lexical,
      hypernyms,
      embeddings,
      onProgress: p => { if (p.phase !== 'loading') progress(p.phase, offset + p.fraction * (1 - offset)); },
    });
    post({ type: 'done', runId, result: { ...result, warnings: [...embeddingWarnings, ...result.warnings] } });
  } catch (error) {
    post({ type: 'error', runId, message: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Embeds the element descriptions with the model served by the app. Returns null, with a warning,
 * when there are too many descriptions for the time budget or the model cannot be loaded; the
 * model is only loaded when a description is missing from the cache.
 */
async function prepareEmbeddings(
  message: ToWorker,
  descriptions: readonly { text: string }[],
  deps: WorkerDeps,
  onProgress: (fraction: number) => void,
  warn: (message: string) => void,
): Promise<EmbeddingTable | null> {
  const { params } = message.input.settings as ImprovedSettings;
  const texts = [...new Set(descriptions.map(d => d.text))];
  if (texts.length > params.embeddingMaxTexts) {
    warn(`Sentence-embedding measure skipped: ${texts.length} element descriptions exceed the limit of ${params.embeddingMaxTexts}.`);
    return null;
  }
  const { id, revision, sha256 } = MODEL_MANIFESTS[params.embeddingModel];
  const load = deps.loadEmbeddingSource ?? loadEmbeddingSource;
  try {
    return await buildEmbeddingTable({ model: { id, revision, sha256 }, load: () => load(id, message.assetBase ?? '/') }, texts, {
      cache: (deps.embeddingCache ?? indexedDbEmbeddingCache)(),
      onProgress,
    });
  } catch (error) {
    warn(`Sentence-embedding measure skipped: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// Worker wiring; skipped when imported outside a worker (e.g. in tests).
const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
  postMessage?: (message: FromWorker) => void;
  WorkerGlobalScope?: unknown;
};
if (typeof workerScope.WorkerGlobalScope !== 'undefined') {
  workerScope.onmessage = event => {
    void handleWorkerMessage(event.data, reply => workerScope.postMessage?.(reply));
  };
}
