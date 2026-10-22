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

// jsdom's Blob lacks the promise-based readers that browsers provide.
function readBlob<T>(blob: Blob, read: (reader: FileReader) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as T);
    reader.onerror = () => reject(reader.error);
    read(reader);
  });
}
Blob.prototype.text ??= function (this: Blob) {
  return readBlob<string>(this, (reader) => reader.readAsText(this));
};
Blob.prototype.arrayBuffer ??= function (this: Blob) {
  return readBlob<ArrayBuffer>(this, (reader) => reader.readAsArrayBuffer(this));
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