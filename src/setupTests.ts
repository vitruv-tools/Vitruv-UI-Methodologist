// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import './__mocks__/resizeObserverMock';

// Set up environment variables for tests
process.env.REACT_APP_API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:9811';
process.env.REACT_APP_ENV = process.env.REACT_APP_ENV || 'local';
global.structuredClone = (val: any) => JSON.parse(JSON.stringify(val));