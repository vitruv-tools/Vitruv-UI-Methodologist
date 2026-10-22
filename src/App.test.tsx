import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { MODEL_LIBRARY_PATH } from './constants/routes';

vi.mock('./components/ui/ModelLibraryTable', () => ({
  ModelLibraryTable: () => <div data-testid="model-library-table" />,
}));

vi.mock('./components/ui/ProjectsView', () => ({
  ProjectsView: () => <div data-testid="projects-view" />,
}));

beforeEach(() => {
  // Seed auth so ProtectedRoute allows access to main app
  localStorage.setItem('auth.access_token', 'test-token');
  localStorage.setItem('auth.access_expires_at', (Date.now() + 60 * 60 * 1000).toString());
  localStorage.setItem('auth.user', JSON.stringify({ id: '1', username: 'test', name: 'Test User', emailVerified: true }));
});

afterEach(() => {
  localStorage.clear();
  globalThis.history.pushState({}, '', '/');
});

test('renders Vitruvius Modeler title', () => {
  render(<App />);
  const logoImages = screen.getAllByAltText(/Vitruvius/i);
  expect(logoImages.length).toBeGreaterThan(0);
});

test('opens the model library from its own URL', () => {
  globalThis.history.pushState({}, '', MODEL_LIBRARY_PATH);
  render(<App />);
  expect(screen.getByTestId('model-library-table')).toBeInTheDocument();
});

test('shows the selected view after leaving the model library URL', () => {
  globalThis.history.pushState({}, '', MODEL_LIBRARY_PATH);
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /^Projects/ }));
  expect(globalThis.location.pathname).toBe('/');
  expect(screen.getByTestId('projects-view')).toBeInTheDocument();
});
