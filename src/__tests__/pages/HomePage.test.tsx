import React from 'react';
import { render, screen } from '@testing-library/react';
import { HomePage } from '../../pages/HomePage';

jest.mock('../../components/layout/AppSidebar', () => ({
  AppSidebar: ({ userName }: { userName: string }) => (
    <nav data-testid="app-sidebar">Sidebar for {userName}</nav>
  ),
}));

jest.mock('../../components/ui/ModelLibraryTable', () => ({
  ModelLibraryTable: () => <div data-testid="model-library-table">Model Library</div>,
}));

jest.mock('../../components/ui/ProjectsView', () => ({
  ProjectsView: () => <div data-testid="projects-view">Projects</div>,
}));

jest.mock('../../services/auth', () => ({
  AuthService: {
    getCurrentUser: () => ({ username: 'testuser', givenName: 'Test', familyName: 'User', email: 'test@example.com' }),
    signOut: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('HomePage', () => {
  it('renders the sidebar', () => {
    render(<HomePage />);
    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
  });

  it('renders the model library table by default', () => {
    render(<HomePage />);
    expect(screen.getByTestId('model-library-table')).toBeInTheDocument();
  });

  it('does not render projects view by default', () => {
    render(<HomePage />);
    expect(screen.queryByTestId('projects-view')).not.toBeInTheDocument();
  });
});
