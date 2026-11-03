import type { FromWorker, ToWorker } from '../../workers/semanticOverlap.worker';
import type { ApproachId } from './approaches/types';
import type { OverlapInput, OverlapResult, Progress } from './types';

/** Hard limit for one analysis. */
export const ANALYSIS_TIMEOUT_MS = 5 * 60 * 1000;
export const TIMEOUT_MESSAGE = 'Analysis stopped after 5 minutes — try a lower effort setting.';
const WORKER_FAILED_MESSAGE = 'The analysis failed.';

export interface OverlapWorker {
  postMessage(message: ToWorker): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<FromWorker>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

export const createOverlapWorker = (): OverlapWorker =>
  new Worker(new URL('../../workers/semanticOverlap.worker.ts', import.meta.url), { type: 'module' }) as unknown as OverlapWorker;

export interface WorkerRunOptions {
  worker: OverlapWorker;
  runId: string;
  approach: ApproachId;
  input: OverlapInput;
  assetBase?: string;
  timeoutMs: number;
}

export interface WorkerRunHandlers {
  onProgress?: (progress: Progress) => void;
  onDone: (result: OverlapResult) => void;
  /** Worker error message, or the timeout message when `timedOut`. */
  onError: (message: string, timedOut: boolean) => void;
}

/**
 * Starts one analysis on `worker` and reports synchronously through `handlers`; exactly one of
 * `onDone`/`onError` is called. Messages of other runs are ignored. The returned function detaches
 * the handlers and the timer without terminating the worker — the caller owns the worker.
 */
export function startInWorker(options: WorkerRunOptions, handlers: WorkerRunHandlers): () => void {
  const { worker, runId, approach, input, assetBase, timeoutMs } = options;
  let settled = false;
  const detach = () => {
    settled = true;
    clearTimeout(timer);
    worker.onmessage = null;
    worker.onerror = null;
  };
  const timer = setTimeout(() => {
    if (settled) return;
    detach();
    handlers.onError(TIMEOUT_MESSAGE, true);
  }, timeoutMs);

  worker.onmessage = ({ data }) => {
    if (settled || data.runId !== runId) return;
    if (data.type === 'progress') handlers.onProgress?.({ phase: data.phase, fraction: data.fraction });
    if (data.type === 'done') {
      detach();
      handlers.onDone(data.result);
    }
    if (data.type === 'error') {
      detach();
      handlers.onError(data.message, false);
    }
    // 'warning' messages are also part of the result's warnings.
  };
  worker.onerror = event => {
    if (settled) return;
    detach();
    handlers.onError(event.message || WORKER_FAILED_MESSAGE, false);
  };
  worker.postMessage({ type: 'start', runId, approach, input, assetBase });
  return detach;
}

export class RunCancelledError extends Error {
  constructor() {
    super('The analysis was cancelled.');
    this.name = 'RunCancelledError';
  }
}

export class RunTimeoutError extends Error {
  constructor() {
    super(TIMEOUT_MESSAGE);
    this.name = 'RunTimeoutError';
  }
}

export interface RunInWorkerOptions extends WorkerRunOptions {
  onProgress?: (progress: Progress) => void;
  /** Aborting rejects with `RunCancelledError`; the worker is not terminated. */
  signal?: AbortSignal;
}

/** Promise form of {@link startInWorker}. */
export function runInWorker(options: RunInWorkerOptions): Promise<OverlapResult> {
  const { onProgress, signal, ...run } = options;
  return new Promise<OverlapResult>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new RunCancelledError());
      return;
    }
    const onAbort = () => {
      detach();
      reject(new RunCancelledError());
    };
    const detach = startInWorker(run, {
      onProgress,
      onDone: result => {
        signal?.removeEventListener('abort', onAbort);
        resolve(result);
      },
      onError: (message, timedOut) => {
        signal?.removeEventListener('abort', onAbort);
        reject(timedOut ? new RunTimeoutError() : new Error(message));
      },
    });
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
