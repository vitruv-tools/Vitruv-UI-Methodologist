import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { CanvasPage } from '../../pages/CanvasPage';
import { apiService } from '../../services/api';

const mockNavigate = jest.fn();
let mockRouteId = '10';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
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
    FlowCanvas: React.forwardRef((_props: any, ref: any) => {
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
        getWorkspaceSnapshot: jest.fn(() => ({
          metaModelIds: [],
          metaModelRelationRequests: [],
        })),
        fitUmlView: jest.fn(),
        openSelectedReactionEditor: jest.fn(() => false),
      }));
      return <div data-testid="flow-canvas" />;
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
    getFile: jest.fn(),
    removeVsumMember: jest.fn(),
    buildVsum: jest.fn(),
    downloadVsumArtifact: jest.fn(),
    renameVsum: jest.fn(),
    deleteMetaModel: jest.fn(),
  },
}));

const apiError = (status: number, message: string) =>
  Object.assign(new Error(message), {
    status,
    response: {
      status,
      data: { message },
    },
  });

describe('CanvasPage invalid project routes', () => {
  let consoleErrorSpy: jest.SpyInstance | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteId = '10';
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (apiService.findMetaModels as jest.Mock).mockResolvedValue({ data: [] });
    (apiService.getVsumMembers as jest.Mock).mockResolvedValue({ data: [] });
    (apiService.getVsum as jest.Mock).mockResolvedValue({ data: {} });
    (apiService.getVsumsPaginated as jest.Mock).mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it('shows access denied and removes the canvas when details returns 403', async () => {
    (apiService.getVsumDetails as jest.Mock).mockRejectedValueOnce(
      apiError(403, 'Forbidden'),
    );

    render(<CanvasPage />);

    expect(await screen.findByRole('heading', { name: /access denied/i })).toBeInTheDocument();
    expect(screen.getByText(/do not have access/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId('flow-canvas')).not.toBeInTheDocument();
    });
  });

  it('shows not found and removes the canvas when details returns 404', async () => {
    mockRouteId = '100';
    (apiService.getVsumDetails as jest.Mock).mockRejectedValueOnce(
      apiError(404, 'Not found'),
    );

    render(<CanvasPage />);

    expect(await screen.findByRole('heading', { name: /project not found/i })).toBeInTheDocument();
    expect(screen.getByText(/does not exist/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId('flow-canvas')).not.toBeInTheDocument();
    });
  });
});
