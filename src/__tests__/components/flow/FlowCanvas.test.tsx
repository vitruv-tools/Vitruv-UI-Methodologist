import React, { createRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ReactFlow from 'reactflow';
import { FlowCanvas } from '../../../components/flow/FlowCanvas';

jest.mock('reactflow', () => {
  const actual = jest.requireActual('reactflow');
  return {
    ...actual,
    default: jest.fn(({ children }: any) => (
      <div data-testid="react-flow">{children}</div>
    )),
    MiniMap: () => <div data-testid="minimap" />,
    Background: () => <div data-testid="background" />,
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
  CodeEditorModal: () => <div>Code Editor</div>,
}));

jest.mock('../../../services/api', () => ({
  apiService: {
    getFile: jest.fn(),
    uploadFile: jest.fn(),
    updateReactionFile: jest.fn(),
  },
}));

describe.skip('FlowCanvas', () => {
  it('renders ReactFlow, minimap, and background', () => {
    const ref = createRef<any>();

    render(
      <FlowCanvas
        ref={ref}
      />,
    );

    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    expect(screen.getByTestId('minimap')).toBeInTheDocument();
    expect(screen.getByTestId('background')).toBeInTheDocument();
  });

  it('exposes imperative methods via ref', () => {
    const ref = createRef<any>();

    render(
      <FlowCanvas
        ref={ref}
      />,
    );

    expect(ref.current).toBeDefined();
    expect(typeof ref.current.handleToolClick).toBe('function');
    expect(typeof ref.current.loadDiagramData).toBe('function');
    expect(typeof ref.current.getNodes).toBe('function');
    expect(typeof ref.current.getEdges).toBe('function');
    expect(typeof ref.current.addEcoreFile).toBe('function');
  });
});

