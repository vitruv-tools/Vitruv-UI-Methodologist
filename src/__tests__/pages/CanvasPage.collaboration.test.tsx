import type { Mock } from 'vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CanvasPage } from '../../pages/CanvasPage';
import { apiService } from '../../services/api';
import type { CollaborationState } from '../../collaboration/useCanvasCollaboration';

const mockNavigate = vi.fn();
let mockRouteId = '10';
/** What the page gets from the collaboration; the tests set it. */
const collaboration: { current: CollaborationState } = vi.hoisted(() => ({ current: null as any }));
/** The props of the last rendered canvas. */
const canvasProps: { current: any } = vi.hoisted(() => ({ current: null }));
/** What the page calls on the canvas for Undo and Redo. */
const canvasHistory = vi.hoisted(() => ({ undo: vi.fn(), redo: vi.fn() }));

vi.mock('../../collaboration/useCanvasCollaboration', () => ({
  useCanvasCollaboration: () => collaboration.current,
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<any>('react-router-dom')),
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: mockRouteId }),
  useLocation: () => ({ state: null }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', username: 'tester', email: 'tester@example.com', givenName: 'Test', familyName: 'User', emailVerified: true },
  }),
}));

vi.mock('../../components/flow/FlowCanvas', async () => {
  const React = await import('react');
  return {
    FlowCanvas: React.forwardRef((props: any, ref: any) => {
      canvasProps.current = props;
      const [nodes, setNodes] = React.useState<any[]>([]);
      React.useImperativeHandle(ref, () => ({
        isLocked: () => false,
        loadDiagramData: (next: any[]) => setNodes(next),
        getNodes: () => nodes,
        getEdges: vi.fn(() => []),
        getViewport: () => undefined,
        addEcoreFile: vi.fn(),
        updateEcoreFileData: vi.fn(),
        resetExpandedFile: vi.fn(),
        undo: canvasHistory.undo,
        redo: canvasHistory.redo,
        getReactionEdges: vi.fn(() => []),
        getViewTypes: vi.fn(() => []),
        getWorkspaceSnapshot: vi.fn(() => ({ metaModelIds: [], metaModelRelationRequests: [] })),
        fitUmlView: vi.fn(),
        openSelectedReactionEditor: vi.fn(() => false),
      }), [nodes]);
      return (
        <div data-testid="flow-canvas">
          {props.projectTabsBelowModeToggle}
          {nodes.map((node: any) => <span key={node.id}>{node.id}</span>)}
          <button type="button" onClick={() => setNodes((previous: any[]) => [...previous, { id: `model-${previous.length + 1}` }])}>
            Add test model
          </button>
        </div>
      );
    }),
  };
});

vi.mock('../../components/constraints/ConstraintsView', () => ({ ConstraintsView: () => <div /> }));

vi.mock('../../services/api', () => ({
  apiService: {
    getVsumDetails: vi.fn(),
    getVsum: vi.fn(),
    getVsumMembers: vi.fn(),
    getVsumsPaginated: vi.fn(),
    findMetaModels: vi.fn(),
    getRuleSets: vi.fn().mockResolvedValue([]),
    getFile: vi.fn(),
    getMetaModel: vi.fn(),
    removeVsumMember: vi.fn(),
    buildVsum: vi.fn(),
    downloadVsumProject: vi.fn(),
    downloadVsumJar: vi.fn(),
    downloadVsumBundle: vi.fn(),
    getLatestVsumVersion: vi.fn(),
    publishVsum: vi.fn(),
    getVsumBuild: vi.fn(),
    renameVsum: vi.fn(),
    deleteMetaModel: vi.fn(),
    syncVsumChanges: vi.fn(),
  },
}));

const vsumDetails = (id: number, name: string, role?: string) => ({
  data: { id, name, role, metaModels: [], metaModelsRelation: [], createdAt: '', updatedAt: '' },
});

const off = (): CollaborationState => ({ enabled: false, connection: null, sync: null, holding: false, unavailable: false });
const connection = (changes: Partial<NonNullable<CollaborationState['connection']>> = {}) => ({
  status: 'connected' as const,
  synced: true,
  writebackError: null,
  project: {} as any,
  generation: 0,
  failure: null,
  ...changes,
});
/** Live collaboration: the project is shown on the canvas, and changes are written into it. */
const live = (changes: Partial<NonNullable<CollaborationState['connection']>> = {}): CollaborationState => ({
  enabled: true,
  connection: connection(changes),
  sync: { pushLocalChanges: vi.fn() } as any,
  holding: false,
  unavailable: false,
});

async function waitForProject(name: string) {
  await screen.findByRole('tab', { name: new RegExp(name) });
  await waitFor(() => expect(screen.queryByText(/Loading project…|Opening workspace…/)).not.toBeInTheDocument());
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRouteId = '10';
  collaboration.current = off();
  (apiService.findMetaModels as Mock).mockResolvedValue({ data: [] });
  (apiService.getVsumMembers as Mock).mockResolvedValue({ data: [] });
  (apiService.getVsum as Mock).mockResolvedValue({ data: {} });
  (apiService.getVsumsPaginated as Mock).mockResolvedValue({ data: [] });
  (apiService.getVsumDetails as Mock).mockImplementation((id: number) => Promise.resolve(vsumDetails(id, id === 10 ? 'Project A' : 'Project B')));
  (apiService.syncVsumChanges as Mock).mockResolvedValue({ data: { message: 'Saved' } });
});

describe('without collaboration', () => {
  it('works as before: there is a Save, and the canvas is told to save', async () => {
    render(<CanvasPage />);
    await waitForProject('Project A');

    expect(screen.getByRole('button', { name: /^Save/ })).toBeInTheDocument();
    expect(canvasProps.current.onSaveChanges).toBeInstanceOf(Function);
    expect(canvasProps.current.collaboration).toBeUndefined();
    expect(canvasProps.current.disableUndo).toBe(false);
    expect(canvasProps.current.readOnly).toBe(false);
  });
});

describe('with live collaboration', () => {
  beforeEach(() => {
    collaboration.current = live();
  });

  it('writes the changes of the canvas into the project, and has no Save', async () => {
    render(<CanvasPage />);
    await waitForProject('Project A');

    expect(canvasProps.current.collaboration).toBe(collaboration.current.sync);
    expect(canvasProps.current.disableUndo).toBe(true);
    expect(canvasProps.current.readOnly).toBe(false);
    // Saving through the canvas would send it as the whole project.
    expect(canvasProps.current.onSaveChanges).toBeUndefined();
    expect(screen.queryByRole('button', { name: /^Save/ })).not.toBeInTheDocument();
  });

  it('has Undo and Redo, which the canvas answers with the history of the project', async () => {
    canvasHistory.undo.mockClear();
    canvasHistory.redo.mockClear();
    render(<CanvasPage />);
    await waitForProject('Project A');
    expect(screen.getByRole('button', { name: 'Undo. Nothing to undo' })).toBeInTheDocument();

    act(() => canvasProps.current.onHistoryChange(true, true));
    fireEvent.click(screen.getByRole('button', { name: 'Undo. Undo the last action' }));
    fireEvent.click(screen.getByRole('button', { name: 'Redo. Redo the last undone action' }));

    expect(canvasHistory.undo).toHaveBeenCalledTimes(1);
    expect(canvasHistory.redo).toHaveBeenCalledTimes(1);
  });

  it('does not save with Cmd+S, but still keeps the browser from opening its dialog', async () => {
    render(<CanvasPage />);
    await waitForProject('Project A');

    const notPrevented = fireEvent.keyDown(document, { key: 's', metaKey: true });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(notPrevented).toBe(false);
    expect(apiService.syncVsumChanges).not.toHaveBeenCalled();
  });

  it('has nothing unsaved, so leaving the page needs no warning', async () => {
    render(<CanvasPage />);
    await waitForProject('Project A');
    fireEvent.click(screen.getByRole('button', { name: 'Add test model' }));
    await new Promise((resolve) => setTimeout(resolve, 800)); // longer than the page's check for changes

    const event = new Event('beforeunload', { cancelable: true });
    globalThis.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('does not warn before the page is left while the connection is lost; the status banner shows it', async () => {
    collaboration.current = live({ status: 'disconnected', synced: false });
    render(<CanvasPage />);
    await waitForProject('Project A');

    const event = new Event('beforeunload', { cancelable: true });
    globalThis.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('shows nothing about collaboration while all is well', async () => {
    render(<CanvasPage />);
    await waitForProject('Project A');

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says so when the connection is lost', async () => {
    collaboration.current = live({ status: 'disconnected', synced: false });
    render(<CanvasPage />);
    await waitForProject('Project A');

    expect(screen.getByRole('status')).toHaveTextContent('Connection lost');
  });

  it('shows why the server could not save the changes', async () => {
    collaboration.current = live({ writebackError: 'The changes could not be saved: View name "V" is not unique' });
    render(<CanvasPage />);
    await waitForProject('Project A');

    expect(screen.getByRole('status')).toHaveTextContent('View name "V" is not unique');
  });

  it('asks to reload the page if the project cannot be kept in sync', async () => {
    collaboration.current = live({ status: 'disconnected', synced: false, failure: 'outdated' });
    render(<CanvasPage />);
    await waitForProject('Project A');

    expect(screen.getByRole('alert')).toHaveTextContent('Reload the page');
  });

  it('loads a tab again when switching back to it, so that its canvas shows the shared project, not an old copy', async () => {
    const { rerender } = render(<CanvasPage />);
    await waitForProject('Project A');
    fireEvent.click(screen.getByRole('button', { name: 'Add test model' }));

    mockRouteId = '20';
    rerender(<CanvasPage />);
    await waitForProject('Project B');
    const loads = (apiService.getVsumDetails as Mock).mock.calls.length;
    fireEvent.click(screen.getByRole('tab', { name: /Project A/ }));

    await waitFor(() => expect((apiService.getVsumDetails as Mock).mock.calls.length).toBeGreaterThan(loads));
    await waitFor(() => expect(within(screen.getByTestId('flow-canvas')).queryAllByText(/^model-\d+$/)).toHaveLength(0));
  });
});

describe('while the shared project is not shown yet', () => {
  it('keeps the canvas hidden, as the project loading, since changes made now could be taken away again', async () => {
    collaboration.current = { ...off(), enabled: true, connection: connection({ synced: false, status: 'connecting' }), holding: true };
    render(<CanvasPage />);
    // Long enough for the project to be loaded from the backend; without the hold, the canvas would
    // be shown by now. (A hidden canvas is skipped by role and name queries, so those aren't used.)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(screen.getByText('Opening workspace…')).toBeInTheDocument();
    expect(screen.getByTestId('flow-canvas').parentElement).toHaveStyle({ visibility: 'hidden' });
    // Joining the project is not a lost connection.
    expect(screen.queryByText(/Connection lost/)).not.toBeInTheDocument();
  });
});

describe('when the collaboration server cannot be reached', () => {
  beforeEach(() => {
    collaboration.current = { ...off(), enabled: true, connection: connection({ synced: false, status: 'connecting' }), unavailable: true };
  });

  it('lets the project be looked at, but not changed', async () => {
    render(<CanvasPage />);
    await waitForProject('Project A');

    expect(canvasProps.current.readOnly).toBe(true);
    expect(canvasProps.current.collaboration).toBeUndefined();
    expect(screen.getByRole('alert')).toHaveTextContent('can not be changed');
  });

  it('does not save the canvas as the whole project in its place', async () => {
    render(<CanvasPage />);
    await waitForProject('Project A');

    fireEvent.keyDown(document, { key: 's', metaKey: true });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(apiService.syncVsumChanges).not.toHaveBeenCalled();
  });
});
