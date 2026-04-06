import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./utils/UMLFromEcoreTS', () => ({
  __esModule: true,
  getNodeNameFromEcoreIdentifier: jest.fn((value: string) => value),
  findClassNameFromEcoreIdentifier: jest.fn((value: string) => value),
  findPackageNameFromEcoreIdentifier: jest.fn((value: string) => value),
  getHandleIdForEcoreElement: jest.fn((_: string, direction: string, type: string) => `${direction}-${type}`),
  buildAttributeSignature: jest.fn(() => '+ attr: EString'),
  buildMethodSignature: jest.fn(() => '+ op(): void'),
}));

beforeEach(() => {
  // Seed auth so ProtectedRoute allows access to main app
  localStorage.setItem('auth.access_token', 'test-token');
  localStorage.setItem('auth.access_expires_at', (Date.now() + 60 * 60 * 1000).toString());
  localStorage.setItem('auth.user', JSON.stringify({ id: '1', username: 'test', name: 'Test User', emailVerified: true }));
});

afterEach(() => {
  localStorage.clear();
});

test('renders Vitruvius Modeler title', () => {
  render(<App />);
  const logoImage = screen.getByAltText(/Vitruvius/i);
  expect(logoImage).toBeInTheDocument();
});