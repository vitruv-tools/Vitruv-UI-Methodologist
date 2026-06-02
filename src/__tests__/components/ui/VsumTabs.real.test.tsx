import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { VsumTabs } from '../../../components/ui/VsumTabs';

jest.mock('../../../services/api', () => ({
  apiService: {
    getVsumDetails: jest.fn(),
    getVsumBuildStatus: jest.fn(),
    downloadVsumArtifact: jest.fn(),
    updateVsumSyncChanges: jest.fn(),
  },
}));

jest.mock('../../../components/ui/ConfirmDialog', () => ({
  ConfirmDialog: ({ isOpen, onConfirm, onCancel, message }: any) =>
    isOpen ? (
      <div data-testid="confirm-dialog">
        <span>{message}</span>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

const { apiService } = require('../../../services/api');

const defaultProps = {
  openTabs: [{ instanceId: 'inst-1', id: 1 }],
  activeInstanceId: 'inst-1',
  onActivate: jest.fn(),
  onClose: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  apiService.getVsumDetails.mockResolvedValue({ data: { id: 1, name: 'My VSUM', metaModelIds: [], metaModelRelationRequests: [] } });
});

describe('VsumTabs real component', () => {
  it('returns null when openTabs is empty', () => {
    const { container } = render(
      <VsumTabs
        openTabs={[]}
        activeInstanceId={null}
        onActivate={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a role="tab" element for each open tab', async () => {
    await act(async () => {
      render(<VsumTabs {...defaultProps} />);
    });
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(1);
  });

  it('shows VSUM #id when details not yet loaded', async () => {
    apiService.getVsumDetails.mockReturnValue(new Promise(() => {})); // never resolves
    await act(async () => {
      render(<VsumTabs {...defaultProps} />);
    });
    expect(screen.getByText('VSUM #1')).toBeInTheDocument();
  });

  it('clicking a tab calls onActivate with instanceId', async () => {
    const onActivate = jest.fn();
    await act(async () => {
      render(<VsumTabs {...defaultProps} onActivate={onActivate} />);
    });
    const tab = screen.getByRole('tab');
    fireEvent.click(tab);
    expect(onActivate).toHaveBeenCalledWith('inst-1');
  });

  it('pressing Enter on a tab calls onActivate', async () => {
    const onActivate = jest.fn();
    await act(async () => {
      render(<VsumTabs {...defaultProps} onActivate={onActivate} />);
    });
    const tab = screen.getByRole('tab');
    fireEvent.keyDown(tab, { key: 'Enter' });
    expect(onActivate).toHaveBeenCalledWith('inst-1');
  });

  it('close button calls onClose when clicked (no dirty state)', async () => {
    const onClose = jest.fn();
    await act(async () => {
      render(<VsumTabs {...defaultProps} onClose={onClose} />);
    });
    // Wait for details to load so name is set
    await waitFor(() => {
      expect(apiService.getVsumDetails).toHaveBeenCalled();
    });
    const closeBtn = screen.getByLabelText(/Close/i);
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledWith('inst-1');
  });

  it('renders "Check build" button when activeInstanceId is set', async () => {
    await act(async () => {
      render(<VsumTabs {...defaultProps} />);
    });
    expect(screen.getByText('Check build')).toBeInTheDocument();
  });

  it('renders "Download ZIP" button when activeInstanceId is set', async () => {
    await act(async () => {
      render(<VsumTabs {...defaultProps} />);
    });
    expect(screen.getByText('Download ZIP')).toBeInTheDocument();
  });

  it('showAddButton=true renders an "Add meta models" button', async () => {
    const onAddMetaModels = jest.fn();
    await act(async () => {
      render(
        <VsumTabs
          {...defaultProps}
          showAddButton
          onAddMetaModels={onAddMetaModels}
        />
      );
    });
    expect(screen.getByText('+ ADD META MODELS')).toBeInTheDocument();
  });

  it('error alert shows when getVsumDetails rejects', async () => {
    apiService.getVsumDetails.mockRejectedValue(new Error('Network error'));
    await act(async () => {
      render(<VsumTabs {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('after getVsumDetails resolves, tab shows the VSUM name', async () => {
    apiService.getVsumDetails.mockResolvedValue({
      data: { id: 1, name: 'Loaded VSUM Name', metaModelIds: [], metaModelRelationRequests: [] },
    });
    await act(async () => {
      render(<VsumTabs {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText('Loaded VSUM Name')).toBeInTheDocument();
    });
  });

  it('renders two tabs when two openTabs provided', async () => {
    await act(async () => {
      render(
        <VsumTabs
          openTabs={[
            { instanceId: 'inst-1', id: 1 },
            { instanceId: 'inst-2', id: 2 },
          ]}
          activeInstanceId="inst-1"
          onActivate={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
  });
});
