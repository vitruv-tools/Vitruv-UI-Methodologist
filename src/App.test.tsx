import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Vitruvius Modeler title', () => {
  render(<App />);
  const titleElement = screen.getByText(/Vitruvius Modeler/i);
  expect(titleElement).toBeInTheDocument();
});
