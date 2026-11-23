import React, { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Edge, Node } from 'reactflow';
import { FlowCanvas } from '../../../components/flow/FlowCanvas';

// The canvas starts with these; the mocked flow state below keeps them as real state.
const initial = vi.hoisted(() => ({ nodes: [] as any[], edges: [] as any[], canUndo: false, canRedo: false, undo: null as any }));
/** The props the canvas gave the last rendered <ReactFlow>: its nodes have the callbacks of the boxes. */
const flow = vi.hoisted(() => ({ props: null as any }));

vi.mock('reactflow', () => {
  const MockReactFlow = (props: any) => {
    flow.props = props;
    return <div data-testid="react-flow" className="react-flow">{props.children}</div>;
  };
  return {
    __esModule: true,
    default: MockReactFlow,
    ReactFlow: MockReactFlow,
    MiniMap: () => <div />,
    Background: () => <div />,
    Controls: () => <div />,
    Handle: ({ children }: any) => <div>{children}</div>,
    Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
    MarkerType: { ArrowClosed: 'arrowclosed', Arrow: 'arrow' },
    ConnectionMode: { Loose: 'loose', Strict: 'strict' },
    SelectionMode: { Partial: 'partial', Full: 'full' },
    useStoreApi: () => ({ setState: vi.fn(), getState: vi.fn(() => ({})) }),
    useReactFlow: () => ({ screenToFlowPosition: vi.fn(() => ({ x: 0, y: 0 })), getNodes: vi.fn(() => []), getEdges: vi.fn(() => []), fitView: vi.fn(), project: vi.fn((p: any) => p) }),
    useNodes: vi.fn(() => []),
    useEdges: vi.fn(() => []),
    useStore: vi.fn(() => ({})),
    applyNodeChanges: vi.fn((_c: any, nodes: any) => nodes),
    applyEdgeChanges: vi.fn((_c: any, edges: any) => edges),
    addEdge: vi.fn((edge: any, edges: any) => [...edges, edge]),
    getBezierPath: vi.fn(() => ['M0,0', 0, 0, 0, 0]),
    getStraightPath: vi.fn(() => ['M0,0', 0, 0]),
    getSimpleBezierPath: vi.fn(() => ['M0,0', 0, 0, 0, 0]),
  };
});

vi.mock('../../../hooks/useFlowState', async () => {
  const { useState, useCallback } = await import('react');
  return {
    useFlowState: () => {
      const [nodes, setNodes] = useState<any[]>(initial.nodes);
      const [edges, setEdges] = useState<any[]>(initial.edges);
      const addNode = useCallback((node: any) => { setNodes((current) => [...current, node]); return node.id; }, []);
      const addEdge = useCallback((edge: any) => { setEdges((current) => [...current, edge]); return edge.id; }, []);
      const removeNode = useCallback((id: string) => {
        setNodes((current) => current.filter((n) => n.id !== id));
        setEdges((current) => current.filter((e) => e.source !== id && e.target !== id));
      }, []);
      const removeEdge = useCallback((id: string) => setEdges((current) => current.filter((e) => e.id !== id)), []);
      return {
        nodes, edges, setNodes, setEdges, addNode, addEdge, removeNode, removeEdge,
        onNodesChange: vi.fn(), onEdgesChange: vi.fn(), onConnect: vi.fn(), updateNodeLabel: vi.fn(),
        undo: initial.undo ?? vi.fn(), redo: vi.fn(), canUndo: initial.canUndo, canRedo: initial.canRedo, updateEdgeCode: vi.fn(),
        setHistoryPaused: vi.fn(), establishBaseline: vi.fn(),
      };
    },
  };
});

vi.mock('../../../hooks/useDragAndDrop', () => ({ useDragAndDrop: () => ({ onDrop: vi.fn(), onDragOver: vi.fn() }) }));
vi.mock('../../../components/flow/EditableNode', () => ({ EditableNode: () => <div /> }));
vi.mock('../../../components/flow/EcoreFileBox', () => ({ EcoreFileBox: () => <div>Ecore File</div> }));
vi.mock('../../../components/flow/UMLRelationship', () => ({ UMLRelationship: () => null }));
vi.mock('../../../components/flow/ReactionRelationship', () => ({ ReactionRelationship: () => null }));
vi.mock('../../../components/flow/ConnectionLine', () => ({ ConnectionLine: () => <svg /> }));
vi.mock('../../../components/flow/canvas/CircleOverlay', () => ({ CircleOverlay: () => <div /> }));
vi.mock('../../../components/flow/CodeEditorModal', () => ({ CodeEditorModal: () => <div /> }));
vi.mock('../../../services/api', () => ({
  apiService: {
    getFile: vi.fn(),
    getVsumDetails: vi.fn().mockResolvedValue({ data: { views: [] }, message: 'ok' }),
    uploadFile: vi.fn().mockResolvedValue({ data: { id: 42 } }),
    updateReactionFile: vi.fn().mockResolvedValue(undefined),
    updateMetaModel: vi.fn().mockResolvedValue(undefined),
  },
}));

const box = (sourceId: number, x = 0, y = 0, extra: Partial<Node> = {}): Node => ({
  id: `ecore-${sourceId}`,
  type: 'ecoreFile',
  position: { x, y },
  data: { fileName: `M${sourceId}.ecore`, displayName: `M${sourceId}`, metaModelId: sourceId, metaModelSourceId: sourceId, nsUri: `ns:${sourceId}` },
  ...extra,
});
const reaction = (source: number, target: number, reactionFileId: number | null = 30, extra: Partial<Edge> = {}): Edge => ({
  id: `edge-${source}-${target}`,
  source: `ecore-${source}`,
  target: `ecore-${target}`,
  type: 'reactions',
  data: { reactionFileId },
  ...extra,
});

function collaborationMock() {
  const listeners = new Set<(history: { canUndo: boolean; canRedo: boolean }) => void>();
  const mock = {
    pushLocalChanges: vi.fn(),
    pushMappings: vi.fn(),
    pushReactionLayout: vi.fn(),
    removeModel: vi.fn(),
    removeRelation: vi.fn(),
    undo: vi.fn(() => true),
    redo: vi.fn(() => true),
    state: { canUndo: false, canRedo: false },
    history: vi.fn(() => mock.state),
    onHistoryChange: vi.fn((listener: (history: { canUndo: boolean; canRedo: boolean }) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    /** The shared history changes, e.g. because the user did something. */
    setHistory(canUndo: boolean, canRedo: boolean) {
      mock.state = { canUndo, canRedo };
      listeners.forEach((listener) => listener(mock.state));
    },
  };
  return mock;
}

function renderCanvas(props: Partial<React.ComponentProps<typeof FlowCanvas>> = {}) {
  const ref = createRef<any>();
  render(<FlowCanvas ref={ref} {...props} />);
  const ids = (items: { id: string }[]) => items.map((i) => i.id);
  return { ref, nodeIds: () => ids(ref.current.getNodes()), edgeIds: () => ids(ref.current.getEdges()) };
}

beforeEach(() => {
  initial.canUndo = false;
  initial.canRedo = false;
  initial.undo = null;
  initial.nodes = [box(1, 0, 0), box(2, 100, 0), box(3, 200, 0)];
  initial.edges = [reaction(1, 2), reaction(2, 3)];
  localStorage.clear();
});

describe('showing the changes of other users', () => {
  it('removes the box of a metamodel with its relations', () => {
    const { ref, nodeIds, edgeIds } = renderCanvas();

    act(() => ref.current.removeEcoreFileBySourceId(2));

    expect(nodeIds()).toEqual(['ecore-1', 'ecore-3']);
    expect(edgeIds()).toEqual([]);
  });

  it('does nothing for a metamodel that is not on the canvas', () => {
    const { ref, nodeIds, edgeIds } = renderCanvas();

    act(() => ref.current.removeEcoreFileBySourceId(9));

    expect(nodeIds()).toHaveLength(3);
    expect(edgeIds()).toHaveLength(2);
  });

  it('moves boxes', () => {
    const { ref } = renderCanvas();

    act(() => ref.current.setEcorePositions(new Map([[2, { x: 7, y: 8 }]])));

    expect(ref.current.getNodes().find((n: Node) => n.id === 'ecore-2').position).toEqual({ x: 7, y: 8 });
    expect(ref.current.getNodes().find((n: Node) => n.id === 'ecore-1').position).toEqual({ x: 0, y: 0 });
  });

  it('adds a relation, changes its reaction file and removes it', () => {
    const { ref, edgeIds } = renderCanvas();

    act(() => ref.current.upsertReactionRelation({ sourceId: 1, targetId: 3, reactionFileId: 40 }));
    const added = ref.current.getEdges().find((e: Edge) => e.source === 'ecore-1' && e.target === 'ecore-3');
    expect(added).toMatchObject({ type: 'reactions', data: { reactionFileId: 40 } });

    act(() => ref.current.upsertReactionRelation({ sourceId: 1, targetId: 3, reactionFileId: 41 }));
    expect(ref.current.getEdges().filter((e: Edge) => e.target === 'ecore-3' && e.source === 'ecore-1')).toHaveLength(1);
    expect(ref.current.getEdges().find((e: Edge) => e.id === added.id).data.reactionFileId).toBe(41);

    act(() => ref.current.removeReactionRelation(1, 3));
    expect(edgeIds()).toEqual(['edge-1-2', 'edge-2-3']);
  });

  it('shows a relation to a box that was added a moment before, once that box is on the canvas', () => {
    const { ref } = renderCanvas();

    act(() => {
      ref.current.addEcoreFile('M4.ecore', '<ecore:EPackage name="m4"/>', { metaModelId: 4, metaModelSourceId: 4, fromServerLoad: true });
    });
    act(() => ref.current.upsertReactionRelation({ sourceId: 1, targetId: 4, reactionFileId: 50 }));

    expect(ref.current.getEdges().some((e: Edge) => e.source === 'ecore-1' && e.target === 'ecore-4')).toBe(true);
  });

  it('puts a box that was added exactly where the other user put it, and leaves the selection alone', () => {
    const onEcoreFileSelect = vi.fn();
    const { ref } = renderCanvas({ onEcoreFileSelect });

    act(() => {
      ref.current.addEcoreFile('M4.ecore', '<ecore:EPackage name="m4"/>', {
        metaModelId: 4,
        metaModelSourceId: 4,
        displayName: 'M4',
        fromServerLoad: true,
        position: { x: 100, y: 0 }, // where box 2 is
        exactPosition: true,
        keepSelection: true,
      });
    });

    expect(ref.current.getNodes().find((n: Node) => n.id === 'ecore-4').position).toEqual({ x: 100, y: 0 });
    expect(onEcoreFileSelect).not.toHaveBeenCalled();
  });

  it('shows them to a viewer, whose canvas cannot be edited', () => {
    const { ref, nodeIds } = renderCanvas({ readOnly: true });

    act(() => ref.current.removeEcoreFileBySourceId(3));

    expect(nodeIds()).toEqual(['ecore-1', 'ecore-2']);
  });

  it('moves a box that is added by the user to a free place, as before', () => {
    const { ref } = renderCanvas();

    act(() => {
      ref.current.addEcoreFile('M4.ecore', '<ecore:EPackage name="m4"/>', { metaModelId: 4, metaModelSourceId: 4, position: { x: 100, y: 0 } });
    });

    expect(ref.current.getNodes().find((n: Node) => n.id === 'ecore-4').position).not.toEqual({ x: 100, y: 0 });
  });
});

describe('writing the changes of the user into the project', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does so once the canvas has been still for a moment', () => {
    const collaboration = collaborationMock();
    const { ref } = renderCanvas({ collaboration });
    act(() => { vi.advanceTimersByTime(1000); });
    collaboration.pushLocalChanges.mockClear();

    act(() => ref.current.setEcorePositions(new Map([[1, { x: 50, y: 50 }]])));
    act(() => { vi.advanceTimersByTime(150); });
    expect(collaboration.pushLocalChanges).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(100); });

    expect(collaboration.pushLocalChanges).toHaveBeenCalledTimes(1);
  });

  it('waits while the canvas keeps changing, like during a drag', () => {
    const collaboration = collaborationMock();
    const { ref } = renderCanvas({ collaboration });
    act(() => { vi.advanceTimersByTime(1000); });
    collaboration.pushLocalChanges.mockClear();

    for (let x = 1; x <= 10; x++) {
      act(() => ref.current.setEcorePositions(new Map([[1, { x, y: 0 }]])));
      act(() => { vi.advanceTimersByTime(100); });
    }
    expect(collaboration.pushLocalChanges).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(250); });

    expect(collaboration.pushLocalChanges).toHaveBeenCalledTimes(1);
  });

  it('keeps writing at short intervals while a box is dragged, so that others see it move', () => {
    const collaboration = collaborationMock();
    const { ref } = renderCanvas({ collaboration });
    act(() => { vi.advanceTimersByTime(1000); });
    collaboration.pushLocalChanges.mockClear();

    // The user drags box 1 for about a second: the canvas changes every frame.
    for (let frame = 1; frame <= 60; frame++) {
      act(() => ref.current.loadDiagramData(
        ref.current.getNodes().map((n: Node) => (n.id === 'ecore-1' ? { ...n, dragging: true, position: { x: frame * 5, y: 0 } } : n)),
        ref.current.getEdges(),
      ));
      act(() => { vi.advanceTimersByTime(16); });
    }

    // About once per frame (16 ms) while the box is still held, and never more often than that.
    expect(collaboration.pushLocalChanges.mock.calls.length).toBeGreaterThanOrEqual(30);
    expect(collaboration.pushLocalChanges.mock.calls.length).toBeLessThanOrEqual(62);
  });

  it('writes the final position once the box is let go', () => {
    const collaboration = collaborationMock();
    const { ref } = renderCanvas({ collaboration });
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => ref.current.loadDiagramData(
      ref.current.getNodes().map((n: Node) => (n.id === 'ecore-1' ? { ...n, dragging: true, position: { x: 9, y: 9 } } : n)),
      ref.current.getEdges(),
    ));
    act(() => { vi.advanceTimersByTime(500); });
    collaboration.pushLocalChanges.mockClear();

    act(() => ref.current.loadDiagramData(
      ref.current.getNodes().map((n: Node) => (n.id === 'ecore-1' ? { ...n, dragging: false, position: { x: 10, y: 10 } } : n)),
      ref.current.getEdges(),
    ));
    act(() => { vi.advanceTimersByTime(300); });

    expect(collaboration.pushLocalChanges).toHaveBeenCalledTimes(1);
  });

  it('does not for a viewer, nor without collaboration', () => {
    const viewer = collaborationMock();
    const { ref } = renderCanvas({ collaboration: viewer, readOnly: true });
    act(() => ref.current.setEcorePositions(new Map([[1, { x: 50, y: 50 }]])));
    act(() => { vi.advanceTimersByTime(1000); });

    expect(viewer.pushLocalChanges).not.toHaveBeenCalled();
    expect(() => renderCanvas()).not.toThrow();
  });

  it('does not for changes that do not matter to the project, like selecting a box', () => {
    const collaboration = collaborationMock();
    const { ref } = renderCanvas({ collaboration });
    act(() => { vi.advanceTimersByTime(1000); });
    collaboration.pushLocalChanges.mockClear();

    act(() => ref.current.loadDiagramData(
      ref.current.getNodes().map((n: Node) => ({ ...n, selected: true })),
      ref.current.getEdges(),
    ));
    act(() => { vi.advanceTimersByTime(1000); });

    expect(collaboration.pushLocalChanges).not.toHaveBeenCalled();
  });
});

describe('deleting', () => {
  /** Asks to remove a box, like the canvas does when its delete button is used, and confirms. */
  function removeBoxAndConfirm(ref: React.RefObject<any>, sourceId: number) {
    const node = flow.props.nodes.find((n: Node) => n.id === `ecore-${sourceId}`);
    act(() => node.data.onRequestDelete(node.id));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
  }

  it('a box tells the project, which then deletes the metamodel', () => {
    const collaboration = collaborationMock();
    const { ref, nodeIds } = renderCanvas({ collaboration });

    removeBoxAndConfirm(ref, 2);

    expect(collaboration.removeModel).toHaveBeenCalledTimes(1);
    expect(collaboration.removeModel).toHaveBeenCalledWith(2);
    expect(nodeIds()).toEqual(['ecore-1', 'ecore-3']);
  });

  it('does not let the flow library delete on its own key, which would skip the confirmation and the project', () => {
    renderCanvas({ collaboration: collaborationMock() });

    expect(flow.props.deleteKeyCode).toBeNull();
  });

  it('is only told once the user confirmed', () => {
    const collaboration = collaborationMock();
    const { ref, nodeIds } = renderCanvas({ collaboration });
    const node = flow.props.nodes.find((n: Node) => n.id === 'ecore-2');

    act(() => node.data.onRequestDelete(node.id));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(collaboration.removeModel).not.toHaveBeenCalled();
    expect(nodeIds()).toHaveLength(3);
  });

  it('a relation tells the project, with the library IDs of its metamodels', () => {
    initial.nodes = [box(1), { ...box(2), data: { ...box(2).data, metaModelId: 1002, metaModelSourceId: 2 } }];
    initial.edges = [reaction(1, 2, 30, { selected: true })];
    const collaboration = collaborationMock();
    renderCanvas({ collaboration });

    act(() => { fireEvent.keyDown(document, { key: 'Delete' }); });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(collaboration.removeRelation).toHaveBeenCalledWith(1, 2);
    expect(collaboration.removeModel).not.toHaveBeenCalled();
  });

  it('never happens because the canvas was emptied, as when another project is loaded', () => {
    const collaboration = collaborationMock();
    const { ref, nodeIds } = renderCanvas({ collaboration });

    act(() => ref.current.loadDiagramData([], []));

    expect(nodeIds()).toEqual([]);
    expect(collaboration.removeModel).not.toHaveBeenCalled();
    expect(collaboration.removeRelation).not.toHaveBeenCalled();
  });

  it('is not told for a viewer', () => {
    const collaboration = collaborationMock();
    renderCanvas({ collaboration, readOnly: true });
    const node = flow.props.nodes.find((n: Node) => n.id === 'ecore-2');

    act(() => node.data.onRequestDelete?.(node.id));

    expect(collaboration.removeModel).not.toHaveBeenCalled();
  });

  it('works as before without collaboration', () => {
    const { ref, nodeIds } = renderCanvas();

    removeBoxAndConfirm(ref, 2);

    expect(nodeIds()).toEqual(['ecore-1', 'ecore-3']);
  });
});

describe('undo', () => {
  it('is available as before without collaboration', () => {
    initial.canUndo = true;
    initial.canRedo = true;
    const onHistoryChange = vi.fn();

    renderCanvas({ onHistoryChange });

    expect(onHistoryChange).toHaveBeenLastCalledWith(true, true);
  });

  it('is off when it is disabled, since it would also undo what other users did', () => {
    initial.canUndo = true;
    initial.canRedo = true;
    const onHistoryChange = vi.fn();

    renderCanvas({ onHistoryChange, disableUndo: true });

    expect(onHistoryChange).toHaveBeenLastCalledWith(false, false);
  });

  it('is not done by the keyboard when it is disabled', () => {
    initial.canUndo = true;
    initial.undo = vi.fn().mockReturnValue(null);
    renderCanvas({ disableUndo: true });

    act(() => { fireEvent.keyDown(document, { key: 'z', metaKey: true }); });
    act(() => { fireEvent.keyDown(document, { key: 'z', ctrlKey: true }); });

    expect(initial.undo).not.toHaveBeenCalled();
  });

  it('is done by the keyboard otherwise', () => {
    initial.canUndo = true;
    initial.undo = vi.fn().mockReturnValue(null);
    renderCanvas();

    act(() => { fireEvent.keyDown(document, { key: 'z', ctrlKey: true }); });

    expect(initial.undo).toHaveBeenCalled();
  });
});

describe('undoing own changes', () => {
  it('uses the history of the shared project, not the snapshots of the canvas', () => {
    initial.canUndo = true;
    const collaboration = collaborationMock();
    const { ref } = renderCanvas({ collaboration, disableUndo: true });

    expect(ref.current.canUndo).toBe(false);
    act(() => collaboration.setHistory(true, false));

    expect(ref.current.canUndo).toBe(true);
    expect(ref.current.canRedo).toBe(false);
    act(() => ref.current.undo());
    expect(collaboration.undo).toHaveBeenCalledTimes(1);
  });

  it('redoes in the shared project', () => {
    const collaboration = collaborationMock();
    const { ref } = renderCanvas({ collaboration, disableUndo: true });
    act(() => collaboration.setHistory(false, true));

    expect(ref.current.canRedo).toBe(true);
    act(() => ref.current.redo());

    expect(collaboration.redo).toHaveBeenCalledTimes(1);
  });

  it('starts with what the project already has to undo', () => {
    const collaboration = collaborationMock();
    collaboration.state = { canUndo: true, canRedo: true };
    const { ref } = renderCanvas({ collaboration, disableUndo: true });

    expect(ref.current.canUndo).toBe(true);
    expect(ref.current.canRedo).toBe(true);
  });

  it('tells the page what there is to undo and redo, for the buttons', () => {
    const collaboration = collaborationMock();
    const onHistoryChange = vi.fn();
    renderCanvas({ collaboration, disableUndo: true, onHistoryChange });

    act(() => collaboration.setHistory(true, false));

    expect(onHistoryChange).toHaveBeenLastCalledWith(true, false);
  });

  it('is done with Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z', () => {
    const collaboration = collaborationMock();
    renderCanvas({ collaboration, disableUndo: true });
    act(() => collaboration.setHistory(true, true));

    fireEvent.keyDown(document, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true, shiftKey: true });

    expect(collaboration.undo).toHaveBeenCalledTimes(1);
    expect(collaboration.redo).toHaveBeenCalledTimes(1);
  });

  it('is not possible for a viewer', () => {
    const collaboration = collaborationMock();
    collaboration.state = { canUndo: true, canRedo: true };
    const { ref } = renderCanvas({ collaboration, disableUndo: true, readOnly: true });

    expect(ref.current.canUndo).toBe(false);
    act(() => ref.current.undo());
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true });

    expect(collaboration.undo).not.toHaveBeenCalled();
  });

  it('stops listening to the project when the canvas goes away', () => {
    const collaboration = collaborationMock();
    const { unmount } = render(<FlowCanvas collaboration={collaboration} disableUndo />);
    const stop = collaboration.onHistoryChange.mock.results[0].value as () => boolean;

    unmount();

    expect(stop).toBeDefined();
    expect(() => collaboration.setHistory(true, true)).not.toThrow();
  });

  it('marks the positions written while a box is dragged, so that the whole drag is one step', () => {
    vi.useFakeTimers();
    const collaboration = collaborationMock();
    const { ref } = renderCanvas({ collaboration, disableUndo: true });
    act(() => { vi.advanceTimersByTime(1000); });
    collaboration.pushLocalChanges.mockClear();

    act(() => ref.current.loadDiagramData(
      ref.current.getNodes().map((n: Node) => (n.id === 'ecore-1' ? { ...n, dragging: true, position: { x: 5, y: 0 } } : n)),
      ref.current.getEdges(),
    ));
    act(() => { vi.advanceTimersByTime(100); });
    expect(collaboration.pushLocalChanges).toHaveBeenLastCalledWith({ dragging: true });

    act(() => ref.current.loadDiagramData(
      ref.current.getNodes().map((n: Node) => (n.id === 'ecore-1' ? { ...n, dragging: false, position: { x: 9, y: 0 } } : n)),
      ref.current.getEdges(),
    ));
    act(() => { vi.advanceTimersByTime(300); });

    expect(collaboration.pushLocalChanges).toHaveBeenLastCalledWith({ dragging: false });
    vi.useRealTimers();
  });
});
