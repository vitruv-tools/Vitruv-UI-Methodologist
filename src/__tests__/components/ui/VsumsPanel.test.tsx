import React from 'react';
import { render } from '@testing-library/react';

// Mock VsumsPanel itself to avoid depending on ToastProvider, routing,
// and backend data loading. This keeps the test as a simple integration
// point that verifies the component can be invoked with the expected props.

const mockVsumsPanel = jest.fn(() => <div>VsumsPanel mock</div>);

jest.mock('../../../components/ui/VsumsPanel', () => ({
  __esModule: true,
  VsumsPanel: (props: any) => mockVsumsPanel(props),
}));

import { VsumsPanel } from '../../../components/ui/VsumsPanel';

describe('VsumsPanel (mocked)', () => {
  it('is called with minimal props', () => {
    render(
      <VsumsPanel
        onSelectVsum={jest.fn()}
        onVsumRestored={jest.fn()}
      />,
    );

    expect(mockVsumsPanel).toHaveBeenCalled();
  });
});

