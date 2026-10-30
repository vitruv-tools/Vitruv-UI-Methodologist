import { handleWorkerMessage, type FromWorker } from '../../workers/semanticOverlap.worker';
import { createWordNetSource } from '../../utils/semanticOverlap/lexical/wordNetSource';
import { resolveSettings } from '../../utils/semanticOverlap/settings';
import { improvementsOf, resolveImprovedSettings } from '../../utils/semanticOverlap/improved/settings';
import table from '../../assets/wordnet/oewn-2025-synonyms.json';
import { memoryEmbeddingCache } from '../../utils/semanticOverlap/improved/embeddings/embeddingCache';
import { loadEmbeddingSource } from '../../utils/semanticOverlap/improved/embeddings/embeddingSource';
import { MODEL_MANIFESTS } from '../../utils/semanticOverlap/improved/embeddings/modelManifest';
import { fakeEmbeddingSource } from '../utils/semanticOverlap/improved/embeddings/fakeEmbeddingSource';
import { ecoreExcerpt, umlExcerpt } from '../utils/semanticOverlap/fixtures';

const input = { source: ecoreExcerpt(), target: umlExcerpt(), settings: resolveSettings({ seed: 1 }, 'fast') };

describe('semantic overlap worker', () => {
  it('posts throttled, monotonic progress and exactly one done message', async () => {
    const messages: FromWorker[] = [];
    let time = 0;
    await handleWorkerMessage({ type: 'start', runId: 'run-1', input }, m => messages.push(m), {
      loadLexicalSource: async () => createWordNetSource(table),
      now: () => (time += 30),
    });
    const progress = messages.filter(m => m.type === 'progress');
    expect(progress[0]).toMatchObject({ phase: 'lexicon', fraction: 0 });
    progress.slice(1).forEach((m, k) => expect((m as { fraction: number }).fraction).toBeGreaterThanOrEqual((progress[k] as { fraction: number }).fraction));
    expect(messages.filter(m => m.type === 'done')).toHaveLength(1);
    expect(messages.every(m => m.runId === 'run-1')).toBe(true);
    expect(messages[messages.length - 1].type).toBe('done');
  });

  it('falls back to no synonyms with a warning when WordNet fails to load', async () => {
    const messages: FromWorker[] = [];
    await handleWorkerMessage({ type: 'start', runId: 'r', input }, m => messages.push(m), {
      loadLexicalSource: () => Promise.reject(new Error('chunk failed')),
      now: () => 0,
    });
    expect(messages.some(m => m.type === 'warning')).toBe(true);
    const done = messages.find(m => m.type === 'done');
    expect(done && done.type === 'done' && done.result.engine.lexicalSource).toBeNull();
  });

  it('posts an error for invalid input', async () => {
    const messages: FromWorker[] = [];
    await handleWorkerMessage({ type: 'start', runId: 'r', input: { ...input, settings: { ...input.settings, seed: -1 } } },
      m => messages.push(m), { loadLexicalSource: async () => createWordNetSource(table), now: () => 0 });
    expect(messages.filter(m => m.type === 'error')).toHaveLength(1);
    expect(messages.some(m => m.type === 'done')).toBe(false);
  });

  const lexicalDeps = { loadLexicalSource: async () => createWordNetSource(table), now: () => 0 };
  const doneResult = (messages: FromWorker[]) => {
    const done = messages.find(m => m.type === 'done');
    return done && done.type === 'done' ? done.result : undefined;
  };

  it('runs the paper approach when no approach is given', async () => {
    const messages: FromWorker[] = [];
    await handleWorkerMessage({ type: 'start', runId: 'r', input }, m => messages.push(m), lexicalDeps);
    expect(doneResult(messages)?.approach?.id).toBe('paper');
  });

  it('runs the improved approach when asked to', async () => {
    const messages: FromWorker[] = [];
    const improvedInput = { ...input, settings: resolveImprovedSettings({ seed: 1 }, 'fast') };
    await handleWorkerMessage({ type: 'start', runId: 'r', approach: 'improved', input: improvedInput }, m => messages.push(m), lexicalDeps);
    expect(doneResult(messages)?.approach?.id).toBe('improved');
  });

  it('warns once and still finishes when the hypernyms fail to load', async () => {
    const messages: FromWorker[] = [];
    const improvedInput = { ...input, settings: resolveImprovedSettings({ seed: 1, improvements: improvementsOf(['hypernyms']) }, 'fast') };
    await handleWorkerMessage({ type: 'start', runId: 'r', approach: 'improved', input: improvedInput }, m => messages.push(m), {
      ...lexicalDeps,
      loadHypernymSource: () => Promise.reject(new Error('asset missing')),
    });
    expect(messages.filter(m => m.type === 'warning')).toHaveLength(1);
    expect(doneResult(messages)).toBeDefined();
  });

  describe('sentence embeddings', () => {
    const embeddingInput = (params = {}) => ({
      ...input,
      settings: resolveImprovedSettings({ seed: 1, improvements: improvementsOf(['embeddings']), params: params as never }, 'fast'),
    });
    const start = (params = {}) => ({ type: 'start' as const, runId: 'r', approach: 'improved' as const, input: embeddingInput(params), assetBase: '/app/' });

    it('embeds between lexicon and profiling and passes the table to the run', async () => {
      const messages: FromWorker[] = [];
      const source = fakeEmbeddingSource();
      const loader = vi.fn(() => Promise.resolve(source));
      let time = 0;
      await handleWorkerMessage(start(), m => messages.push(m),
        { ...lexicalDeps, now: () => (time += 200), loadEmbeddingSource: loader, embeddingCache: memoryEmbeddingCache });
      const phases = [...new Set(messages.flatMap(m => (m.type === 'progress' ? [m.phase] : [])))];
      expect(phases.slice(0, 3)).toEqual(['lexicon', 'embeddings', 'profiling']);
      expect(loader).toHaveBeenCalledWith('minilm', '/app/');
      expect(source.calls.length).toBeGreaterThan(0);
      const { id, revision, sha256 } = MODEL_MANIFESTS.minilm;
      expect(doneResult(messages)?.embeddingModel).toEqual({ id, revision, sha256 });
      expect(doneResult(messages)?.correspondences[0].scores.embedding).toBeDefined();
    });

    it('warns once and still finishes when the model cannot be loaded', async () => {
      const messages: FromWorker[] = [];
      await handleWorkerMessage(start(), m => messages.push(m), {
        ...lexicalDeps, loadEmbeddingSource: () => Promise.reject(new Error('not in this build')), embeddingCache: memoryEmbeddingCache,
      });
      expect(messages.filter(m => m.type === 'warning')).toEqual([expect.objectContaining({ message: 'Sentence-embedding measure skipped: not in this build' })]);
      const result = doneResult(messages)!;
      expect(result.embeddingModel).toBeUndefined();
      expect(result.warnings).toContain('Sentence-embedding measure skipped: not in this build');
    });

    it('never loads the model when every description is cached', async () => {
      const cache = memoryEmbeddingCache();
      const loader = vi.fn(() => Promise.resolve(fakeEmbeddingSource()));
      const deps = { ...lexicalDeps, loadEmbeddingSource: loader, embeddingCache: () => cache };
      await handleWorkerMessage(start(), () => undefined, deps);
      expect(loader).toHaveBeenCalledTimes(1);
      const messages: FromWorker[] = [];
      await handleWorkerMessage(start(), m => messages.push(m), deps);
      expect(loader).toHaveBeenCalledTimes(1);
      expect(doneResult(messages)?.embeddingModel).toBeDefined();
    });

    it('skips the measure without loading the model above the description limit', async () => {
      const messages: FromWorker[] = [];
      const loader = vi.fn(() => Promise.resolve(fakeEmbeddingSource()));
      await handleWorkerMessage(start({ embeddingMaxTexts: 100 }), () => undefined, { ...lexicalDeps, loadEmbeddingSource: loader });
      expect(loader).toHaveBeenCalledTimes(1);
      const many = { ...embeddingInput({ embeddingMaxTexts: 100 }) };
      const wide = { ...many.source, classes: Array.from({ length: 120 }, (_, k) => ({ ...many.source.classes[0], name: `C${k}`, qualifiedName: `ecore.C${k}` })) };
      loader.mockClear();
      await handleWorkerMessage({ ...start({ embeddingMaxTexts: 100 }), input: { ...many, source: wide } }, m => messages.push(m),
        { ...lexicalDeps, loadEmbeddingSource: loader });
      expect(loader).not.toHaveBeenCalled();
      expect(messages.filter(m => m.type === 'warning').map(m => (m as { message: string }).message))
        .toEqual([expect.stringMatching(/^Sentence-embedding measure skipped: \d+ element descriptions exceed the limit of 100\.$/)]);
      expect(doneResult(messages)).toBeDefined();
    });

    it('never loads embeddings for the paper approach', async () => {
      const loader = vi.fn(() => Promise.resolve(fakeEmbeddingSource()));
      const messages: FromWorker[] = [];
      await handleWorkerMessage({ type: 'start', runId: 'r', input }, m => messages.push(m), { ...lexicalDeps, loadEmbeddingSource: loader });
      expect(loader).not.toHaveBeenCalled();
      expect(messages.some(m => m.type === 'progress' && m.phase === 'embeddings')).toBe(false);
    });

    it('requests only same-origin model files under the asset base, carrying no metamodel content', async () => {
      const requests: { url: string; init?: RequestInit }[] = [];
      const fetchFile = (url: string, init?: RequestInit) => {
        requests.push({ url, init });
        return Promise.resolve(new Response(null, { status: 404 }));
      };
      await expect(loadEmbeddingSource('minilm', '/app/', fetchFile)).rejects.toThrow('not in this build');
      expect(requests.map(r => r.url)).toEqual(['/app/models/minilm/751bff37182d3f1213fa05d7196b954e230abad9/manifest.json']);
      expect(requests.every(r => r.init?.body === undefined)).toBe(true);
      // The WASM runtime is a same-origin asset emitted by the build, not a CDN URL.
      const { ORT_WASM_PATHS } = await import('../../utils/semanticOverlap/improved/embeddings/ortAssets');
      Object.values(ORT_WASM_PATHS).forEach(url => expect(url).not.toMatch(/^https?:/));
    });
  });
});
