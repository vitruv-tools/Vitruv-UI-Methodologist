import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Existing mocked test ─────────────────────────────────────────────────────

const mockEcoreFileBox = vi.fn((_props: any) => <div>EcoreFileBox mock</div>);

vi.mock('../../../components/flow/EcoreFileBox', () => ({
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

vi.mock('reactflow', async () => {
  const actual = (await vi.importActual<any>('reactflow'));
  return {
    ...actual,
    Handle: ({ id }: any) => <div data-testid={`rf-handle-${id}`} />,
  };
});

vi.mock('../../../components/ui/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}));

// Mock ConnectionHandle so we control what tipScreenPos gets passed up
vi.mock('../../../components/flow/ConnectionHandle', () => ({
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
  (await vi.importActual<any>('../../../components/flow/EcoreFileBox'));

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
  onExpand: vi.fn(),
  onSelect: vi.fn(),
  onDelete: vi.fn(),
  onRename: vi.fn(),
  isExpanded: false,
  isConnectionActive: false,
};

describe('EcoreFileBox (real) – handleConnectionStartWrapper', () => {
  afterEach(() => vi.clearAllMocks());

  it('forwards nodeId, handle position and tipScreenPos to onConnectionStart', () => {
    const onConnectionStart = vi.fn();

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
    const onConnectionStart = vi.fn();

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
    const onConnectionStart = vi.fn();

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

describe('EcoreFileBox (real) – rename', () => {
  afterEach(() => vi.clearAllMocks());

  const renderBox = (overrides: Record<string, unknown> = {}) => {
    const onRename = vi.fn();
    const onSelect = vi.fn();
    const onExpand = vi.fn();
    render(
      <RealEcoreFileBox
        {...baseNodeProps}
        data={{ ...baseData, onRename, onSelect, onExpand, ...overrides }}
      />,
    );
    return { onRename, onSelect, onExpand };
  };

  const startRename = () => {
    fireEvent.contextMenu(screen.getByRole('button', { name: /flower metamodel/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    return screen.getByLabelText('Rename metamodel');
  };

  it('lets Space type into the name and saves on Enter', () => {
    const { onRename, onSelect, onExpand } = renderBox();
    const input = startRename();

    fireEvent.change(input, { target: { value: 'Flower Shop' } });
    fireEvent.keyDown(input, { key: ' ' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).not.toHaveBeenCalled();
    expect(onExpand).not.toHaveBeenCalled();
    expect(onRename).toHaveBeenCalledWith('node-1', 'Flower Shop.ecore');
    expect(screen.queryByLabelText('Rename metamodel')).not.toBeInTheDocument();
  });

  it('saves the typed name when the input blurs', () => {
    const { onRename } = renderBox();
    const input = startRename();

    fireEvent.change(input, { target: { value: 'Garden' } });
    fireEvent.blur(input);

    expect(onRename).toHaveBeenCalledWith('node-1', 'Garden.ecore');
  });

  it('cancels without saving on Escape', () => {
    const { onRename } = renderBox();
    const input = startRename();

    fireEvent.change(input, { target: { value: 'Should Not Save' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Rename metamodel')).not.toBeInTheDocument();
  });
});