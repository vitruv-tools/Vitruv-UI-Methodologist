// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { act } from '@testing-library/react';
import './__mocks__/resizeObserverMock';
import { deserialize, serialize } from 'node:v8';
import { resetThemeStore } from './theme/theme';

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