import { cacheKey, indexedDbEmbeddingCache, memoryEmbeddingCache } from '../../../../../utils/semanticOverlap/improved/embeddings/embeddingCache';
import { buildEmbeddingTable, createEmbeddingSource } from '../../../../../utils/semanticOverlap/improved/embeddings/embeddingSource';
import { FAKE_MODEL, fakeEmbeddingSource, hashVector } from './fakeEmbeddingSource';

describe('buildEmbeddingTable', () => {
  it('embeds each distinct text once, one at a time, in order', async () => {
    const source = fakeEmbeddingSource();
    const table = await buildEmbeddingTable(source, ['b', 'a', 'b', 'c']);
    expect(source.calls).toEqual(['b', 'a', 'c']);
    expect([...table.vectors.keys()]).toEqual(['b', 'a', 'c']);
    expect(table.vectors.get('a')).toEqual(hashVector('a'));
    expect(table.model).toEqual(FAKE_MODEL);
  });

  it('reports monotonic progress from 0 to 1', async () => {
    const fractions: number[] = [];
    await buildEmbeddingTable(fakeEmbeddingSource(), ['a', 'b', 'c', 'd'], { onProgress: f => fractions.push(f) });
    expect(fractions).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it('stops when aborted', async () => {
    const controller = new AbortController();
    const source = fakeEmbeddingSource();
    const run = buildEmbeddingTable(source, ['a', 'b', 'c'], { signal: controller.signal, onProgress: () => controller.abort() });
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    expect(source.calls).toEqual(['a']);
  });

  it('reads the cache first and writes misses after embedding them', async () => {
    const cache = memoryEmbeddingCache();
    await cache.set(cacheKey(FAKE_MODEL.sha256, 'a'), hashVector('a'));
    const source = fakeEmbeddingSource();
    const table = await buildEmbeddingTable(source, ['a', 'b'], { cache });
    expect(source.calls).toEqual(['b']);
    expect(await cache.get(cacheKey(FAKE_MODEL.sha256, 'b'))).toEqual(hashVector('b'));
    expect(table).toEqual(await buildEmbeddingTable(fakeEmbeddingSource(), ['a', 'b']));
  });

  it('loads a lazy source only when a text is missing from the cache', async () => {
    const cache = memoryEmbeddingCache();
    const source = fakeEmbeddingSource();
    const load = vi.fn(() => Promise.resolve(source));
    await buildEmbeddingTable({ model: FAKE_MODEL, load }, ['a', 'b'], { cache });
    expect(load).toHaveBeenCalledTimes(1);
    load.mockClear();
    await buildEmbeddingTable({ model: FAKE_MODEL, load }, ['b', 'a'], { cache });
    expect(load).not.toHaveBeenCalled();
    await buildEmbeddingTable({ model: FAKE_MODEL, load }, ['a', 'c'], { cache });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('works without IndexedDB (no-op cache)', async () => {
    const cache = indexedDbEmbeddingCache(undefined);
    await cache.set('k', hashVector('a'));
    expect(await cache.get('k')).toBeUndefined();
  });
});

describe('createEmbeddingSource', () => {
  const tokenizer = { encode: (text: string) => ({ ids: [101, text.length, 102], attention_mask: [1, 1, 0] }) };
  // Hidden states of 3 tokens × 2 dimensions.
  const hidden = Float32Array.from([3, 0, 1, 2, 9, 9]);
  const session = (inputNames: string[]) => ({
    inputNames, outputNames: ['last_hidden_state'],
    run: vi.fn((_feeds: Record<string, unknown>) => Promise.resolve({ last_hidden_state: { data: hidden, dims: [1, 3, 2] } })),
  });
  const tensor = (values: BigInt64Array) => Array.from(values, Number);

  it('mean-pools the attended tokens and normalises', async () => {
    const run = session(['input_ids', 'attention_mask', 'token_type_ids']);
    const source = createEmbeddingSource(run, tensor, tokenizer, { ...FAKE_MODEL, pooling: 'mean' });
    const vector = await source.embed('abc');
    expect(Array.from(vector)).toEqual([expect.closeTo(0.8944, 4), expect.closeTo(0.4472, 4)]);
    expect(run.run.mock.calls[0][0]).toEqual({ input_ids: [101, 3, 102], attention_mask: [1, 1, 0], token_type_ids: [0, 0, 0] });
  });

  it('takes the CLS token for CLS pooling and omits token types the model does not expect', async () => {
    const run = session(['input_ids', 'attention_mask']);
    const vector = await createEmbeddingSource(run, tensor, tokenizer, { ...FAKE_MODEL, pooling: 'cls' }).embed('x');
    expect(Array.from(vector)).toEqual([1, 0]);
    expect(Object.keys(run.run.mock.calls[0][0])).toEqual(['input_ids', 'attention_mask']);
  });
});
