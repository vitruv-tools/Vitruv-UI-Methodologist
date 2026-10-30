import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Tokenizer } from '@huggingface/tokenizers';
import { loadEmbeddingSourceFromDisk } from '../../../../../utils/semanticOverlap/improved/embeddings/embeddingSourceNode';
import { MODEL_MANIFESTS, modelBasePath } from '../../../../../utils/semanticOverlap/improved/embeddings/modelManifest';

/**
 * Contract of the real MiniLM model (tokenizer, pooling, normalisation, determinism) against a
 * fixture recorded once with it. Skips when the model is not fetched (as in CI). Record:
 * UPDATE_EMBEDDING_CONTRACT=1 npx vitest run <this file>
 */
const ROOT = path.resolve(__dirname, '../../../../../../public');
const MODEL_DIR = path.join(ROOT, modelBasePath('minilm'));
const FIXTURE = path.resolve(__dirname, '../../../../fixtures/semanticOverlap/embeddings/minilm-contract.json');
const TEXTS = [
  'class brake disk. concrete. kind of brake component. attributes: diameter in mm (integer).',
  'attribute bornIn of prof, integer',
  'path incoming source of node, edge then node',
];
const round = (value: number) => Math.round(value * 1e4) / 1e4;

describe.skipIf(!existsSync(path.join(MODEL_DIR, 'manifest.json')))('MiniLM model contract (local model)', () => {
  it('tokenises, pools and normalises as recorded, and is deterministic', async () => {
    const source = (await loadEmbeddingSourceFromDisk('minilm', ROOT))!;
    expect(source.model).toEqual({ id: 'minilm', revision: MODEL_MANIFESTS.minilm.revision, sha256: MODEL_MANIFESTS.minilm.sha256 });
    const tokenizer = new Tokenizer(JSON.parse(readFileSync(path.join(MODEL_DIR, 'tokenizer.json'), 'utf8')),
      JSON.parse(readFileSync(path.join(MODEL_DIR, 'tokenizer_config.json'), 'utf8')));
    const actual: { text: string; tokenIds: number[]; head: number[] }[] = [];
    for (const text of TEXTS) {
      const vector = await source.embed(text);
      expect(Math.hypot(...vector)).toBeCloseTo(1, 5);
      expect(await source.embed(text)).toEqual(vector);
      actual.push({ text, tokenIds: tokenizer.encode(text).ids, head: Array.from(vector.slice(0, 8), round) });
    }
    if (process.env.UPDATE_EMBEDDING_CONTRACT === '1') writeFileSync(FIXTURE, `${JSON.stringify(actual, null, 2)}\n`);
    const expected = JSON.parse(readFileSync(FIXTURE, 'utf8')) as typeof actual;
    expected.forEach((entry, k) => {
      expect(actual[k].tokenIds).toEqual(entry.tokenIds);
      actual[k].head.forEach((value, d) => expect(Math.abs(value - entry.head[d])).toBeLessThanOrEqual(1e-4));
    });
  }, 60_000);

  it('returns null when the files are missing', async () => {
    expect(await loadEmbeddingSourceFromDisk('minilm', path.join(ROOT, 'does-not-exist'))).toBeNull();
  });
});
