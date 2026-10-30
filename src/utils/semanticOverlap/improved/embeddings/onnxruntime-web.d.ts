// The project resolves modules the classic Node way, which ignores package `exports`; the WASM-only
// entry of onnxruntime-web shares the package's root types.
declare module 'onnxruntime-web/wasm' {
  export * from 'onnxruntime-web/types';
}
