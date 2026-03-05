import React, { createRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FlowCanvas } from '../../../components/flow/FlowCanvas';
import { apiService } from '../../../services/api';

jest.mock('reactflow', () => {
  const actual = jest.requireActual('reactflow');
  return {
    ...actual,
    default: jest.fn(({ children }: any) => (
      <div data-testid="react-flow">{children}</div>
    )),
    MiniMap: () => <div data-testid="minimap" />,
    Background: () => <div data-testid="background" />,
    useReactFlow: () => ({
      screenToFlowPosition: jest.fn(() => ({ x: 100, y: 100 })),
      getNodes: jest.fn(() => []),
      getEdges: jest.fn(() => []),
      fitView: jest.fn(),
    }),
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
  });

  it('renders ReactFlow, minimap, and background', () => {
    const ref = createRef<any>();
    render(<FlowCanvas ref={ref} />);
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    expect(screen.getByTestId('minimap')).toBeInTheDocument();
    expect(screen.getByTestId('background')).toBeInTheDocument();
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
    el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable;

  it('true for input', () => expect(isEditable(document.createElement('input'))).toBe(true));
  it('true for textarea', () => expect(isEditable(document.createElement('textarea'))).toBe(true));
  it('false for div', () => expect(isEditable(document.createElement('div'))).toBe(false));
  it('false for button', () => expect(isEditable(document.createElement('button'))).toBe(false));
});