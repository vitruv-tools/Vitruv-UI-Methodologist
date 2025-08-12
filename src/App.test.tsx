import { render, screen } from '@testing-library/react';
import { Header } from './components/layout/Header';

test('renders Vitruvius Modeler title', () => {
  render(<Header title="Vitruvius Modeler" />);
  const titleElement = screen.getByText(/Vitruvius Modeler/i);
  expect(titleElement).toBeInTheDocument();
});

// test('renders Button components when handlers are provided', () => {
//   const mockHandlers = {
//     onNew: jest.fn(),
//     onLoad: jest.fn(),
//     onSave: jest.fn(),
//   };
  
//   render(<Header {...mockHandlers} title="Test Title" />);
  
//   expect(screen.getByText('New')).toBeInTheDocument();
//   expect(screen.getByText('Load')).toBeInTheDocument();
//   expect(screen.getByText('Save')).toBeInTheDocument();
// });