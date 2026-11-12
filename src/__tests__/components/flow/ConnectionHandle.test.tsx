import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Existing mocked test ─────────────────────────────────────────────────────

const mockConnectionHandle = vi.fn((_props: any) => <div>ConnectionHandle mock</div>);

vi.mock('../../../components/flow/ConnectionHandle', () => ({
  __esModule: true,
  ConnectionHandle: (props: any) => mockConnectionHandle(props),
}));

import { ConnectionHandle } from '../../../components/flow/ConnectionHandle';

describe('ConnectionHandle (mocked)', () => {
  it('renders with minimal props', () => {
    render(
      <ConnectionHandle
        position="right"
        isVisible
      />,
    );

    expect(mockConnectionHandle).toHaveBeenCalled();
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

// Import real implementation directly — bypasses the mock above
const { ConnectionHandle: RealConnectionHandle } =
  (await vi.importActual<any>('../../../components/flow/ConnectionHandle'));

const MOCK_RECT = {
  left: 100, right: 124,
  top: 200, bottom: 224,
  width: 24, height: 24,
} as DOMRect;

describe('ConnectionHandle (real) – tipScreenPos via getBoundingClientRect', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(MOCK_RECT);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['top', { x: 112, y: 200 }],
    ['bottom', { x: 112, y: 224 }],
    ['left', { x: 100, y: 212 }],
    ['right', { x: 124, y: 212 }],
  ] as const)(
    'fires onConnectionStart with correct tipScreenPos for position=%s',
    (position, expectedTip) => {
      const onConnectionStart = vi.fn();

      render(
        <RealConnectionHandle
          position={position}
          isVisible
          onConnectionStart={onConnectionStart}
        />
      );

      fireEvent.pointerDown(
        screen.getByRole('button', { name: new RegExp(`Connect from ${position}`) })
      );

      expect(onConnectionStart).toHaveBeenCalledTimes(1);
      expect(onConnectionStart).toHaveBeenCalledWith(position, expectedTip);
    }
  );

  it('does not throw when onConnectionStart is not provided', () => {
    render(<RealConnectionHandle position="right" isVisible />);
    expect(() =>
      fireEvent.pointerDown(screen.getByRole('button', { name: /Connect from right/ }))
    ).not.toThrow();
  });

  it('does not render the arrow button when isVisible=false', () => {
    render(
      <RealConnectionHandle position="top" isVisible={false} onConnectionStart={vi.fn()} />
    );
    expect(screen.queryByRole('button', { name: /Connect from top/ })).toBeNull();
  });

  it('shows handle count suffix in title when totalHandles > 1', () => {
    render(
      <RealConnectionHandle
        position="top"
        isVisible
        offsetIndex={1}
        totalHandles={3}
        onConnectionStart={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /2\/3/ })).toBeInTheDocument();
  });
});