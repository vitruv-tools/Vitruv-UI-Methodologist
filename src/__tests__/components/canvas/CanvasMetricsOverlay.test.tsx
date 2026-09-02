import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { Edge, Node } from 'reactflow';
import {
  CanvasMetricsOverlay,
  type CanvasMetricsOverlayProps,
} from '../../../components/canvas/CanvasMetricsOverlay';
import { apiService } from '../../../services/api';
import { downloadBlobAsFile } from '../../../utils/downloadFile';

jest.mock('../../../services/api', () => ({
  apiService: {
    getRuleSets: jest.fn(),
    getFile: jest.fn(),
  },
}));

jest.mock('../../../utils/downloadFile', () => ({
  downloadBlobAsFile: jest.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  (downloadBlobAsFile as jest.Mock).mockClear();
  (apiService.getRuleSets as jest.Mock).mockResolvedValue([{
    id: 1,
    name: 'library-rules',
    color: '#049484',
    description: '',
    oclContent: 'context library::Book inv HasTitle:\n  true',
  }]);
  (apiService.getFile as jest.Mock).mockResolvedValue('');
});

const canvasNodes: Node[] = [{
  id: 'node-1',
  type: 'ecoreFile',
  position: { x: 0, y: 0 },
  data: {
    fileName: 'library.ecore',
    fileContent: `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" name="library">
  <eClassifiers xsi:type="ecore:EClass" name="Book">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="title"/>
  </eClassifiers>
</ecore:EPackage>`,
  },
}];

const canvasEdges: Edge[] = [];

const renderOverlay = (overrides: Partial<CanvasMetricsOverlayProps> = {}) => {
  const props: CanvasMetricsOverlayProps = {
    projectId: 10,
    projectName: 'Library VSUM',
    visible: false,
    canvasNodes,
    canvasEdges,
    viewTypes: [],
    ...overrides,
  };
  return render(<CanvasMetricsOverlay {...props} />);
};

describe('CanvasMetricsOverlay', () => {
  it('keeps the metrics view mounted and hidden while inactive', () => {
    renderOverlay();
    expect(screen.getByTestId('methodologist-metrics-view')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-metrics-overlay')).toHaveStyle({ display: 'none' });
    expect(apiService.getRuleSets).not.toHaveBeenCalled();
  });

  it('shows the dashboard when visible and loads OCL from existing rule-sets API', async () => {
    renderOverlay({ visible: true });
    expect(screen.getByTestId('canvas-metrics-overlay')).toHaveStyle({ display: 'flex' });
    expect(screen.getByText('Basic Metrics')).toBeInTheDocument();
    expect(screen.getAllByText('library').length).toBeGreaterThan(0);
    expect(screen.getByText('Methodology size')).toBeInTheDocument();
    expect(screen.queryByText('Derived / composite')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('metrics-tab-derived'));
    expect(screen.getByText('Methodology size')).toBeInTheDocument();
    expect(screen.getByText('Derived / composite')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('metrics-tab-coverage'));
    expect(screen.getByText('Derived / composite')).toBeInTheDocument();
    await waitFor(() => {
      expect(apiService.getRuleSets).toHaveBeenCalledWith(10);
      expect(screen.getByText(/HasTitle \(Book\)/)).toBeInTheDocument();
    });
  });

  it('loads reaction file text from the existing file API when the edge has no code', async () => {
    (apiService.getFile as jest.Mock).mockResolvedValue(`
reaction SyncBook {
  after element of type library::Book created
}
`);
    renderOverlay({
      visible: true,
      canvasEdges: [{
        id: 'e1',
        source: 'node-1',
        target: 'node-1',
        type: 'reactions',
        data: { reactionFileId: 44 },
      }],
    });
    fireEvent.click(screen.getByTestId('metrics-tab-reactions'));
    await waitFor(() => {
      expect(apiService.getFile).toHaveBeenCalledWith(44);
      expect(screen.getByText(/SyncBook/)).toBeInTheDocument();
    });
  });

  it('calls onClose from the close button', async () => {
    const onClose = jest.fn();
    renderOverlay({ visible: true, onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Close metrics' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(apiService.getRuleSets).toHaveBeenCalled();
    });
  });

  it('does not close when clicking outside the panel', async () => {
    const onClose = jest.fn();
    renderOverlay({ visible: true, onClose });
    fireEvent.click(screen.getByTestId('canvas-metrics-overlay'));
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(apiService.getRuleSets).toHaveBeenCalled();
    });
  });

  it('keeps the panel height filled so category changes do not resize the box', async () => {
    renderOverlay({ visible: true });
    expect(screen.getByTestId('methodologist-metrics-view')).toHaveStyle({ height: '100%' });
    await waitFor(() => {
      expect(apiService.getRuleSets).toHaveBeenCalled();
    });
  });

  it('lets the user unmark a category while keeping the others visible', async () => {
    renderOverlay({ visible: true });
    fireEvent.click(screen.getByTestId('metrics-tab-derived'));
    expect(screen.getByText('Methodology size')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('metrics-tab-size'));
    expect(screen.queryByText('Methodology size')).not.toBeInTheDocument();
    expect(screen.getByText('Derived / composite')).toBeInTheDocument();
    await waitFor(() => {
      expect(apiService.getRuleSets).toHaveBeenCalled();
    });
  });

  it('lets the user mark, unmark, then download, and All selects everything', async () => {
    renderOverlay({ visible: true, projectName: 'Library VSUM' });
    fireEvent.click(screen.getByTestId('metrics-download'));
    expect(screen.getByTestId('metrics-mark-size')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('metrics-download-selected')).toHaveTextContent('Selected — Size');

    fireEvent.click(screen.getByTestId('metrics-mark-size'));
    expect(screen.getByTestId('metrics-mark-size')).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByTestId('metrics-mark-size'));
    fireEvent.click(screen.getByTestId('metrics-mark-reactions'));
    expect(screen.getByTestId('metrics-mark-size')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('metrics-mark-reactions')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('metrics-download-selected')).toHaveTextContent(/Size/);
    expect(screen.getByTestId('metrics-download-selected')).toHaveTextContent(/Reactions/);
    expect(downloadBlobAsFile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('metrics-download-marked'));
    expect(downloadBlobAsFile).toHaveBeenCalledWith(
      expect.any(Blob),
      'Library VSUM metrics.zip',
    );
    expect(screen.queryByTestId('metrics-download-menu')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('metrics-download'));
    fireEvent.click(screen.getByTestId('metrics-download-all'));
    expect(downloadBlobAsFile).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByTestId('metrics-download'));
    ['size', 'reactions', 'coverage', 'hotspots', 'derived'].forEach(id => {
      expect(screen.getByTestId(`metrics-mark-${id}`)).toHaveAttribute('aria-checked', 'true');
    });
    await waitFor(() => {
      expect(apiService.getRuleSets).toHaveBeenCalled();
    });
  });
});
