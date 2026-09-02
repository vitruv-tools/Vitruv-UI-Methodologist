import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { Edge, Node } from 'reactflow';
import {
  CanvasMetricsOverlay,
  type CanvasMetricsOverlayProps,
} from '../../../components/canvas/CanvasMetricsOverlay';
import { apiService } from '../../../services/api';

jest.mock('../../../services/api', () => ({
  apiService: {
    getRuleSets: jest.fn(),
    getFile: jest.fn(),
  },
}));

beforeEach(() => {
  (apiService.getRuleSets as jest.Mock).mockResolvedValue([]);
  (apiService.getFile as jest.Mock).mockResolvedValue('');
});

const canvasNodes: Node[] = [{
  id: 'node-1',
  type: 'ecoreFile',
  position: { x: 0, y: 0 },
  data: {
    fileName: 'library.ecore',
    fileContent: `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" name="library">
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
  });

  it('shows the dashboard when visible', async () => {
    renderOverlay({ visible: true });
    expect(screen.getByTestId('canvas-metrics-overlay')).toHaveStyle({ display: 'flex' });
    expect(screen.getByText('Basic Metrics')).toBeInTheDocument();
    expect(screen.getByText('library')).toBeInTheDocument();
    await waitFor(() => {
      expect(apiService.getRuleSets).toHaveBeenCalledWith(10);
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
});
