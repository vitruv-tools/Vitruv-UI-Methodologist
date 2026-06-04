import React from 'react';
import { render, screen } from '@testing-library/react';
import { HomePage } from '../../pages/HomePage';

// ── mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../components/layout/AppSidebar', () => ({
  AppSidebar: ({ userName }: { userName: string }) => (
    <nav data-testid="app-sidebar">Sidebar for {userName}</nav>
  ),
}));

jest.mock('../../components/ui/LandingView', () => ({
  LandingView: ({ userName }: { userName?: string }) => (
    <div data-testid="landing-view">Landing for {userName}</div>
  ),
}));

jest.mock('../../components/ui/ModelLibraryTable', () => ({
  ModelLibraryTable: () => <div data-testid="model-library-table">Model Library</div>,
}));

jest.mock('../../components/ui/ProjectsView', () => ({
  ProjectsView: () => <div data-testid="projects-view">Projects</div>,
}));

jest.mock('../../components/ui/ProfileView', () => ({
  ProfileView: () => <div data-testid="profile-view">Profile</div>,
}));

jest.mock('../../services/auth', () => ({
  AuthService: {
    signOut: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockRefreshCurrentUser = jest.fn().mockResolvedValue(null);

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', username: 'maxoesterle', givenName: 'Max', familyName: 'Oesterle', email: 'max@kit.edu', emailVerified: true },
    refreshCurrentUser: mockRefreshCurrentUser,
  }),
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe('HomePage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the sidebar', () => {
    render(<HomePage />);
    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
  });

  it('renders the landing view by default (not model library)', () => {
    render(<HomePage />);
    expect(screen.getByTestId('landing-view')).toBeInTheDocument();
    expect(screen.queryByTestId('model-library-table')).not.toBeInTheDocument();
  });

  it('does not render projects view by default', () => {
    render(<HomePage />);
    expect(screen.queryByTestId('projects-view')).not.toBeInTheDocument();
  });

  it('does not render profile view by default', () => {
    render(<HomePage />);
    expect(screen.queryByTestId('profile-view')).not.toBeInTheDocument();
  });

  it('passes the user display name to sidebar', () => {
    render(<HomePage />);
    expect(screen.getByText(/Sidebar for Max Oesterle/i)).toBeInTheDocument();
  });

  it('calls refreshCurrentUser on mount', () => {
    render(<HomePage />);
    expect(mockRefreshCurrentUser).toHaveBeenCalledTimes(1);
  });
});
