import { computeMethodologistMetrics } from '../../utils/methodologistMetrics';
import {
  buildMetricsCsv,
  buildMetricsCsvFiles,
  derivedMetricRows,
  formatSelectedLabel,
  metricsResultFileName,
  orderedMetricsCategories,
} from '../../utils/metricsReport';
import { METRIC_DEFINITIONS } from '../../utils/metricDefinitions';

const metrics = computeMethodologistMetrics({
  metamodels: [{
    id: 'n1',
    fileName: 'library.ecore',
    fileContent: `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" name="library">
  <eClassifiers xsi:type="ecore:EClass" name="Book">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="title"/>
  </eClassifiers>
</ecore:EPackage>`,
  }],
  reactions: [],
  viewTypes: [],
  oclContent: 'context library::Book inv HasTitle:\n  true',
});

describe('metricsResultFileName', () => {
  it('uses the project name and a zip suffix', () => {
    expect(metricsResultFileName('Library VSUM')).toBe('Library VSUM metrics.zip');
  });

  it('falls back to Project and strips illegal filename characters', () => {
    expect(metricsResultFileName('')).toBe('Project metrics.zip');
    expect(metricsResultFileName('A/B:C')).toBe('A B C metrics.zip');
  });
});

describe('buildMetricsCsv', () => {
  it('writes one table that includes only the marked categories', () => {
    const csv = buildMetricsCsv(metrics, ['coverage'], 'Library VSUM');
    expect(csv).toContain('Project,Included,Category,Section,Name,Value,Details');
    expect(csv).toContain('Library VSUM');
    expect(csv).toContain('Coverage');
    expect(csv).toContain('HasTitle (Book)');
    expect(csv).not.toContain(',Size,');
    expect(csv).not.toContain('Attributes per class');
  });

  it('includes every category in the same csv when downloading all', () => {
    const csv = buildMetricsCsv(
      metrics,
      ['size', 'reactions', 'coverage', 'hotspots', 'derived'],
      'Library VSUM',
    );
    expect(csv).toContain(',Size,');
    expect(csv).toContain(',Reactions,');
    expect(csv).toContain(',Coverage,');
    expect(csv).toContain(',Hotspots,');
    expect(csv).toContain(',Derived,');
    expect(csv).toContain('Attributes per class');
    expect(csv).not.toContain(',Overview,Attributes,');
    expect(csv).not.toContain(',Overview,Operations,');
    expect(csv).not.toContain(',Overview,Children max,');
    expect(csv).not.toContain(',Overview,Containment height,');
    expect(csv).not.toContain('Model elements');
    expect(csv).not.toContain('Views (instances)');
    expect(csv).not.toContain('Correspondence instances');
    expect(csv).not.toContain('View element density');
  });

  it('keeps a stable category order regardless of selection order', () => {
    expect(orderedMetricsCategories(['derived', 'size'])).toEqual(['size', 'derived']);
    expect(formatSelectedLabel(['derived', 'size'])).toBe('Selected — Size, Derived');
  });
});

describe('buildMetricsCsvFiles', () => {
  it('puts each marked category in its own folder with all.csv and the separate tables', () => {
    const files = buildMetricsCsvFiles(metrics, ['size', 'coverage'], 'Library VSUM');
    expect(files.map(file => file.name)).toEqual([
      'size/all.csv',
      'size/size-overview.csv',
      'size/size-metamodels.csv',
      'size/size-classes.csv',
      'coverage/all.csv',
      'coverage/coverage-overview.csv',
      'coverage/coverage-links.csv',
      'coverage/coverage-gap.csv',
    ]);
    expect(files[0].csv).toContain(',Size,');
    expect(files[0].csv).not.toContain(',Coverage,');
    expect(files.find(file => file.name === 'coverage/all.csv')?.csv).toContain('HasTitle (Book)');
    expect(files.find(file => file.name === 'size/size-classes.csv')?.csv).toContain('Book');
    expect(files.find(file => file.name === 'size/size-metamodels.csv')?.csv).toContain(
      'Metamodel,Classes,Abstract,Concrete,Containments,Associations,'
      + 'Enumerations,Enumeration literals,Packages,Cross-package references\r\n',
    );
    expect(files.find(file => file.name === 'size/size-classes.csv')?.csv).toContain(
      'Metamodel,Class,Abstract,Attributes,Operations,Subclasses (NOC),Inheritance depth (DIT),Containment height\r\n',
    );
  });
});

describe('metric terminology', () => {
  it('uses the shared metric labels for every derived ratio', () => {
    for (const row of derivedMetricRows(metrics)) {
      expect(row.metric).toBe(METRIC_DEFINITIONS[row.id].label);
    }
  });

  it('gives every metric a complete explanation', () => {
    for (const definition of Object.values(METRIC_DEFINITIONS)) {
      expect(definition.label.trim()).not.toBe('');
      expect(definition.represents.trim()).not.toBe('');
      expect(definition.measures.trim()).not.toBe('');
      expect(definition.calculation.trim()).not.toBe('');
      expect(definition.interpretation.trim()).not.toBe('');
    }
  });
});
