import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LandingView } from '../../../components/ui/LandingView';

describe('LandingView', () => {
  it('renders the VITRUVIUS MODELER badge', () => {
    render(<LandingView onNavigate={jest.fn()} />);
    expect(screen.getByText(/VITRUVIUS MODELER/i)).toBeInTheDocument();
  });

  it('shows generic welcome when no userName provided', () => {
    render(<LandingView onNavigate={jest.fn()} />);
    expect(screen.getByText(/Welcome to Vitruvius/i)).toBeInTheDocument();
  });

  it('shows personalised greeting when userName is provided', () => {
    render(<LandingView userName="Max Oesterle" onNavigate={jest.fn()} />);
    expect(screen.getByText(/Welcome back, Max/i)).toBeInTheDocument();
  });

  it('renders Projects card', () => {
    render(<LandingView onNavigate={jest.fn()} />);
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  it('renders Model Library card', () => {
    render(<LandingView onNavigate={jest.fn()} />);
    expect(screen.getByText('Model Library')).toBeInTheDocument();
  });

  it('calls onNavigate with "projects" when Projects card is clicked', () => {
    const onNavigate = jest.fn();
    render(<LandingView onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText('Projects'));
    expect(onNavigate).toHaveBeenCalledWith('projects');
  });

  it('calls onNavigate with "library" when Model Library card is clicked', () => {
    const onNavigate = jest.fn();
    render(<LandingView onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText('Model Library'));
    expect(onNavigate).toHaveBeenCalledWith('library');
  });

  it('renders the About the Framework section', () => {
    render(<LandingView onNavigate={jest.fn()} />);
    expect(screen.getByText(/About the Framework/i)).toBeInTheDocument();
  });

  it('renders feature pills', () => {
    render(<LandingView onNavigate={jest.fn()} />);
    expect(screen.getByText(/Automatic model synchronisation/i)).toBeInTheDocument();
    expect(screen.getByText(/View-centric editing/i)).toBeInTheDocument();
  });

  it('does NOT render the removed "Live consistency validation" pill', () => {
    render(<LandingView onNavigate={jest.fn()} />);
    expect(screen.queryByText(/Live consistency validation/i)).not.toBeInTheDocument();
  });
});
