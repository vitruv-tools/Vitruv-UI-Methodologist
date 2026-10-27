import {
  loadWordNetSource,
  noLexicalSource,
  type LexicalSource,
} from '../utils/semanticOverlap/lexical/wordNetSource';
import { runOverlapAnalysis } from '../utils/semanticOverlap/runOverlapAnalysis';
import type { OverlapInput, OverlapResult, ProgressPhase } from '../utils/semanticOverlap/types';

/** Main thread → worker. Cancelling is `worker.terminate()`. */
export type ToWorker = { type: 'start'; runId: string; input: OverlapInput };

/** Worker → main thread; exactly one `done` or `error` per run. */
export type FromWorker =
  | { type: 'progress'; runId: string; phase: Exclude<ProgressPhase, 'loading'>; fraction: number }
  | { type: 'warning'; runId: string; message: string }
  | { type: 'done'; runId: string; result: OverlapResult }
  | { type: 'error'; runId: string; message: string };

export interface WorkerDeps {
  loadLexicalSource: () => Promise<LexicalSource>;
  /** Milliseconds; used to throttle progress messages. */
  now: () => number;
}

const PROGRESS_INTERVAL_MS = 100;

/** Handles one message; separate from the worker global so it can be tested directly. */
export async function handleWorkerMessage(
  message: ToWorker,
  post: (reply: FromWorker) => void,
  deps: WorkerDeps = { loadLexicalSource: loadWordNetSource, now: Date.now },
): Promise<void> {
  if (message.type !== 'start') return;
  const { runId, input } = message;
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
    const result = runOverlapAnalysis(input, {
      lexical,
      onProgress: p => { if (p.phase !== 'loading') progress(p.phase, p.fraction); },
    });
    post({ type: 'done', runId, result });
  } catch (error) {
    post({ type: 'error', runId, message: error instanceof Error ? error.message : String(error) });
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
