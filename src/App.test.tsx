import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  // Seed auth so ProtectedRoute allows access to main app
  localStorage.setItem('auth.access_token', 'test-token');
  localStorage.setItem('auth.access_expires_at', (Date.now() + 60 * 60 * 1000).toString());
  localStorage.setItem('auth.user', JSON.stringify({ id: '1', username: 'test', name: 'Test User' }));
});

afterEach(() => {
  localStorage.clear();
});

test('renders Vitruvius Modeler title', () => {
  render(<App />);
  const titleElement = screen.getByText(/vitruvius modeler/i);
  expect(titleElement).toBeInTheDocument();
});