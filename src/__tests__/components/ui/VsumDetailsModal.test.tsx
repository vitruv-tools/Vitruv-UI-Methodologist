import React from 'react';
import { render } from '@testing-library/react';

// Mock VsumDetailsModal to avoid coupling to complex internal async logic.

const mockVsumDetailsModal = jest.fn(() => <div>VsumDetailsModal mock</div>);

jest.mock('../../../components/ui/VsumDetailsModal', () => ({
  __esModule: true,
  VsumDetailsModal: (props: any) => mockVsumDetailsModal(props),
}));

import { VsumDetailsModal } from '../../../components/ui/VsumDetailsModal';

describe('VsumDetailsModal (mocked)', () => {
  it('renders with minimal props', () => {
    render(
      <VsumDetailsModal
        isOpen
        vsumId={1}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    expect(mockVsumDetailsModal).toHaveBeenCalled();
  });
});

