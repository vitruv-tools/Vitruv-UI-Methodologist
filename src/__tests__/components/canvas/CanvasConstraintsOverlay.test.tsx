import React from 'react';
import { render, screen } from '@testing-library/react';
import type { Node } from 'reactflow';
import {
  CanvasConstraintsOverlay,
  type CanvasConstraintsOverlayProps,
} from '../../../components/canvas/CanvasConstraintsOverlay';
import type { ConstraintsViewProps } from '../../../components/constraints/ConstraintsView';

const mockConstraintsViewProps = jest.fn();
let mockMountSequence = 0;

jest.mock('../../../components/constraints/ConstraintsView', () => ({
  ConstraintsView: (props: ConstraintsViewProps) => {
    const mockReact = require('react') as typeof import('react');
    mockConstraintsViewProps(props);
    const [mountId] = mockReact.useState(() => {
      mockMountSequence += 1;
      return mockMountSequence;
    });
    return <div data-testid="constraints-view">Mount {mountId}</div>;
  },
}));

const canvasNodes: Node[] = [{
  id: 'node-1',
  type: 'ecoreFile',
  position: { x: 0, y: 0 },
  data: {
    fileName: 'library.ecore',
    fileContent: '<ecore />',
  },
}];

const renderOverlay = (
  overrides: Partial<CanvasConstraintsOverlayProps> = {},
) => {
  const props: CanvasConstraintsOverlayProps = {
    projectId: 10,
    visible: false,
    canvasNodes,
    onHighlightNode: jest.fn(),
    filterNodeId: null,
    ...overrides,
  };

  return {
    ...render(<CanvasConstraintsOverlay {...props} />),
    props,
  };
};

const latestConstraintsViewProps = (): ConstraintsViewProps => {
  const calls = mockConstraintsViewProps.mock.calls;
  return calls[calls.length - 1][0] as ConstraintsViewProps;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockMountSequence = 0;
});

describe('CanvasConstraintsOverlay', () => {
  it('keeps ConstraintsView mounted and uses display none while hidden', () => {
    renderOverlay();

    const constraintsView = screen.getByTestId('constraints-view');
    expect(constraintsView).toBeInTheDocument();
    expect(screen.getByTestId('canvas-constraints-overlay')).toHaveStyle({
      display: 'none',
    });
  });

  it('uses the existing flex overlay layout while visible', () => {
    renderOverlay({ visible: true });

    expect(screen.getByTestId('canvas-constraints-overlay')).toHaveStyle({
      position: 'absolute',
      top: '72px',
      left: '0px',
      right: '0px',
      bottom: '0px',
      display: 'flex',
      zIndex: '100',
      pointerEvents: 'none',
    });
  });

  it('maps project ID to vsumId and remounts only when the project changes', () => {
    const { rerender, props } = renderOverlay({
      projectId: 10,
      visible: true,
    });

    expect(latestConstraintsViewProps().vsumId).toBe('10');
    expect(screen.getByTestId('constraints-view')).toHaveTextContent('Mount 1');

    rerender(
      <CanvasConstraintsOverlay
        {...props}
        visible={false}
      />,
    );
    expect(screen.getByTestId('constraints-view')).toHaveTextContent('Mount 1');

    rerender(
      <CanvasConstraintsOverlay
        {...props}
        projectId={11}
      />,
    );
    expect(latestConstraintsViewProps().vsumId).toBe('11');
    expect(screen.getByTestId('constraints-view')).toHaveTextContent('Mount 2');
  });

  it('forwards canvas nodes, highlight callback, and filter node ID', () => {
    const onHighlightNode = jest.fn();
    renderOverlay({
      canvasNodes,
      onHighlightNode,
      filterNodeId: 'node-1',
    });

    const constraintsProps = latestConstraintsViewProps();
    expect(constraintsProps.canvasNodes).toBe(canvasNodes);
    expect(constraintsProps.filterNodeId).toBe('node-1');

    constraintsProps.onHighlightNode?.('node-1');
    expect(onHighlightNode).toHaveBeenCalledWith('node-1');
  });
});
