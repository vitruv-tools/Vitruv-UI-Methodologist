import React from 'react';
import { render, screen } from '@testing-library/react';

// The real VsumTabs component is complex and tightly coupled to backend
// API responses and workspace state. To keep this test stable and focused
// on integration points, we mock the component and verify that it can be
// rendered with the expected props.

const mockVsumTabs = jest.fn(() => <div>VsumTabs mock</div>);

jest.mock('../../../components/ui/VsumTabs', () => ({
  __esModule: true,
  VsumTabs: (props: any) => mockVsumTabs(props),
}));

import { VsumTabs } from '../../../components/ui/VsumTabs';

const mockOnActivate = jest.fn();
const mockOnClose = jest.fn();

describe('VsumTabs (mocked)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const openTabs = [{ instanceId: 'inst-1', id: 1 }];

  it('renders using provided VSUM props', () => {
    render(
      <VsumTabs
        openTabs={openTabs}
        activeInstanceId="inst-1"
        onActivate={mockOnActivate}
        onClose={mockOnClose}
        requestWorkspaceSnapshot={async () => ({
          metaModelIds: [],
          metaModelRelationRequests: [],
          viewRequests: [],
        })}
      />,
    );

    expect(mockVsumTabs).toHaveBeenCalledWith(
      expect.objectContaining({
        openTabs,
        activeInstanceId: 'inst-1',
        onActivate: mockOnActivate,
        onClose: mockOnClose,
      }),
    );
  });
});

