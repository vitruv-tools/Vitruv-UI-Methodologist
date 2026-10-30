#!/usr/bin/env node
/**
 * Provides the sentence-embedding model of the improved semantic overlap approach. The model is
 * served by the application itself (no third-party request at runtime) but is not committed.
 *
 * Downloads the pinned ONNX model and its tokenizer files from Hugging Face into
 * `<root>/models/<id>/<revision>/`, checks the model's SHA-256 against
 * `src/utils/semanticOverlap/improved/embeddings/models.json` and writes a `manifest.json`.
 * When the pinned checksum is still empty, the computed one is printed so it can be pinned.
 *
 * Usage: node scripts/fetch-embedding-model.mjs [--model minilm|bge-small] [--root public]
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const MODELS_JSON = 'src/utils/semanticOverlap/improved/embeddings/models.json';
const TOKENIZER_FILES = ['tokenizer.json', 'tokenizer_config.json'];

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value) throw new Error(`${name} needs a value`);
  return value;
};

const models = JSON.parse(readFileSync(MODELS_JSON, 'utf8'));
const modelId = option('--model', 'minilm');
const root = option('--root', 'public');
const manifest = models[modelId];
if (!manifest) throw new Error(`Unknown model "${modelId}" (known: ${Object.keys(models).join(', ')})`);

const targetDir = path.join(root, 'models', manifest.id, manifest.revision);
mkdirSync(targetDir, { recursive: true });
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function download(file) {
  const url = `https://huggingface.co/${manifest.hfRepo}/resolve/${manifest.revision}/${file}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

const modelPath = path.join(targetDir, 'model.onnx');
const model = existsSync(modelPath) && sha256(readFileSync(modelPath)) === manifest.sha256
  ? readFileSync(modelPath)
  : await download(manifest.file);
const actual = sha256(model);
if (manifest.sha256 === '') {
  console.log(`${manifest.id}: no pinned checksum yet; pin "sha256": "${actual}" in ${MODELS_JSON}`);
} else if (actual !== manifest.sha256) {
  throw new Error(`${manifest.id}: checksum mismatch (expected ${manifest.sha256}, got ${actual})`);
}
writeFileSync(modelPath, model);
console.log(`model.onnx (${model.length} bytes)`);

for (const file of TOKENIZER_FILES) {
  const bytes = await download(file);
  writeFileSync(path.join(targetDir, file), bytes);
  console.log(`${file} (${bytes.length} bytes)`);
}

const written = {
  id: manifest.id,
  revision: manifest.revision,
  sha256: actual,
  pooling: manifest.pooling,
  licence: manifest.licence,
  sizeBytes: model.length,
};
writeFileSync(path.join(targetDir, 'manifest.json'), `${JSON.stringify(written, null, 2)}\n`);
console.log(`manifest.json -> ${targetDir}`);
