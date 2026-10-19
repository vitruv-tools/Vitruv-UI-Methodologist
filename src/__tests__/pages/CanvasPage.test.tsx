import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CanvasPage } from '../../pages/CanvasPage';
import { apiService } from '../../services/api';
import { useModalBodyLock } from '../../components/ui/modalUtils';

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
    // Holds its own models like the real canvas, so a replaced canvas starts empty.
    FlowCanvas: React.forwardRef((props: any, ref: any) => {
      const [nodes, setNodes] = React.useState([]);
      const [viewport, setViewport] = React.useState(props.initialViewport ?? { x: 0, y: 0, zoom: 1 });
      const [locked, setLocked] = React.useState(props.initialLocked ?? false);
      React.useImperativeHandle(ref, () => ({
        loadDiagramData: (nextNodes: any[]) => setNodes(nextNodes),
        getNodes: () => nodes,
        getViewport: () => viewport,
        isLocked: () => locked,
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
        getWorkspaceSnapshot: jest.fn(() => ({
          metaModelIds: [],
          metaModelRelationRequests: [],
        })),
        fitUmlView: jest.fn(),
        openSelectedReactionEditor: jest.fn(() => false),
      }), [nodes, viewport, locked]);
      return (
        <div data-testid="flow-canvas">
          {props.projectTabsBelowModeToggle}
          {nodes.map((node: any) => <span key={node.id}>{node.id}</span>)}
          <span data-testid="canvas-viewport">{`${viewport.x},${viewport.y},${viewport.zoom}`}</span>
          <span data-testid="canvas-locked">{String(locked)}</span>
          {/* Like a model card, which stops every key event while it has the focus. */}
          <div role="button" tabIndex={0} onKeyDown={(e: any) => e.stopPropagation()}>
            Test model card
          </div>
          <button type="button" onClick={() => setViewport({ x: 120, y: 80, zoom: 1.5 })}>
            Pan test canvas
          </button>
          <button type="button" onClick={() => setLocked(true)}>
            Lock test canvas
          </button>
          <button
            type="button"
            onClick={() => setNodes((previous: any[]) => [...previous, { id: `model-${previous.length + 1}` }])}
          >
            Add test model
          </button>
        </div>
      );
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
    syncVsumChanges: jest.fn(),
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

const vsumDetails = (id: number, name: string) => ({
  data: { id, name, metaModels: [], metaModelsRelation: [], createdAt: '', updatedAt: '' },
});

/** Waits until the project's tab is there and its loading overlay is gone. */
async function waitForProject(name: string) {
  await screen.findByRole('tab', { name: new RegExp(name) });
  await waitFor(() => {
    expect(screen.queryByText(/Loading project…|Opening workspace…/)).not.toBeInTheDocument();
  });
}

describe('CanvasPage project tabs', () => {
  const addModel = () => fireEvent.click(screen.getByRole('button', { name: 'Add test model' }));
  const canvasModels = () => within(screen.getByTestId('flow-canvas'))
    .queryAllByText(/^model-\d+$/)
    .map(model => model.textContent);

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteId = '10';
    (apiService.findMetaModels as jest.Mock).mockResolvedValue({ data: [] });
    (apiService.getVsumMembers as jest.Mock).mockResolvedValue({ data: [] });
    (apiService.getVsum as jest.Mock).mockResolvedValue({ data: {} });
    (apiService.getVsumsPaginated as jest.Mock).mockResolvedValue({ data: [] });
    (apiService.getVsumDetails as jest.Mock).mockImplementation((vsumId: number) => Promise.resolve(
      vsumId === 10 ? vsumDetails(10, 'Project A') : vsumDetails(20, 'Project B'),
    ));
  });

  it('keeps the models of every tab when switching between project tabs', async () => {
    const { rerender } = render(<CanvasPage />);
    await waitForProject('Project A');
    addModel();

    // Open project B: the URL changes to its id.
    mockRouteId = '20';
    rerender(<CanvasPage />);
    await waitForProject('Project B');
    expect(canvasModels()).toEqual([]);
    addModel();
    addModel();

    fireEvent.click(screen.getByRole('tab', { name: /Project A/ }));
    await waitFor(() => expect(canvasModels()).toEqual(['model-1']));

    fireEvent.click(screen.getByRole('tab', { name: /Project B/ }));
    await waitFor(() => expect(canvasModels()).toEqual(['model-1', 'model-2']));
  });

  it('keeps the canvas position of every tab when switching between project tabs', async () => {
    const viewport = () => screen.getByTestId('canvas-viewport').textContent;
    const { rerender } = render(<CanvasPage />);
    await waitForProject('Project A');
    fireEvent.click(screen.getByRole('button', { name: 'Pan test canvas' }));

    mockRouteId = '20';
    rerender(<CanvasPage />);
    await waitForProject('Project B');
    expect(viewport()).toBe('0,0,1');

    fireEvent.click(screen.getByRole('tab', { name: /Project A/ }));
    await waitFor(() => expect(viewport()).toBe('120,80,1.5'));

    fireEvent.click(screen.getByRole('tab', { name: /Project B/ }));
    await waitFor(() => expect(viewport()).toBe('0,0,1'));
  });

  it('keeps the lock of every tab when switching between project tabs', async () => {
    const locked = () => screen.getByTestId('canvas-locked').textContent;
    const { rerender } = render(<CanvasPage />);
    await waitForProject('Project A');
    fireEvent.click(screen.getByRole('button', { name: 'Lock test canvas' }));

    mockRouteId = '20';
    rerender(<CanvasPage />);
    await waitForProject('Project B');
    expect(locked()).toBe('false');

    fireEvent.click(screen.getByRole('tab', { name: /Project A/ }));
    await waitFor(() => expect(locked()).toBe('true'));

    fireEvent.click(screen.getByRole('tab', { name: /Project B/ }));
    await waitFor(() => expect(locked()).toBe('false'));
  });
});

describe('CanvasPage save shortcut', () => {
  const OpenModal = () => {
    useModalBodyLock(true);
    return null;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteId = '10';
    (apiService.findMetaModels as jest.Mock).mockResolvedValue({ data: [] });
    (apiService.getVsumMembers as jest.Mock).mockResolvedValue({ data: [] });
    (apiService.getVsum as jest.Mock).mockResolvedValue({ data: {} });
    (apiService.getVsumsPaginated as jest.Mock).mockResolvedValue({ data: [] });
    (apiService.getVsumDetails as jest.Mock).mockResolvedValue(vsumDetails(10, 'Project A'));
    (apiService.syncVsumChanges as jest.Mock).mockResolvedValue({ data: { message: 'Saved' } });
  });

  it('saves the project with Cmd+S instead of opening the browser dialog', async () => {
    render(<CanvasPage />);
    await waitForProject('Project A');

    const notPrevented = fireEvent.keyDown(document, { key: 's', metaKey: true });

    expect(notPrevented).toBe(false);
    await waitFor(() => expect(apiService.syncVsumChanges).toHaveBeenCalledTimes(1));
    expect((apiService.syncVsumChanges as jest.Mock).mock.calls[0][0]).toBe(10);
  });

  it('saves the project with Cmd+S while a model on the canvas has the focus', async () => {
    render(<CanvasPage />);
    await waitForProject('Project A');
    const modelCard = screen.getByRole('button', { name: 'Test model card' });
    modelCard.focus();

    const notPrevented = fireEvent.keyDown(modelCard, { key: 's', metaKey: true });

    expect(notPrevented).toBe(false);
    await waitFor(() => expect(apiService.syncVsumChanges).toHaveBeenCalledTimes(1));
  });

  it('leaves Cmd+S to an open editor or dialog', async () => {
    render(
      <>
        <CanvasPage />
        <OpenModal />
      </>,
    );
    await waitForProject('Project A');

    const notPrevented = fireEvent.keyDown(document, { key: 's', ctrlKey: true });

    expect(notPrevented).toBe(false);
    expect(apiService.syncVsumChanges).not.toHaveBeenCalled();
  });
});
