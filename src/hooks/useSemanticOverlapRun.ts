import { useCallback, useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import { useSemanticOverlapStore } from '../store/SemanticOverlap';
import { approachOf } from '../utils/semanticOverlap/approaches/registry';
import { EcoreReadError, readMetamodelGraph } from '../utils/semanticOverlap/ecore/readMetamodelGraph';
import type { MetamodelRef } from '../utils/semanticOverlap/types';
import type { LibraryMetaModel } from '../utils/metaModelList';
import type { FromWorker, ToWorker } from '../workers/semanticOverlap.worker';

/** Hard limit for one analysis (FR-031). */
export const ANALYSIS_TIMEOUT_MS = 5 * 60 * 1000;
export const TIMEOUT_MESSAGE = 'Analysis stopped after 5 minutes — try a lower effort setting.';

export interface OverlapWorker {
  postMessage(message: ToWorker): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<FromWorker>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

export const createOverlapWorker = (): OverlapWorker =>
  new Worker(new URL('../workers/semanticOverlap.worker.ts', import.meta.url), { type: 'module' }) as unknown as OverlapWorker;

export interface SemanticOverlapRunDeps {
  createWorker?: () => OverlapWorker;
  getFile?: (id: number) => Promise<string>;
  createRunId?: () => string;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

const toRef = (model: LibraryMetaModel, contentHash: string): MetamodelRef => ({
  libraryId: model.id,
  name: model.name,
  version: model.version,
  ecoreFileId: model.ecoreFileId ?? 0,
  contentHash,
});

/**
 * Runs the semantic overlap analysis: fetches and parses both ecore files on the main thread, then
 * runs the search in a Web Worker. Cancelling, unmounting, a new run and the timeout terminate it.
 */
export function useSemanticOverlapRun(deps: SemanticOverlapRunDeps = {}) {
  const {
    createWorker = createOverlapWorker,
    getFile = (id: number) => apiService.getFile(id),
    createRunId = () => globalThis.crypto.randomUUID(),
  } = deps;
  const workerRef = useRef<OverlapWorker | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    stopWorker();
    useSemanticOverlapStore.getState().cancelRun();
  }, [stopWorker]);

  const start = useCallback(async (source: LibraryMetaModel, target: LibraryMetaModel) => {
    stopWorker();
    const store = useSemanticOverlapStore.getState();
    const runId = createRunId();
    store.beginLoading(runId);
    const isCurrent = () => useSemanticOverlapStore.getState().runId === runId;

    const { approach, settings } = store;
    const problems = approachOf(approach).validate(settings);
    if (problems.length > 0) {
      store.failRun(runId, problems.join(' '));
      return;
    }

    try {
      for (const model of [source, target]) {
        if (!model.ecoreFileId) throw new EcoreReadError(model.name, 'the metamodel has no ecore file');
      }
      const texts = await Promise.all([getFile(source.ecoreFileId!), getFile(target.ecoreFileId!)]);
      if (!isCurrent()) return;
      const hashes = await Promise.all(texts.map(sha256Hex));
      if (!isCurrent()) return;
      const input = {
        source: readMetamodelGraph(texts[0], toRef(source, hashes[0])),
        target: readMetamodelGraph(texts[1], toRef(target, hashes[1])),
        settings,
      };

      const worker = createWorker();
      workerRef.current = worker;
      worker.onmessage = ({ data }) => {
        if (data.runId !== runId) return;
        const current = useSemanticOverlapStore.getState();
        if (data.type === 'progress') current.updateProgress(runId, { phase: data.phase, fraction: data.fraction });
        if (data.type === 'done') {
          stopWorker();
          current.finishRun(runId, data.result);
        }
        if (data.type === 'error') {
          stopWorker();
          current.failRun(runId, data.message);
        }
        // 'warning' messages are also part of the result's warnings.
      };
      worker.onerror = event => {
        stopWorker();
        useSemanticOverlapStore.getState().failRun(runId, event.message || 'The analysis failed.');
      };
      timeoutRef.current = setTimeout(() => {
        stopWorker();
        useSemanticOverlapStore.getState().failRun(runId, TIMEOUT_MESSAGE);
      }, ANALYSIS_TIMEOUT_MS);
      useSemanticOverlapStore.getState().beginRunning(runId);
      worker.postMessage({ type: 'start', runId, approach, input });
    } catch (error) {
      stopWorker();
      const message = error instanceof Error ? error.message : String(error);
      useSemanticOverlapStore.getState().failRun(runId,
        error instanceof EcoreReadError ? message : `Could not load the metamodels: ${message}`);
    }
  }, [createRunId, createWorker, getFile, stopWorker]);

  useEffect(() => () => {
    // Leaving the view cancels a running analysis (also while the files are still loading).
    const { status, cancelRun } = useSemanticOverlapStore.getState();
    if (workerRef.current || status === 'loading' || status === 'running') {
      stopWorker();
      cancelRun();
    }
  }, [stopWorker]);

  return { start, cancel };
}
