import type { Mock } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import type { Edge, Node } from 'reactflow';
import {
  CanvasMetricsOverlay,
  type CanvasMetricsOverlayProps,
} from '../../../components/canvas/CanvasMetricsOverlay';
import { apiService } from '../../../services/api';
import { downloadBlobAsFile } from '../../../utils/downloadFile';

vi.mock('../../../services/api', () => ({
  apiService: {
    getRuleSets: vi.fn(),
    getFile: vi.fn(),
  },
}));

vi.mock('../../../utils/downloadFile', () => ({
  downloadBlobAsFile: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  (downloadBlobAsFile as Mock).mockClear();
  (apiService.getRuleSets as Mock).mockResolvedValue([{
    id: 1,
    name: 'library-rules',
    color: '#049484',
    description: '',
    oclContent: 'context library::Book inv HasTitle:\n  true',
  }]);
  (apiService.getFile as Mock).mockResolvedValue('');
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
    expect(screen.getByText('V-SUM size')).toBeInTheDocument();
    expect(screen.getAllByText('Operations')).toHaveLength(
      within(screen.getByTestId('class-detail-scroll')).getAllByText('Operations').length,
    );
    expect(screen.queryByText('Children max')).not.toBeInTheDocument();
    expect(screen.queryByText('Children max / avg')).not.toBeInTheDocument();
    expect(screen.queryByText('Inheritance max / avg')).not.toBeInTheDocument();
    expect(screen.queryByText('Model elements')).not.toBeInTheDocument();
    expect(screen.queryByText('Views (instances)')).not.toBeInTheDocument();
    expect(screen.queryByText('Derived ratios')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('metrics-tab-derived'));
    expect(screen.getByText('V-SUM size')).toBeInTheDocument();
    expect(screen.getByText('Derived ratios')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('metrics-tab-coverage'));
    expect(screen.getByText('Derived ratios')).toBeInTheDocument();
    await waitFor(() => {
      expect(apiService.getRuleSets).toHaveBeenCalledWith(10);
      expect(screen.getByText(/HasTitle \(Book\)/)).toBeInTheDocument();
    });
  });

  it('loads reaction file text from the existing file API when the edge has no code', async () => {
    (apiService.getFile as Mock).mockResolvedValue(`
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
    const onClose = vi.fn();
    renderOverlay({ visible: true, onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Close metrics' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(apiService.getRuleSets).toHaveBeenCalled();
    });
  });

  it('does not close when clicking outside the panel', async () => {
    const onClose = vi.fn();
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
    expect(screen.getByText('V-SUM size')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('metrics-tab-size'));
    expect(screen.queryByText('V-SUM size')).not.toBeInTheDocument();
    expect(screen.getByText('Derived ratios')).toBeInTheDocument();
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

  it('keeps class overview columns readable and scrolls them sideways', async () => {
    const ecore = (pkg: string, className: string) => `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" name="${pkg}">
  <eClassifiers xsi:type="ecore:EClass" name="${className}">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="title"/>
  </eClassifiers>
</ecore:EPackage>`;
    renderOverlay({
      visible: true,
      canvasNodes: [
        {
          id: 'node-1',
          type: 'ecoreFile',
          position: { x: 0, y: 0 },
          data: { fileName: 'assembly.ecore', fileContent: ecore('assembly', 'VeryLongClassifierName') },
        },
        {
          id: 'node-2',
          type: 'ecoreFile',
          position: { x: 0, y: 0 },
          data: { fileName: 'cad.ecore', fileContent: ecore('cad', 'AnotherLongClassifierName') },
        },
      ],
    });

    const scroller = screen.getByTestId('class-detail-scroll');
    const detail = within(scroller);
    expect(scroller).toHaveStyle({ overflowX: 'auto', overflowY: 'hidden' });
    expect(scroller.firstElementChild).toHaveStyle({ display: 'flex', flexWrap: 'nowrap' });
    expect(detail.getByText('assembly')).toBeInTheDocument();
    expect(detail.getByText('cad')).toBeInTheDocument();

    const classCell = detail.getByText('VeryLongClassifierName').closest('td');
    expect(classCell).toHaveStyle({ whiteSpace: 'nowrap', wordBreak: 'normal' });
    expect(detail.getAllByText('Attributes')[0].closest('th')).toHaveStyle({ whiteSpace: 'nowrap' });
    expect(detail.getAllByText('Containment height')[0].closest('th')).toHaveStyle({ whiteSpace: 'nowrap' });
    expect(detail.getAllByText('Operations')).toHaveLength(2);
    expect(detail.getAllByText('Subclasses (NOC)')).toHaveLength(2);
    expect(detail.getAllByText('Inheritance depth (DIT)')).toHaveLength(2);
    expect(screen.getAllByText('Attributes')).toHaveLength(detail.getAllByText('Attributes').length);
    expect(screen.getAllByText('Containment height')).toHaveLength(detail.getAllByText('Containment height').length);

    await waitFor(() => {
      expect(apiService.getRuleSets).toHaveBeenCalled();
    });
  });

  it('explains each metric through an accessible info button', async () => {
    renderOverlay({ visible: true });
    const [info] = screen.getAllByTestId('metric-info-classes');
    expect(info).toHaveAccessibleName('About Classes');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.mouseEnter(info);
    const tooltip = screen.getByRole('tooltip');
    expect(info).toHaveAttribute('aria-describedby', tooltip.id);
    expect(tooltip).toHaveTextContent('What it is');
    expect(tooltip).toHaveTextContent('What it measures');
    expect(tooltip).toHaveTextContent('How it is calculated');
    expect(tooltip).toHaveTextContent('How to read it');
    fireEvent.mouseLeave(info);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.focus(info);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    ['metrics-tab-reactions', 'metrics-tab-coverage', 'metrics-tab-hotspots', 'metrics-tab-derived'].forEach(tab => {
      fireEvent.click(screen.getByTestId(tab));
    });
    await waitFor(() => {
      ['reactionCoverage', 'detectOnly', 'unprotectedReferences', 'hotspotScore', 'modularizationRatio', 'inheritanceDepth']
        .forEach(id => expect(screen.getAllByTestId(`metric-info-${id}`).length).toBeGreaterThan(0));
    });
  });

  describe('KPI presentation', () => {
    const ecore = (pkg: string, body: string) => `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" name="${pkg}" nsURI="http://${pkg}">${body}</ecore:EPackage>`;
    const node = (id: string, fileName: string, fileContent: string): Node => ({
      id, type: 'ecoreFile', position: { x: 0, y: 0 }, data: { fileName, fileContent },
    });
    // Owner has 1 containment and 2 associations to Part.
    const owner = node('n1', 'owner.ecore', ecore('owner', `
      <eClassifiers xsi:type="ecore:EClass" name="Owner">
        <eStructuralFeatures xsi:type="ecore:EReference" name="parts" eType="#//Part" containment="true"/>
        <eStructuralFeatures xsi:type="ecore:EReference" name="friend" eType="#//Part"/>
        <eStructuralFeatures xsi:type="ecore:EReference" name="buddy" eType="#//Part"/>
      </eClassifiers>
      <eClassifiers xsi:type="ecore:EClass" name="Part"/>`));
    const other = node('n2', 'other.ecore', ecore('other', '<eClassifiers xsi:type="ecore:EClass" name="Thing"/>'));
    // 7 non-empty, non-comment lines; 2 reactions of 1 body line each.
    const code = [
      'import "http://owner" as owner',
      'reaction R1 {',
      '  after element owner::Owner created',
      '}',
      'reaction R2 {',
      '  after element owner::Part created',
      '}',
    ].join('\n');
    const edge: Edge = { id: 'e1', source: 'n1', target: 'n2', type: 'reactions', data: { code } };

    const showAll = async () => {
      renderOverlay({ visible: true, canvasNodes: [owner, other], canvasEdges: [edge] });
      ['reactions', 'coverage', 'derived'].forEach(tab => fireEvent.click(screen.getByTestId(`metrics-tab-${tab}`)));
      await waitFor(() => expect(apiService.getRuleSets).toHaveBeenCalled());
    };
    const cardOf = (sub: string) => screen.getByText(sub).parentElement as HTMLElement;

    it('shows associations and containments as separate KPIs that add up to the references', async () => {
      await showAll();
      expect(within(cardOf('owning links (tree)')).getByText('1')).toBeInTheDocument();
      expect(within(cardOf('plain links')).getByText('2')).toBeInTheDocument();
      expect(screen.getByText('1 containments + 2 associations')).toBeInTheDocument();
      expect(within(cardOf('1 containments + 2 associations')).getByText('3')).toBeInTheDocument();
      const header = screen.getAllByRole('columnheader').map(h => h.textContent ?? '');
      expect(header.some(t => t.startsWith('Containments'))).toBe(true);
      expect(header.some(t => t.startsWith('Associations'))).toBe(true);
      expect(header.some(t => t.includes('containment / non-containment'))).toBe(false);
    });

    it('uses one reaction complexity ratio for the Lines of code note and the derived table', async () => {
      await showAll();
      expect(within(cardOf('3.50 per reaction')).getByText('7')).toBeInTheDocument();
      const ratioRow = screen.getAllByRole('row').find(r => r.textContent?.startsWith('Reaction complexity ratio'));
      expect(ratioRow).toHaveTextContent('3.50');
      expect(ratioRow).toHaveTextContent('lines of code of all reactions files (7) / reactions (2)');
    });

    it('keeps the class coverage and the coextensions-per-metamodel-pair metrics apart', async () => {
      await showAll();
      expect(screen.getAllByText('Reaction coverage').length).toBeGreaterThan(0);
      const pairRow = screen.getAllByRole('row').find(r => r.textContent?.startsWith('Coextensions per metamodel pair'));
      expect(pairRow).toBeDefined();
      expect(pairRow).toHaveTextContent('metamodel pairs (1 pairs)');
      expect(screen.queryByText(/view-type pair/i)).not.toBeInTheDocument();
      // 2 of the 3 concrete classes (Owner, Part) are referenced.
      expect(within(cardOf('2 of 3 concrete classes')).getByText('67%')).toBeInTheDocument();
    });
  });
});
