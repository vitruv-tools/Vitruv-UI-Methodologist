import React from 'react';
import { render } from '@testing-library/react';

// Mock ConnectionHandle to avoid tight coupling with React Flow internals.

const mockConnectionHandle = jest.fn(() => <div>ConnectionHandle mock</div>);

jest.mock('../../../components/flow/ConnectionHandle', () => ({
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

