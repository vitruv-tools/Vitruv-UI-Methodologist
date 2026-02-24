import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProjectPage } from '../../pages/ProjectPage';

const mockSignOut = jest.fn();

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', username: 'test-user' },
    signOut: mockSignOut,
  }),
}));

jest.mock('../../components/ui/ToastProvider', () => ({
  useToast: () => ({
    showInfo: jest.fn(),
  }),
}));

jest.mock('../../components', () => ({
  SidebarTabs: ({ width }: { width: number }) => (
    <div data-testid="sidebar-tabs">Sidebar width: {width}</div>
  ),
}));

jest.mock('../../components/layout/MainLayout', () => ({
  MainLayout: (props: any) => (
    <div data-testid="main-layout">
      <div data-testid="welcome-title">{props.welcomeTitle}</div>
      <div>{props.leftSidebar}</div>
      {props.workspaceOverlay}
    </div>
  ),
}));

jest.mock('../../components/ui/MetaModelsPanel', () => ({
  MetaModelsPanel: () => <div data-testid="meta-models-panel" />,
}));

jest.mock('../../components/ui/VsumTabs', () => ({
  VsumTabs: (props: any) => (
    <div data-testid="vsum-tabs">
      VSUM tabs count: {props.openTabs.length}
    </div>
  ),
}));

jest.mock('../../services/api', () => ({
  apiService: {
    getFile: jest.fn(),
    getVsumDetails: jest.fn().mockResolvedValue({
      data: { metaModels: [], metaModelsRelation: [] },
    }),
  },
}));

describe('ProjectPage', () => {
  it('renders MainLayout with welcome title and sidebar', () => {
    render(<ProjectPage />);

    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    expect(screen.getByTestId('welcome-title')).toHaveTextContent('Methodological Dashboard');
    expect(screen.getByTestId('sidebar-tabs')).toBeInTheDocument();
  });

  it('shows welcome screen when there are no open tabs', () => {
    render(<ProjectPage />);

    // When there are no openTabs, workspace overlay should be null,
    // so VSUM tabs are not rendered.
    expect(screen.queryByTestId('vsum-tabs')).not.toBeInTheDocument();
  });
});

