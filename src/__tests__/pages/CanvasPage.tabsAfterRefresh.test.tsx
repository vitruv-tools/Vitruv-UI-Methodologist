import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CanvasPage } from '../../pages/CanvasPage';
import { apiService } from '../../services/api';
import { openCanvasTabsStorageKey, readStoredCanvasTabs } from '../../utils/canvasTabsStorage';

const USER_KEY = 'tester@example.com';
let mockRouteId = '10';
/** Metamodels the canvas reports; different from the loaded project means unsaved changes. */
let mockLiveMetaModelIds: number[] = [];

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useParams: () => ({ id: mockRouteId }),
  useLocation: () => ({ state: null }),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      username: 'tester',
      email: 'tester@example.com',
      givenName: 'Test',
      familyName: 'User',
      emailVerified: true,
    },
  }),
}));

jest.mock('../../components/flow/FlowCanvas', () => {
  const React = require('react');
  return {
    FlowCanvas: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        loadDiagramData: jest.fn(),
        getNodes: jest.fn(() => []),
        getEdges: jest.fn(() => []),
        addEcoreFile: jest.fn(),
        updateEcoreFileData: jest.fn(),
        resetExpandedFile: jest.fn(),
        undo: jest.fn(),
        redo: jest.fn(),
        canUndo: false,
        canRedo: false,
        getReactionEdges: jest.fn(() => []),
        getViewTypes: jest.fn(() => []),
        getWorkspaceSnapshot: () => ({ metaModelIds: mockLiveMetaModelIds, metaModelRelationRequests: [] }),
        fitUmlView: jest.fn(),
        openSelectedReactionEditor: jest.fn(() => false),
      }));
      return <div data-testid="flow-canvas">{props.projectTabsBelowModeToggle}</div>;
    }),
  };
});

jest.mock('../../components/constraints/ConstraintsView', () => ({
  ConstraintsView: () => <div data-testid="constraints-view" />,
}));

jest.mock('../../services/api', () => ({
  apiService: {
    getVsumDetails: jest.fn(),
    getVsum: jest.fn(),
    getVsumMembers: jest.fn(),
    getVsumsPaginated: jest.fn(),
    findMetaModels: jest.fn(),
    getRuleSets: jest.fn().mockResolvedValue([]),
    getFile: jest.fn(),
    removeVsumMember: jest.fn(),
    buildVsum: jest.fn(),
    downloadVsumArtifact: jest.fn(),
    downloadVsumBundle: jest.fn(),
    renameVsum: jest.fn(),
    deleteMetaModel: jest.fn(),
  },
}));

const vsumDetails = (id: number, name: string) => ({
  data: { id, name, metaModels: [], metaModelsRelation: [], createdAt: '', updatedAt: '' },
});

const projectTab = (name: string) => screen.getByRole('tab', { name: new RegExp(name) });

/** Waits until the project's tab is there and its loading overlay is gone. */
async function waitForProject(name: string) {
  await screen.findByRole('tab', { name: new RegExp(name) });
  await waitFor(() => {
    expect(screen.queryByText(/Loading project…|Opening workspace…/)).not.toBeInTheDocument();
  });
}

/** Fires beforeunload like a refresh does; true when the page asks before leaving. */
function refreshAsksFirst(): boolean {
  return !fireEvent(globalThis as unknown as Window, new Event('beforeunload', { cancelable: true }));
}

describe('CanvasPage open tabs after a page refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    mockRouteId = '10';
    mockLiveMetaModelIds = [];
    (apiService.findMetaModels as jest.Mock).mockResolvedValue({ data: [] });
    (apiService.getVsumMembers as jest.Mock).mockResolvedValue({ data: [] });
    (apiService.getVsum as jest.Mock).mockResolvedValue({ data: {} });
    (apiService.getVsumsPaginated as jest.Mock).mockResolvedValue({ data: [] });
    (apiService.getVsumDetails as jest.Mock).mockImplementation((vsumId: number) => Promise.resolve(
      vsumId === 10 ? vsumDetails(10, 'Project A') : vsumDetails(20, 'Project B'),
    ));
  });

  it('shows the tabs that were open again, with the project from the URL active', async () => {
    sessionStorage.setItem(openCanvasTabsStorageKey(USER_KEY), JSON.stringify([
      { projectId: 10, name: 'Project A' },
      { projectId: 20, name: 'Project B' },
    ]));
    mockRouteId = '20';

    render(<CanvasPage />);
    await waitForProject('Project B');

    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      expect.stringContaining('Project A'),
      expect.stringContaining('Project B'),
    ]);
    expect(projectTab('Project B')).toHaveAttribute('aria-selected', 'true');
    // The other tab loads only when it is opened.
    expect(apiService.getVsumDetails).toHaveBeenCalledWith(20);
    expect(apiService.getVsumDetails).not.toHaveBeenCalledWith(10);

    fireEvent.click(projectTab('Project A'));
    await waitForProject('Project A');

    expect(apiService.getVsumDetails).toHaveBeenCalledWith(10);
    expect(projectTab('Project A')).toHaveAttribute('aria-selected', 'true');
  });

  it('stores the open tabs and forgets a closed one', async () => {
    const { rerender } = render(<CanvasPage />);
    await waitForProject('Project A');
    mockRouteId = '20';
    rerender(<CanvasPage />);
    await waitForProject('Project B');

    expect(readStoredCanvasTabs(USER_KEY)).toEqual([
      { projectId: 10, name: 'Project A' },
      { projectId: 20, name: 'Project B' },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Close Project A' }));

    await waitFor(() => expect(readStoredCanvasTabs(USER_KEY)).toEqual([{ projectId: 20, name: 'Project B' }]));
  });

  it('forgets the tabs when the project page is left in the app', async () => {
    const { unmount } = render(<CanvasPage />);
    await waitForProject('Project A');
    expect(readStoredCanvasTabs(USER_KEY)).toHaveLength(1);

    unmount();

    expect(readStoredCanvasTabs(USER_KEY)).toEqual([]);
  });

  it('asks before a refresh only while there are unsaved changes', async () => {
    render(<CanvasPage />);
    await waitForProject('Project A');
    expect(refreshAsksFirst()).toBe(false);

    mockLiveMetaModelIds = [99];

    await waitFor(() => expect(refreshAsksFirst()).toBe(true), { timeout: 3000 });
  });
});
