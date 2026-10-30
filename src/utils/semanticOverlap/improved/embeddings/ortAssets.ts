import wasm from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import mjs from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';

/** Same-origin URLs of the WASM runtime, emitted by Vite (no CDN). Imported only when the model loads. */
export const ORT_WASM_PATHS = { wasm, mjs };
