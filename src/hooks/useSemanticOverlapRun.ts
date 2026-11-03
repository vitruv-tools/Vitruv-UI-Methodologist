import { useCallback, useEffect, useRef } from 'react';
import { config } from '../config/environment';
import { apiService } from '../services/api';
import { useSemanticOverlapStore } from '../store/SemanticOverlap';
import { approachOf } from '../utils/semanticOverlap/approaches/registry';
import { EcoreReadError, readMetamodelGraph } from '../utils/semanticOverlap/ecore/readMetamodelGraph';
import {
  ANALYSIS_TIMEOUT_MS,
  createOverlapWorker,
  startInWorker,
  type OverlapWorker,
} from '../utils/semanticOverlap/runInWorker';
import { sha256Hex } from '../utils/semanticOverlap/sha256';
import type { MetamodelRef } from '../utils/semanticOverlap/types';
import type { LibraryMetaModel } from '../utils/metaModelList';

export {
  ANALYSIS_TIMEOUT_MS,
  TIMEOUT_MESSAGE,
  createOverlapWorker,
  type OverlapWorker,
} from '../utils/semanticOverlap/runInWorker';

export interface SemanticOverlapRunDeps {
  createWorker?: () => OverlapWorker;
  getFile?: (id: number) => Promise<string>;
  createRunId?: () => string;
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
  const detachRef = useRef<(() => void) | null>(null);

  const stopWorker = useCallback(() => {
    detachRef.current?.();
    detachRef.current = null;
    workerRef.current?.terminate();
    workerRef.current = null;
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
      useSemanticOverlapStore.getState().beginRunning(runId);
      detachRef.current = startInWorker(
        { worker, runId, approach, input, assetBase: config.assetBaseUrl, timeoutMs: ANALYSIS_TIMEOUT_MS },
        {
          onProgress: progress => useSemanticOverlapStore.getState().updateProgress(runId, progress),
          onDone: result => {
            stopWorker();
            useSemanticOverlapStore.getState().finishRun(runId, result);
          },
          onError: message => {
            stopWorker();
            useSemanticOverlapStore.getState().failRun(runId, message);
          },
        },
      );
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
