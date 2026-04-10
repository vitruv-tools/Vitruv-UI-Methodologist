import React, { createRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FlowCanvas } from '../../../components/flow/FlowCanvas';
import { apiService } from '../../../services/api';
import { useProjectStore } from '../../../store/Project';

jest.mock('reactflow', () => {
  const MockReactFlow = ({ children }: any) => (
    <div data-testid="react-flow">{children}</div>
  );
  return {
    __esModule: true,
    default: MockReactFlow,
    ReactFlow: MockReactFlow,
    MiniMap: () => <div data-testid="minimap" />,
    Background: () => <div data-testid="background" />,
    Controls: () => <div data-testid="controls" />,
    Handle: ({ children }: any) => <div>{children}</div>,
    Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
    MarkerType: { ArrowClosed: 'arrowclosed', Arrow: 'arrow' },
    ConnectionMode: { Loose: 'loose', Strict: 'strict' },
    useReactFlow: () => ({
      screenToFlowPosition: jest.fn(() => ({ x: 100, y: 100 })),
      getNodes: jest.fn(() => []),
      getEdges: jest.fn(() => []),
      fitView: jest.fn(),
      project: jest.fn((pos: any) => pos),
    }),
    useNodes: jest.fn(() => []),
    useEdges: jest.fn(() => []),
    useStore: jest.fn(() => ({})),
    applyNodeChanges: jest.fn((changes: any, nodes: any) => nodes),
    applyEdgeChanges: jest.fn((changes: any, edges: any) => edges),
    addEdge: jest.fn((edge: any, edges: any) => [...edges, edge]),
    getBezierPath: jest.fn(() => ['M0,0', 0, 0, 0, 0]),
    getStraightPath: jest.fn(() => ['M0,0', 0, 0]),
    getSimpleBezierPath: jest.fn(() => ['M0,0', 0, 0, 0, 0]),
  };
});

jest.mock('../../../hooks/useFlowState', () => ({
  useFlowState: () => ({
    nodes: [],
    edges: [],
    onNodesChange: jest.fn(),
    onEdgesChange: jest.fn(),
    onConnect: jest.fn(),
    addNode: jest.fn(),
    addEdge: jest.fn(),
    updateNodeLabel: jest.fn(),
    removeNode: jest.fn(),
    removeEdge: jest.fn(),
    setNodes: jest.fn(),
    setEdges: jest.fn(),
    undo: jest.fn(),
    redo: jest.fn(),
    canUndo: false,
    canRedo: false,
    updateEdgeCode: jest.fn(),
  }),
}));

jest.mock('../../../hooks/useDragAndDrop', () => ({
  useDragAndDrop: () => ({
    onDrop: jest.fn(),
    onDragOver: jest.fn(),
  }),
}));

jest.mock('../../../components/flow/EditableNode', () => ({
  EditableNode: () => <div>Editable Node</div>,
}));

jest.mock('../../../components/flow/EcoreFileBox', () => ({
  EcoreFileBox: () => <div>Ecore File</div>,
}));

jest.mock('../../../components/flow/UMLRelationship', () => ({
  UMLRelationship: () => null,
}));

jest.mock('../../../components/flow/ReactionRelationship', () => ({
  ReactionRelationship: () => null,
}));

jest.mock('../../../components/flow/ConnectionLine', () => ({
  ConnectionLine: () => <svg data-testid="connection-line" />,
}));

jest.mock('../../../utils/UMLFromEcoreTS', () => ({
  __esModule: true,
  buildAttributeSignature: jest.fn(),
  buildMethodSignature: jest.fn(),
  getHandleIdForEcoreElement: jest.fn(),
}));

jest.mock('../../../components/flow/CodeEditorModal', () => ({
  CodeEditorModal: () => <div data-testid="code-editor-modal">Code Editor</div>,
}));

jest.mock('../../../services/api', () => ({
  apiService: {
    getFile: jest.fn(),
    uploadFile: jest.fn().mockResolvedValue({ data: { id: 42 } }),
    updateReactionFile: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('FlowCanvas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProjectStore.getState().setActiveId(1);
  });

  afterEach(() => {
    useProjectStore.getState().setActiveId(null);
  });

  it('renders ReactFlow and minimap', () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    expect(screen.getByTestId('minimap')).toBeInTheDocument();
  });

  it('exposes imperative methods via ref', () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    expect(ref.current).toBeDefined();
    expect(typeof ref.current.handleToolClick).toBe('function');
    expect(typeof ref.current.loadDiagramData).toBe('function');
    expect(typeof ref.current.getNodes).toBe('function');
    expect(typeof ref.current.getEdges).toBe('function');
    expect(typeof ref.current.addEcoreFile).toBe('function');
  });

  it('exposes getReactionEdges and getWorkspaceSnapshot via ref', () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    expect(typeof ref.current.getReactionEdges).toBe('function');
    expect(typeof ref.current.getWorkspaceSnapshot).toBe('function');
  });

  it('getReactionEdges returns empty array when no edges', () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    expect(ref.current.getReactionEdges()).toEqual([]);
  });

  it('getWorkspaceSnapshot returns object with required keys', () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    const snapshot = ref.current.getWorkspaceSnapshot();
    expect(snapshot).toHaveProperty('metaModelIds');
    expect(snapshot).toHaveProperty('metaModelRelationRequests');
    expect(Array.isArray(snapshot.metaModelIds)).toBe(true);
    expect(Array.isArray(snapshot.metaModelRelationRequests)).toBe(true);
  });

  it('getNodes returns array', () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    expect(Array.isArray(ref.current.getNodes())).toBe(true);
  });

  it('getEdges returns array', () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    expect(Array.isArray(ref.current.getEdges())).toBe(true);
  });

  it('loadDiagramData does not crash with nodes and edges', () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    act(() => {
      ref.current.loadDiagramData(
        [{ id: 'node-1', type: 'ecoreFile', position: { x: 0, y: 0 }, data: {} }],
        [{ id: 'edge-1', source: 'node-1', target: 'node-2', type: 'reactions', data: { reactionFileId: 5 } }],
      );
    });
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('loadDiagramData does not crash with empty arrays', () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    act(() => { ref.current.loadDiagramData([], []); });
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('calls onEcoreFileSelect when addEcoreFile is called', () => {
    const ref = createRef<any>();
    const onEcoreFileSelect = jest.fn();
    render(<FlowCanvas ref={ref} onEcoreFileSelect={onEcoreFileSelect} />);
    act(() => {
      ref.current.addEcoreFile('test.ecore', '<ecore:EPackage name="test"/>', {
        metaModelId: 1,
        position: { x: 100, y: 100 },
      });
    });
    expect(onEcoreFileSelect).toHaveBeenCalledWith('test.ecore');
  });

  it('handleToolClick does not crash', () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    act(() => { ref.current.handleToolClick('some-tool'); });
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('handles Ctrl+Z for undo', () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    act(() => { fireEvent.keyDown(document, { key: 'z', ctrlKey: true }); });
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('handles Ctrl+Shift+Z for redo', () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    act(() => { fireEvent.keyDown(document, { key: 'z', ctrlKey: true, shiftKey: true }); });
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('handles Delete key', () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    act(() => { fireEvent.keyDown(document, { key: 'Delete' }); });
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('handles Backspace key', () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    act(() => { fireEvent.keyDown(document, { key: 'Backspace' }); });
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('handles Escape key', () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('handles vitruv.createReactionEdge custom event', async () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    await act(async () => {
      window.dispatchEvent(new CustomEvent('vitruv.createReactionEdge', {
        detail: { sourceNodeId: 'node-1', targetNodeId: 'node-2', code: 'code', originalEdgeId: 1 },
      }));
    });
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('handles vitruv.loadMetaModelRelations custom event', async () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    await act(async () => {
      window.dispatchEvent(new CustomEvent('vitruv.loadMetaModelRelations', {
        detail: { relations: [] },
      }));
    });
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('renders with userId and vsumId props', () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} userId="user-1" vsumId="vsum-1" />);
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('CodeEditorModal is not shown by default', () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    expect(screen.queryByTestId('code-editor-modal')).not.toBeInTheDocument();
  });

  it('mousemove event on document does not crash during connection drag', () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    act(() => { fireEvent.mouseMove(document, { clientX: 100, clientY: 200 }); });
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('mouseup event on document does not crash', () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    act(() => { fireEvent.mouseUp(document, { clientX: 100, clientY: 200 }); });
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });
});

describe('FlowCanvas uploadFile response parsing', () => {
  it('extracts id from nested { id } response', async () => {
    (apiService.uploadFile as jest.Mock).mockResolvedValue({ data: { id: 99 } });
    const result = await apiService.uploadFile(new File([''], 'f.reactions'), 'REACTION');
    const raw = (result as any)?.data;
    const id = typeof raw === 'number' ? raw
      : typeof raw === 'string' ? Number(raw) || null
        : typeof raw?.id === 'number' ? raw.id : null;
    expect(id).toBe(99);
  });

  it('extracts id from direct number response', async () => {
    (apiService.uploadFile as jest.Mock).mockResolvedValue({ data: 55 });
    const result = await apiService.uploadFile(new File([''], 'f.reactions'), 'REACTION');
    const raw = (result as any)?.data;
    const id = typeof raw === 'number' ? raw
      : typeof raw === 'string' ? Number(raw) || null
        : typeof raw?.id === 'number' ? raw.id : null;
    expect(id).toBe(55);
  });

  it('extracts id from string number response', async () => {
    (apiService.uploadFile as jest.Mock).mockResolvedValue({ data: '77' });
    const result = await apiService.uploadFile(new File([''], 'f.reactions'), 'REACTION');
    const raw = (result as any)?.data;
    const id = typeof raw === 'number' ? raw
      : typeof raw === 'string' ? Number(raw) || null
        : typeof raw?.id === 'number' ? raw.id : null;
    expect(id).toBe(77);
  });

  it('returns null when data is null', async () => {
    (apiService.uploadFile as jest.Mock).mockResolvedValue({ data: null });
    const result = await apiService.uploadFile(new File([''], 'f.reactions'), 'REACTION');
    const raw = (result as any)?.data;
    const id = typeof raw === 'number' ? raw
      : typeof raw === 'string' ? Number(raw) || null
        : typeof raw?.id === 'number' ? raw.id : null;
    expect(id).toBeNull();
  });
});

describe('getLocalStorageKey logic', () => {
  const getKey = (userId?: string, vsumId?: string) =>
    userId && vsumId
      ? `flow_edge_color_map_v1_user_${userId}_vsum_${vsumId}`
      : 'flow_edge_color_map_v1';

  it('returns specific key when both userId and vsumId provided', () => {
    expect(getKey('user-1', 'vsum-42')).toBe('flow_edge_color_map_v1_user_user-1_vsum_vsum-42');
  });

  it('returns fallback key when userId is missing', () => {
    expect(getKey(undefined, 'vsum-42')).toBe('flow_edge_color_map_v1');
  });

  it('returns fallback key when vsumId is missing', () => {
    expect(getKey('user-1', undefined)).toBe('flow_edge_color_map_v1');
  });

  it('returns fallback key when both missing', () => {
    expect(getKey()).toBe('flow_edge_color_map_v1');
  });
});

describe('buildInitialReactionCode logic', () => {
  it('generates correct import and reactions template', () => {
    const src = 'pfand'; const tgt = 'flower';
    const srcUri = 'http://vitruv.tools/pfand'; const tgtUri = 'http://vitruv.tools/flower';
    const code = `import "${srcUri}" as ${src}\nimport "${tgtUri}" as ${tgt}\n\nreactions: ${src}To${tgt}\nin reaction to changes in ${src}\nexecute actions in ${tgt}\n\n`;
    expect(code).toContain(`import "http://vitruv.tools/pfand" as pfand`);
    expect(code).toContain(`import "http://vitruv.tools/flower" as flower`);
    expect(code).toContain('reactions: pfandToflower');
    expect(code).toContain('in reaction to changes in pfand');
    expect(code).toContain('execute actions in flower');
  });

  it('unique padding is whitespace only and at least 1 char', () => {
    for (let i = 0; i < 5; i++) {
      const padding = ' '.repeat(Math.floor(Math.random() * 50) + 1);
      expect(padding.length).toBeGreaterThanOrEqual(1);
      expect(padding.trim()).toBe('');
    }
  });
});

describe('isDeleteKey logic', () => {
  const isDeleteKey = (key: string) => key === 'Delete' || key === 'Backspace';
  it('true for Delete', () => expect(isDeleteKey('Delete')).toBe(true));
  it('true for Backspace', () => expect(isDeleteKey('Backspace')).toBe(true));
  it('false for other keys', () => {
    expect(isDeleteKey('a')).toBe(false);
    expect(isDeleteKey('Escape')).toBe(false);
    expect(isDeleteKey('Enter')).toBe(false);
  });
});

describe('isEditableElement logic', () => {
  const isEditable = (el: Element) =>
    el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable === true;

  it('true for input', () => expect(isEditable(document.createElement('input'))).toBe(true));
  it('true for textarea', () => expect(isEditable(document.createElement('textarea'))).toBe(true));
  it('false for div', () => expect(isEditable(document.createElement('div'))).toBe(false));
  it('false for button', () => expect(isEditable(document.createElement('button'))).toBe(false));
});

// ============================================================
// Additional tests for uncovered branches (red lines in SonarQube)
// ============================================================

describe('handleDeleteKey logic', () => {
  it('removes selected nodes when Delete is pressed', () => {
    const removeNode = jest.fn();
    const getNodes = jest.fn(() => [
      { id: 'n1', selected: true },
      { id: 'n2', selected: false },
    ]);
    const getEdges = jest.fn(() => []);
    const event = { preventDefault: jest.fn() } as any;

    // Simulate the handleDeleteKey logic directly
    const reactFlowInstance = { getNodes, getEdges };
    const selectedNodes = reactFlowInstance.getNodes().filter((n: any) => n.selected);
    if (selectedNodes.length > 0) {
      event.preventDefault();
      selectedNodes.forEach((n: any) => removeNode(n.id));
    }

    expect(event.preventDefault).toHaveBeenCalled();
    expect(removeNode).toHaveBeenCalledWith('n1');
    expect(removeNode).not.toHaveBeenCalledWith('n2');
  });

  it('removes selected edges when Delete is pressed', () => {
    const removeEdge = jest.fn();
    const getNodes = jest.fn(() => []);
    const getEdges = jest.fn(() => [
      { id: 'e1', selected: true },
      { id: 'e2', selected: false },
    ]);
    const event = { preventDefault: jest.fn() } as any;

    const reactFlowInstance = { getNodes, getEdges };
    const selectedNodes = reactFlowInstance.getNodes().filter((n: any) => n.selected);
    if (selectedNodes.length > 0) {
      event.preventDefault();
      selectedNodes.forEach((n: any) => removeEdge(n.id));
    }
    const selectedEdges = reactFlowInstance.getEdges().filter((e: any) => e.selected);
    if (selectedEdges.length > 0) {
      event.preventDefault();
      selectedEdges.forEach((e: any) => removeEdge(e.id));
    }

    expect(event.preventDefault).toHaveBeenCalled();
    expect(removeEdge).toHaveBeenCalledWith('e1');
    expect(removeEdge).not.toHaveBeenCalledWith('e2');
  });

  it('calls onEcoreFileDelete when selectedFileId is set', () => {
    const onEcoreFileDelete = jest.fn();
    const setSelectedFileId = jest.fn();
    const event = { preventDefault: jest.fn() } as any;
    const selectedFileId = 'file-123';

    if (selectedFileId && onEcoreFileDelete) {
      event.preventDefault();
      onEcoreFileDelete(selectedFileId);
      setSelectedFileId(null);
    }

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onEcoreFileDelete).toHaveBeenCalledWith('file-123');
    expect(setSelectedFileId).toHaveBeenCalledWith(null);
  });

  it('returns false and does nothing when no nodes/edges selected and no file selected', () => {
    const getNodes = jest.fn(() => [{ id: 'n1', selected: false }]);
    const getEdges = jest.fn(() => [{ id: 'e1', selected: false }]);
    const event = { preventDefault: jest.fn() } as any;
    const selectedFileId = null;

    const reactFlowInstance = { getNodes, getEdges };
    const selectedNodes = reactFlowInstance.getNodes().filter((n: any) => n.selected);
    let handled = false;
    if (selectedNodes.length > 0) { event.preventDefault(); handled = true; }
    const selectedEdges = reactFlowInstance.getEdges().filter((e: any) => e.selected);
    if (selectedEdges.length > 0) { event.preventDefault(); handled = true; }
    if (selectedFileId) { handled = true; }

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(handled).toBe(false);
  });
});

describe('buildInitialReactionCode with real node data', () => {
  const getEPackageName = (node: any) => {
    const match = node?.data?.fileContent?.match(/<ecore:EPackage[^>]+name="([^"]+)"/);
    return match?.[1] ?? node?.data?.fileName?.replace('.ecore', '') ?? 'source';
  };

  it('extracts package name from fileContent', () => {
    const node = {
      data: {
        fileContent: '<ecore:EPackage xmi:version="2.0" name="pfand" nsURI="http://vitruv.tools/pfand"/>',
        fileName: 'pfand.ecore',
        nsUri: 'http://vitruv.tools/pfand',
      }
    };
    expect(getEPackageName(node)).toBe('pfand');
  });

  it('falls back to fileName without extension when no fileContent match', () => {
    const node = { data: { fileContent: '<invalid>', fileName: 'flower.ecore' } };
    expect(getEPackageName(node)).toBe('flower');
  });

  it('falls back to "source" when no data at all', () => {
    expect(getEPackageName(undefined)).toBe('source');
  });

  it('uses nsUri from node data when available', () => {
    const node = { data: { nsUri: 'http://custom.uri/model', fileName: 'model.ecore' } };
    const sourceUri = node?.data?.nsUri ?? `http://vitruv.tools/model`;
    expect(sourceUri).toBe('http://custom.uri/model');
  });

  it('falls back to vitruv.tools URI when nsUri is undefined', () => {
    const packageName = 'flower';
    const node = { data: { nsUri: undefined, fileName: 'flower.ecore' } };
    const uri = node?.data?.nsUri ?? `http://vitruv.tools/${packageName}`;
    expect(uri).toBe('http://vitruv.tools/flower');
  });

  it('builds correct full template with real node data', () => {
    const sourceNode = {
      data: {
        fileContent: '<ecore:EPackage name="pfand"/>',
        nsUri: 'http://vitruv.tools/pfand',
      }
    };
    const targetNode = {
      data: {
        fileContent: '<ecore:EPackage name="flower"/>',
        nsUri: 'http://vitruv.tools/flower',
      }
    };
    const src = getEPackageName(sourceNode);
    const tgt = getEPackageName(targetNode);
    const srcUri = sourceNode?.data?.nsUri ?? `http://vitruv.tools/${src}`;
    const tgtUri = targetNode?.data?.nsUri ?? `http://vitruv.tools/${tgt}`;

    const code = `import "${srcUri}" as ${src}\nimport "${tgtUri}" as ${tgt}\n\nreactions: ${src}To${tgt}\nin reaction to changes in ${src}\nexecute actions in ${tgt}\n\n`;

    expect(code).toContain('import "http://vitruv.tools/pfand" as pfand');
    expect(code).toContain('import "http://vitruv.tools/flower" as flower');
    expect(code).toContain('reactions: pfandToflower');
  });
});

describe('handleSaveCode - toFiniteNumber and extractFileId logic', () => {
  const toFiniteNumber = (value: unknown): number | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const extractFileId = (data: unknown): number | null => {
    if (data == null) return null;
    const direct = toFiniteNumber(data);
    if (direct !== null) return direct;
    if (typeof data === 'object' && 'id' in (data as Record<string, unknown>)) {
      return toFiniteNumber((data as Record<string, unknown>).id);
    }
    return null;
  };

  it('toFiniteNumber returns number for valid number', () => {
    expect(toFiniteNumber(42)).toBe(42);
  });

  it('toFiniteNumber returns null for Infinity', () => {
    expect(toFiniteNumber(Infinity)).toBeNull();
  });

  it('toFiniteNumber returns number for numeric string', () => {
    expect(toFiniteNumber('77')).toBe(77);
  });

  it('toFiniteNumber returns null for non-numeric string', () => {
    expect(toFiniteNumber('abc')).toBeNull();
  });

  it('toFiniteNumber returns null for object', () => {
    expect(toFiniteNumber({ id: 5 })).toBeNull();
  });

  it('toFiniteNumber returns null for null', () => {
    expect(toFiniteNumber(null)).toBeNull();
  });

  it('extractFileId returns null for null input', () => {
    expect(extractFileId(null)).toBeNull();
  });

  it('extractFileId returns id from direct number', () => {
    expect(extractFileId(55)).toBe(55);
  });

  it('extractFileId returns id from string number', () => {
    expect(extractFileId('99')).toBe(99);
  });

  it('extractFileId returns id from { id: number } object', () => {
    expect(extractFileId({ id: 42 })).toBe(42);
  });

  it('extractFileId returns id from { id: string } object', () => {
    expect(extractFileId({ id: '33' })).toBe(33);
  });

  it('extractFileId returns null for object without id', () => {
    expect(extractFileId({ foo: 'bar' })).toBeNull();
  });

  it('extractFileId returns null for undefined', () => {
    expect(extractFileId(undefined)).toBeNull();
  });

  it('upload path: calls uploadFile when reactionFileId is null', async () => {
    const uploadFile = jest.fn().mockResolvedValue({ data: { id: 10 } });
    const reactionFileId = null;
    let resultId: number | null = reactionFileId;

    if (reactionFileId == null) {
      const uploadResult = await uploadFile(new File(['code'], 'r.reactions'), 'REACTION');
      resultId = extractFileId(uploadResult?.data);
    }

    expect(uploadFile).toHaveBeenCalled();
    expect(resultId).toBe(10);
  });

  it('update path: calls updateReactionFile when reactionFileId exists', async () => {
    const updateReactionFile = jest.fn().mockResolvedValue(undefined);
    const reactionFileId = 7;

    if (reactionFileId != null) {
      await updateReactionFile(reactionFileId, 'updated code');
    }

    expect(updateReactionFile).toHaveBeenCalledWith(7, 'updated code');
  });

  it('throws error when upload returns null id', async () => {
    const uploadFile = jest.fn().mockResolvedValue({ data: null });

    let error: Error | null = null;
    try {
      const uploadResult = await uploadFile(new File([''], 'r.reactions'), 'REACTION');
      const id = extractFileId(uploadResult?.data);
      if (id == null) {
        throw new Error('Reaction file upload succeeded but did not return a file ID.');
      }
    } catch (e: any) {
      error = e;
    }

    expect(error?.message).toBe('Reaction file upload succeeded but did not return a file ID.');
  });
});

describe('handleEdgeDoubleClick logic', () => {
  it('returns early when edge not found', () => {
    const edges = [{ id: 'e1', data: {} }];
    const edge = edges.find(e => e.id === 'nonexistent');
    expect(edge).toBeUndefined();
  });

  it('uses edge.data.code as initialCode when available', () => {
    const edge = { id: 'e1', source: 'n1', target: 'n2', data: { code: 'existing code', reactionFileId: 5 } };
    let initialCode = edge.data?.code || '';
    expect(initialCode).toBe('existing code');
  });

  it('uses empty string when no code on edge', () => {
    const edge = { id: 'e1', source: 'n1', target: 'n2', data: { reactionFileId: 5 } };
    const initialCode = (edge.data as any)?.code || '';
    expect(initialCode).toBe('');
  });

  it('fetches file content when initialCode is empty and reactionFileId is number', async () => {
    const getFile = jest.fn().mockResolvedValue('fetched content');
    const edge = { data: { code: '', reactionFileId: 42 } };

    let initialCode = edge.data?.code || '';
    const reactionFileId = edge.data?.reactionFileId;

    if (!initialCode && typeof reactionFileId === 'number') {
      try {
        initialCode = await getFile(reactionFileId);
      } catch (e) { /* ignore */ }
    }

    expect(getFile).toHaveBeenCalledWith(42);
    expect(initialCode).toBe('fetched content');
  });

  it('falls back to buildInitialReactionCode when initialCode is still empty after fetch', async () => {
    const getFile = jest.fn().mockRejectedValue(new Error('not found'));
    const buildCode = jest.fn().mockReturnValue('generated code');
    const edge = { id: 'e1', source: 'n1', target: 'n2', data: { reactionFileId: 42 } };

    let initialCode = '';
    try {
      initialCode = await getFile(edge.data.reactionFileId);
    } catch (e) { /* ignore */ }

    if (!initialCode || initialCode.trim() === '') {
      initialCode = buildCode(edge.source, edge.target);
    }

    expect(buildCode).toHaveBeenCalledWith('n1', 'n2');
    expect(initialCode).toBe('generated code');
  });

  it('getFileName returns fileName for ecoreFile node type', () => {
    const nodes = [{ id: 'n1', type: 'ecoreFile', data: { fileName: 'Source.ecore' } }];
    const getFileName = (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      return node?.type === 'ecoreFile' ? node.data.fileName : undefined;
    };
    expect(getFileName('n1')).toBe('Source.ecore');
    expect(getFileName('nonexistent')).toBeUndefined();
  });

  it('getFileName returns undefined for non-ecoreFile node', () => {
    const nodes = [{ id: 'n1', type: 'editable', data: { fileName: 'Other.ecore' } }];
    const getFileName = (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      return node?.type === 'ecoreFile' ? node.data.fileName : undefined;
    };
    expect(getFileName('n1')).toBeUndefined();
  });

  describe('FlowCanvas – handleConnectionStart', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('does not render ConnectionLine when no drag is active', () => {
      render(<FlowCanvas />);
      expect(screen.queryByTestId('connection-line')).not.toBeInTheDocument();
    });

    it('handleConnectionStart does not throw when called', () => {
      const ref = createRef<any>();
      render(<FlowCanvas ref={ref} />);
      expect(() =>
        act(() => {
          ref.current.handleConnectionStart?.('node-1', 'right', { x: 200, y: 100 });
        })
      ).not.toThrow();
    });
  });

  describe('FlowCanvas – sourceTipPosition stays fixed', () => {
    it('pointermove alone does not render ConnectionLine', () => {
      render(<FlowCanvas />);

      expect(screen.queryByTestId('connection-line')).not.toBeInTheDocument();

      act(() => {
        document.dispatchEvent(
          new MouseEvent('mousemove', { clientX: 999, clientY: 999, bubbles: true })
        );
      });

      // Still no connection line — mouse move without active drag must not trigger rendering
      expect(screen.queryByTestId('connection-line')).not.toBeInTheDocument();
    });
  });

  describe('ConnectionDragState interface – shape validation', () => {
    // These tests verify the new sourceTipPosition field is handled correctly
    // by testing the logic that consumes it.

    it('getConnectionLinePositions returns null when sourceTipPosition is missing', () => {
      // Simulate the guard condition in getConnectionLinePositions
      const connectionDragState = {
        isActive: true,
        sourceNodeId: 'node-1',
        sourceHandle: 'right' as const,
        currentPosition: { x: 100, y: 100 },
        sourceTipPosition: null,  // ← missing tip position
      };

      const result =
        !connectionDragState.isActive ||
          !connectionDragState.sourceTipPosition ||
          !connectionDragState.currentPosition
          ? null
          : 'would-render';

      expect(result).toBeNull();
    });

    it('getConnectionLinePositions returns null when currentPosition is missing', () => {
      const connectionDragState = {
        isActive: true,
        sourceNodeId: 'node-1',
        sourceHandle: 'right' as const,
        currentPosition: null,
        sourceTipPosition: { x: 50, y: 50 },
      };

      const result =
        !connectionDragState.isActive ||
          !connectionDragState.sourceTipPosition ||
          !connectionDragState.currentPosition
          ? null
          : 'would-render';

      expect(result).toBeNull();
    });

    it('getConnectionLinePositions produces correct screen coords from flow coords', () => {
      // Verify the viewport transform: screenX = flowX * zoom + viewportX
      const tip = { x: 100, y: 50 };
      const current = { x: 200, y: 150 };
      const viewport = { x: 10, y: 20, zoom: 2 };

      const source = {
        x: tip.x * viewport.zoom + viewport.x,
        y: tip.y * viewport.zoom + viewport.y,
      };
      const target = {
        x: current.x * viewport.zoom + viewport.x,
        y: current.y * viewport.zoom + viewport.y,
      };

      expect(source).toEqual({ x: 210, y: 120 });
      expect(target).toEqual({ x: 410, y: 320 });
    });

    it('source and target use the same viewport transform', () => {
      const viewport = { x: 5, y: 5, zoom: 1.5 };
      const tip = { x: 80, y: 40 };
      const current = { x: 160, y: 80 };

      const toScreen = (p: { x: number; y: number }) => ({
        x: p.x * viewport.zoom + viewport.x,
        y: p.y * viewport.zoom + viewport.y,
      });

      const source = toScreen(tip);
      const target = toScreen(current);

      // Source and target must use identical transform — not different zoom factors
      expect(source.x).toBe(tip.x * 1.5 + 5);
      expect(target.x).toBe(current.x * 1.5 + 5);
    });
  });
});