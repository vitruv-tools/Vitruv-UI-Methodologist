// jest-dom adds custom matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/vitest';
import { act } from '@testing-library/react';
import './__mocks__/resizeObserverMock';
import { deserialize, serialize } from 'node:v8';
import { resetThemeStore } from './theme/theme';

// Jest (CRA) applied the node-module manual mocks in src/__mocks__ automatically; Vitest needs them registered.
vi.mock('reactflow', () => import('./__mocks__/reactflow'));

// Testing Library's waitFor only advances fake timers when it finds a global `jest`.
(globalThis as any).jest = { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) };

// jsdom's Blob has no text() or arrayBuffer(). readAsBinaryString is the reader it still provides.
function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const binary = typeof reader.result === 'string' ? reader.result : '';
      resolve(Uint8Array.from(binary, char => char.charCodeAt(0)));
    };
    reader.onerror = () => {
      reject(new Error(reader.error?.message || 'Failed to read blob'));
    };
    reader.readAsBinaryString(blob);
  });
}
Blob.prototype.arrayBuffer ??= async function (this: Blob) {
  const bytes = await readBlobBytes(this);
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
};
Blob.prototype.text ??= async function (this: Blob) {
  const bytes = await readBlobBytes(this);
  return new TextDecoder().decode(bytes);
};

// Set up environment variables for tests
process.env.REACT_APP_API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:9811';
process.env.REACT_APP_ENV = process.env.REACT_APP_ENV || 'local';
const nativeStructuredClone = globalThis.structuredClone;
globalThis.structuredClone = (val: any) => {
  if (typeof nativeStructuredClone === 'function') {
    return nativeStructuredClone(val);
  }
  return deserialize(serialize(val));
};

afterEach(() => {
  act(() => {
    resetThemeStore();
  });
});