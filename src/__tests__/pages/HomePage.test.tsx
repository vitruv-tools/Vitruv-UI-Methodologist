import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { HomePage } from '../../pages/HomePage';
import { MODEL_LIBRARY_PATH, modelLibraryUmlPath } from '../../constants/routes';

// ── mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../components/layout/AppSidebar', () => ({
  AppSidebar: ({ userName, onViewChange }: { userName: string; onViewChange: (view: string) => void }) => (
    <nav data-testid="app-sidebar">
      Sidebar for {userName}
      <button type="button" onClick={() => onViewChange('projects')}>Projects</button>
      <button type="button" onClick={() => onViewChange('library')}>Model Library</button>
    </nav>
  ),
}));

jest.mock('../../components/ui/LandingView', () => ({
  LandingView: ({ userName }: { userName?: string }) => (
    <div data-testid="landing-view">Landing for {userName}</div>
  ),
}));

jest.mock('../../components/ui/ModelLibraryTable', () => ({
  ModelLibraryTable: ({ onHome }: { onHome?: () => void }) => (
    <div data-testid="model-library-table">
      Model Library
      <button type="button" onClick={onHome}>Vitruvius logo</button>
    </div>
  ),
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

// ── helpers ───────────────────────────────────────────────────────────────────

const CurrentPath = () => <div data-testid="current-path">{useLocation().pathname}</div>;

function renderHomePage(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <HomePage />
      <CurrentPath />
    </MemoryRouter>,
  );
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('HomePage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the sidebar', () => {
    renderHomePage();
    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
  });

  it('renders the landing view by default (not model library)', () => {
    renderHomePage();
    expect(screen.getByTestId('landing-view')).toBeInTheDocument();
    expect(screen.queryByTestId('model-library-table')).not.toBeInTheDocument();
  });

  it('does not render projects view by default', () => {
    renderHomePage();
    expect(screen.queryByTestId('projects-view')).not.toBeInTheDocument();
  });

  it('does not render profile view by default', () => {
    renderHomePage();
    expect(screen.queryByTestId('profile-view')).not.toBeInTheDocument();
  });

  it('passes the user display name to sidebar', () => {
    renderHomePage();
    expect(screen.getByText(/Sidebar for Max Oesterle/i)).toBeInTheDocument();
  });

  it('calls refreshCurrentUser on mount', () => {
    renderHomePage();
    expect(mockRefreshCurrentUser).toHaveBeenCalledTimes(1);
  });

  it('renders the model library when opened via its URL', () => {
    renderHomePage(MODEL_LIBRARY_PATH);
    expect(screen.getByTestId('model-library-table')).toBeInTheDocument();
    expect(screen.queryByTestId('landing-view')).not.toBeInTheDocument();
  });

  it('keeps the model library open on its model URLs', () => {
    renderHomePage(modelLibraryUmlPath(1));
    expect(screen.getByTestId('model-library-table')).toBeInTheDocument();
  });

  it('changes the URL when the model library is opened from the sidebar', () => {
    renderHomePage();
    fireEvent.click(screen.getByRole('button', { name: 'Model Library' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent(MODEL_LIBRARY_PATH);
    expect(screen.getByTestId('model-library-table')).toBeInTheDocument();
  });

  it('opens the home page from the Vitruvius logo of the model library UML editor', () => {
    renderHomePage();
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    fireEvent.click(screen.getByRole('button', { name: 'Model Library' }));

    fireEvent.click(screen.getByRole('button', { name: 'Vitruvius logo' }));

    expect(screen.getByTestId('current-path')).toHaveTextContent(/^\/$/);
    expect(screen.getByTestId('landing-view')).toBeInTheDocument();
    expect(screen.queryByTestId('projects-view')).not.toBeInTheDocument();
  });

  it('leaves the model library URL when another view is opened from the sidebar', () => {
    renderHomePage(MODEL_LIBRARY_PATH);
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent(/^\/$/);
    expect(screen.getByTestId('projects-view')).toBeInTheDocument();
    expect(screen.queryByTestId('model-library-table')).not.toBeInTheDocument();
  });
});
