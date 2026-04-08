import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Existing mocked test ─────────────────────────────────────────────────────

const mockEcoreFileBox = jest.fn((_props: any) => <div>EcoreFileBox mock</div>);

jest.mock('../../../components/flow/EcoreFileBox', () => ({
  __esModule: true,
  EcoreFileBox: (props: any) => mockEcoreFileBox(props),
}));

import { EcoreFileBox } from '../../../components/flow/EcoreFileBox';

describe('EcoreFileBox (mocked)', () => {
  it('renders with basic data props', () => {
    const data = {
      fileName: 'Model.ecore',
      fileContent: '<ecore/>',
    };

    render(
      <EcoreFileBox
        id="node-1"
        type="ecoreFile"
        data={data as any}
        selected
        zIndex={1}
        isConnectable
        xPos={0}
        yPos={0}
        dragging={false}
      />,
    );

    expect(mockEcoreFileBox).toHaveBeenCalled();
  });
});

// ─── Real implementation tests ────────────────────────────────────────────────

jest.mock('reactflow', () => {
  const actual = jest.requireActual('reactflow');
  return {
    ...actual,
    Handle: ({ id }: any) => <div data-testid={`rf-handle-${id}`} />,
  };
});

jest.mock('../../../components/ui/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}));

// Mock ConnectionHandle so we control what tipScreenPos gets passed up
jest.mock('../../../components/flow/ConnectionHandle', () => ({
  ConnectionHandle: ({ position, onConnectionStart, isVisible }: any) => {
    if (!isVisible) return null;
    return (
      <button
        data-testid={`handle-${position}`}
        onClick={() => onConnectionStart?.(position, { x: 10, y: 20 })}
      >
        {`Connect from ${position}`}
      </button>
    );
  },
}));

const { EcoreFileBox: RealEcoreFileBox } =
  jest.requireActual('../../../components/flow/EcoreFileBox');

const baseNodeProps = {
  id: 'node-1',
  type: 'ecoreFile',
  selected: true,
  zIndex: 1,
  isConnectable: true,
  xPos: 0,
  yPos: 0,
  dragging: false,
};

const baseData = {
  fileName: 'flower.ecore',
  fileContent: '<ecore/>',
  onExpand: jest.fn(),
  onSelect: jest.fn(),
  onDelete: jest.fn(),
  onRename: jest.fn(),
  isExpanded: false,
  isConnectionActive: false,
};

describe('EcoreFileBox (real) – handleConnectionStartWrapper', () => {
  afterEach(() => jest.clearAllMocks());

  it('forwards nodeId, handle position and tipScreenPos to onConnectionStart', () => {
    const onConnectionStart = jest.fn();

    render(
      <RealEcoreFileBox
        {...baseNodeProps}
        data={{ ...baseData, onConnectionStart }}
      />
    );

    fireEvent.click(screen.getByTestId('handle-right'));

    expect(onConnectionStart).toHaveBeenCalledTimes(1);
    const [nodeId, handle, tip] = onConnectionStart.mock.calls[0];
    expect(nodeId).toBe('node-1');
    expect(handle).toBe('right');
    expect(tip).toEqual({ x: 10, y: 20 });
  });

  it('forwards the correct nodeId for different node ids', () => {
    const onConnectionStart = jest.fn();

    render(
      <RealEcoreFileBox
        {...baseNodeProps}
        id="node-xyz"
        data={{ ...baseData, onConnectionStart }}
      />
    );

    fireEvent.click(screen.getByTestId('handle-top'));

    expect(onConnectionStart.mock.calls[0][0]).toBe('node-xyz');
  });

  it('does not throw when onConnectionStart is not provided', () => {
    render(
      <RealEcoreFileBox
        {...baseNodeProps}
        data={{ ...baseData }}
      />
    );

    expect(() => fireEvent.click(screen.getByTestId('handle-left'))).not.toThrow();
  });

  it('calls onConnectionStart for all four handle positions', () => {
    const onConnectionStart = jest.fn();

    render(
      <RealEcoreFileBox
        {...baseNodeProps}
        data={{ ...baseData, onConnectionStart }}
      />
    );

    (['top', 'bottom', 'left', 'right'] as const).forEach(pos => {
      fireEvent.click(screen.getByTestId(`handle-${pos}`));
    });

    expect(onConnectionStart).toHaveBeenCalledTimes(4);
    const handles = onConnectionStart.mock.calls.map((c: any[]) => c[1]);
    expect(handles).toEqual(['top', 'bottom', 'left', 'right']);
  });
});