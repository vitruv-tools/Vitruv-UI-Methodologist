import { handleWorkerMessage, type FromWorker } from '../../workers/semanticOverlap.worker';
import { createWordNetSource } from '../../utils/semanticOverlap/lexical/wordNetSource';
import { resolveSettings } from '../../utils/semanticOverlap/settings';
import { improvementsOf, resolveImprovedSettings } from '../../utils/semanticOverlap/improved/settings';
import table from '../../assets/wordnet/oewn-2025-synonyms.json';
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
});
