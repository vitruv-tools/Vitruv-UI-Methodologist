import type { MethodologistMetrics } from './methodologistMetrics';
import { metricLabel, type MetricId } from './metricDefinitions';
import { buildZipBlob } from './zipStore';

export const METRICS_CATEGORIES = ['size', 'reactions', 'coverage', 'hotspots', 'derived'] as const;
export type MetricsCategory = (typeof METRICS_CATEGORIES)[number];

export const METRICS_CATEGORY_LABELS: Record<MetricsCategory, string> = {
  size: 'Size',
  reactions: 'Reactions',
  coverage: 'Coverage',
  hotspots: 'Hotspots',
  derived: 'Derived',
};

export function formatAvg(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** What a ratio shows when its denominator is 0, so "no data" is not mistaken for a real 0. */
export const NO_RATIO = '—';

export function formatPercent(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0%';
  const pct = value * 100;
  return `${Number.isInteger(pct) ? String(pct) : pct.toFixed(1)}%`;
}

export function safeProjectName(projectName?: string | null): string {
  const illegal = String.raw`<>:"/\|?*`;
  const stripped = Array.from(projectName ?? '')
    .map(ch => {
      const code = ch.codePointAt(0) ?? 0;
      if (code < 32 || illegal.includes(ch)) return ' ';
      return ch;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped || 'Project';
}

export function metricsResultFileName(projectName?: string | null): string {
  return `${safeProjectName(projectName)} metrics.zip`;
}

export function formatDirection(direction: 'one-way' | 'both-ways'): string {
  return direction === 'both-ways' ? 'Two-way' : 'One-way';
}

export function formatOclConstraintsWithoutReaction(metrics: MethodologistMetrics): string {
  return metrics.oclRulesWithoutReaction
    .map(rule => `${rule.name} (${rule.contextClass || 'no context'})`)
    .join(', ');
}

export interface DerivedMetricRow {
  id: MetricId;
  metric: string;
  value: string;
  formula: string;
}

export function derivedMetricRows(metrics: MethodologistMetrics): DerivedMetricRow[] {
  // A ratio is only shown when its denominator is above 0; otherwise it shows a dash.
  const show = (denominator: number, format: () => string): string => (denominator > 0 ? format() : NO_RATIO);
  const rows: Array<Omit<DerivedMetricRow, 'metric'>> = [
    {
      id: 'attributesPerClass',
      value: show(metrics.classCount, () => formatAvg(metrics.attributesPerClass)),
      formula: 'attributes / classes',
    },
    {
      id: 'referencesPerClass',
      value: show(metrics.classCount, () => formatAvg(metrics.referencesPerClass)),
      formula: 'references (containments + associations) / classes',
    },
    {
      id: 'containmentRatio',
      value: show(metrics.referencesTotal, () => formatPercent(metrics.containmentRatio)),
      formula: 'containments / references',
    },
    {
      id: 'classesCoveredByViews',
      value: show(
        metrics.classCount,
        () => `${formatPercent(metrics.classesCoveredByViewsRatio)} (${metrics.classesCoveredByViews}/${metrics.classCount})`,
      ),
      formula: 'classes in at least one view type / classes',
    },
    {
      id: 'reactionsPerCorrespondenceType',
      value: show(metrics.correspondenceTypeCount, () => formatAvg(metrics.reactionsPerCorrespondenceType)),
      formula: 'reactions / coextensions',
    },
    {
      id: 'reactionComplexityRatio',
      value: show(metrics.reactionCount, () => formatAvg(metrics.reactionComplexityRatio)),
      formula: `lines of code of all reactions files (${metrics.reactionTotalLoc}) / reactions (${metrics.reactionCount})`,
    },
    {
      id: 'constraintDensity',
      value: show(metrics.classCount, () => formatAvg(metrics.constraintDensity)),
      formula: 'OCL constraints / classes',
    },
    {
      id: 'metamodelToViewRatio',
      value: show(metrics.viewClassesAggregated, () => formatAvg(metrics.metamodelToViewRatio)),
      formula: 'classes / classes summed over all view types',
    },
    {
      id: 'correspondenceTypesPerMetamodelPair',
      value: show(metrics.metamodelPairCount, () => formatAvg(metrics.correspondenceToMetamodelPairRatio)),
      formula: `coextensions / metamodel pairs (${metrics.metamodelPairCount} pairs)`,
    },
    {
      id: 'modularizationRatio',
      value: show(metrics.packageCount, () => formatAvg(metrics.modularizationRatio)),
      formula: 'classes / packages',
    },
  ];
  return rows.map(row => ({ ...row, metric: metricLabel(row.id) }));
}

type CsvRow = {
  category: string;
  section: string;
  name: string;
  value: string | number;
  details?: string;
};

type KpiRow = [string, string | number, string?];

function csvEscape(value: string | number): string {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map(row => row.map(csvEscape).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

function namesList(names: string[]): string {
  return names.length === 0 ? '' : names.join(', ');
}

function kpis(category: string, section: string, rows: KpiRow[]): CsvRow[] {
  return rows.map(([name, value, details]) => ({ category, section, name, value, details: details ?? '' }));
}

function detail(id: MetricId, value: string | number): string {
  return `${metricLabel(id)}=${value}`;
}

function sizeOverview(metrics: MethodologistMetrics): KpiRow[] {
  return [
    [metricLabel('metamodels'), metrics.metamodels.length],
    [metricLabel('classes'), metrics.classCount, `${metrics.abstractClassCount} abstract, ${metrics.concreteClassCount} concrete`],
    [
      metricLabel('references'),
      metrics.referencesTotal,
      `${metrics.containmentReferences} containments + ${metrics.nonContainmentReferences} associations`,
    ],
    [metricLabel('containments'), metrics.containmentReferences],
    [metricLabel('associations'), metrics.nonContainmentReferences],
    [metricLabel('viewTypes'), metrics.viewTypeCount, `${metrics.singleViewTypeCount} single, ${metrics.multiViewTypeCount} multi`],
    ['Enumerations', metrics.enumCount],
    ['Enumeration literals', metrics.enumLiteralCount],
    [metricLabel('packages'), metrics.packageCount, 'including subpackages'],
    [metricLabel('viewpoints'), metrics.viewpointCount],
  ];
}

/** The Lines of code card's note: the same ratio the derived table shows. */
export function linesPerReaction(metrics: MethodologistMetrics): string {
  return metrics.reactionCount === 0
    ? 'no reactions'
    : `${formatAvg(metrics.reactionComplexityRatio)} per reaction`;
}

function reactionOverview(metrics: MethodologistMetrics): KpiRow[] {
  return [
    [metricLabel('reactions'), metrics.reactionCount, `in ${metrics.correspondenceTypes.length} reactions files`],
    [metricLabel('correspondenceTypes'), metrics.correspondenceTypeCount],
    [metricLabel('oneWayPairs'), metrics.oneWayReactionPairCount],
    [metricLabel('twoWayPairs'), metrics.bidirectionalReactionPairCount],
    [metricLabel('linesOfCode'), metrics.reactionTotalLoc, linesPerReaction(metrics)],
  ];
}

function coverageOverview(metrics: MethodologistMetrics): KpiRow[] {
  return [
    [
      `${metricLabel('reactionCoverage')} %`,
      metrics.reactionCoveragePercent,
      `${metrics.coveredConcreteClassCount} of ${metrics.concreteClassCount} concrete classes`,
    ],
    [metricLabel('orphanMetamodels'), metrics.orphanMetamodelCount, `${metrics.linkedMetamodelCount} linked`],
    [metricLabel('oclConstraints'), metrics.oclConstraintCount],
  ];
}

function detectionAndRepair(metrics: MethodologistMetrics): Array<[string, number, string]> {
  return [
    [metricLabel('detectOnly'), metrics.detectOnlyClassNames.length, namesList(metrics.detectOnlyClassNames)],
    [metricLabel('repairOnly'), metrics.repairOnlyClassNames.length, namesList(metrics.repairOnlyClassNames)],
    [metricLabel('detectAndRepair'), metrics.detectAndRepairClassNames.length, namesList(metrics.detectAndRepairClassNames)],
    [
      metricLabel('oclConstraintsWithoutReaction'),
      metrics.oclRulesWithoutReaction.length,
      formatOclConstraintsWithoutReaction(metrics),
    ],
    [metricLabel('unprotectedClasses'), metrics.unprotectedClassNames.length, namesList(metrics.unprotectedClassNames)],
    [metricLabel('unprotectedReferences'), metrics.unprotectedAssociationNames.length, namesList(metrics.unprotectedAssociationNames)],
  ];
}

function locPerReaction(reactions: { name: string; linesOfCode: number }[]): string {
  return reactions.map(r => `${r.name}: ${r.linesOfCode}`).join('; ');
}

function sizeRows(metrics: MethodologistMetrics): CsvRow[] {
  const category = METRICS_CATEGORY_LABELS.size;
  const rows: CsvRow[] = kpis(category, 'Overview', sizeOverview(metrics));

  for (const mm of metrics.metamodels) {
    rows.push({
      category,
      section: 'Metamodels',
      name: mm.name || 'Unnamed',
      value: mm.classCount,
      details: [
        detail('abstractClasses', mm.abstractClassCount),
        detail('concreteClasses', mm.concreteClassCount),
        detail('containments', mm.containmentReferences),
        detail('associations', mm.nonContainmentReferences),
        `Enumerations=${mm.enumCount}`,
        `Enumeration literals=${mm.enumLiteralCount}`,
        detail('packages', mm.packageCount),
        detail('crossPackageReferences', mm.crossPackageReferences),
      ].join('; '),
    });
    for (const cls of mm.classes) {
      rows.push({
        category,
        section: 'Classes',
        name: cls.name,
        value: cls.attributeCount,
        details: [
          `Metamodel=${mm.name || 'Unnamed'}`,
          `Abstract=${cls.isAbstract ? 'yes' : 'no'}`,
          detail('operations', cls.operationCount),
          detail('subclasses', cls.childCount),
          detail('inheritanceDepth', cls.inheritanceDepth),
          detail('containmentHeight', cls.containmentHeight),
        ].join('; '),
      });
    }
  }

  return rows;
}

function reactionRows(metrics: MethodologistMetrics): CsvRow[] {
  const category = METRICS_CATEGORY_LABELS.reactions;
  const rows = kpis(category, 'Overview', reactionOverview(metrics));

  for (const ct of metrics.correspondenceTypes) {
    rows.push({
      category,
      section: 'Reactions files',
      name: `${ct.sourceName} → ${ct.targetName}`,
      value: ct.reactionCount,
      details: [
        detail('direction', formatDirection(ct.direction)),
        detail('correspondenceTypes', ct.correspondenceTypeCount),
        detail('routines', ct.routineCount),
        detail('linesOfCode', ct.linesOfCode),
        ct.reactions.length === 0 ? '' : detail('locPerReaction', locPerReaction(ct.reactions)),
      ].filter(Boolean).join('; '),
    });
  }

  return rows;
}

function coverageRows(metrics: MethodologistMetrics): CsvRow[] {
  const category = METRICS_CATEGORY_LABELS.coverage;
  const rows = kpis(category, 'Overview', coverageOverview(metrics));

  for (const link of metrics.metamodelLinks) {
    rows.push({
      category,
      section: 'Metamodels',
      name: link.name || 'Unnamed',
      value: link.isOrphan ? 'Orphan' : 'Linked',
      details: [
        detail('fanIn', link.fanIn),
        detail('fanOut', link.fanOut),
        detail('coveredClasses', `${link.coveredConcreteClassCount}/${link.concreteClassCount}`),
        namesList(link.uncoveredClassNames) ? detail('uncoveredClasses', namesList(link.uncoveredClassNames)) : '',
      ].filter(Boolean).join('; '),
    });
  }

  for (const [name, value, details] of detectionAndRepair(metrics)) {
    rows.push({ category, section: 'Detection and repair', name, value, details });
  }

  return rows;
}

function hotspotRows(metrics: MethodologistMetrics): CsvRow[] {
  const category = METRICS_CATEGORY_LABELS.hotspots;
  return metrics.hotspotClasses.map(hotspot => ({
    category,
    section: 'Classes',
    name: hotspot.className,
    value: hotspot.score,
    details: [
      `Metamodel=${hotspot.metamodel}`,
      detail('hotspotOclConstraints', hotspot.oclRuleCount),
      detail('hotspotReactionsFiles', hotspot.reactionFileCount),
    ].join('; '),
  }));
}

function derivedRows(metrics: MethodologistMetrics): CsvRow[] {
  const category = METRICS_CATEGORY_LABELS.derived;
  return derivedMetricRows(metrics).map(row => ({
    category,
    section: 'Derived ratios',
    name: row.metric,
    value: row.value,
    details: row.formula,
  }));
}

const CATEGORY_ROWS: Record<MetricsCategory, (metrics: MethodologistMetrics) => CsvRow[]> = {
  size: sizeRows,
  reactions: reactionRows,
  coverage: coverageRows,
  hotspots: hotspotRows,
  derived: derivedRows,
};

function kpiTable(rows: KpiRow[]): string {
  return toCsv(
    ['Metric', 'Value', 'Details'],
    rows.map(([name, value, details]) => [name, value, details ?? '']),
  );
}

function sizeTables(metrics: MethodologistMetrics): { name: string; csv: string }[] {
  return [
    {
      name: 'size-overview.csv',
      csv: kpiTable(sizeOverview(metrics)),
    },
    {
      name: 'size-metamodels.csv',
      csv: toCsv(
        [
          'Metamodel', metricLabel('classes'), metricLabel('abstractClasses'), metricLabel('concreteClasses'),
          metricLabel('containments'), metricLabel('associations'), 'Enumerations', 'Enumeration literals',
          metricLabel('packages'), metricLabel('crossPackageReferences'),
        ],
        metrics.metamodels.map(mm => [
          mm.name || 'Unnamed',
          mm.classCount,
          mm.abstractClassCount,
          mm.concreteClassCount,
          mm.containmentReferences,
          mm.nonContainmentReferences,
          mm.enumCount,
          mm.enumLiteralCount,
          mm.packageCount,
          mm.crossPackageReferences,
        ]),
      ),
    },
    {
      name: 'size-classes.csv',
      csv: toCsv(
        [
          'Metamodel', 'Class', 'Abstract', metricLabel('attributes'), metricLabel('operations'),
          metricLabel('subclasses'), metricLabel('inheritanceDepth'), metricLabel('containmentHeight'),
        ],
        metrics.metamodels.flatMap(mm => mm.classes.map(cls => [
          mm.name || 'Unnamed',
          cls.name,
          cls.isAbstract ? 'yes' : 'no',
          cls.attributeCount,
          cls.operationCount,
          cls.childCount,
          cls.inheritanceDepth,
          cls.containmentHeight,
        ])),
      ),
    },
  ];
}

function reactionTables(metrics: MethodologistMetrics): { name: string; csv: string }[] {
  return [
    {
      name: 'reactions-overview.csv',
      csv: kpiTable(reactionOverview(metrics)),
    },
    {
      name: 'reactions-correspondences.csv',
      csv: toCsv(
        [
          'Source', 'Target', metricLabel('direction'), metricLabel('correspondenceTypes'), metricLabel('reactions'),
          metricLabel('routines'), metricLabel('linesOfCode'), metricLabel('locPerReaction'),
        ],
        metrics.correspondenceTypes.map(ct => [
          ct.sourceName,
          ct.targetName,
          formatDirection(ct.direction),
          ct.correspondenceTypeCount,
          ct.reactionCount,
          ct.routineCount,
          ct.linesOfCode,
          locPerReaction(ct.reactions),
        ]),
      ),
    },
  ];
}

function coverageTables(metrics: MethodologistMetrics): { name: string; csv: string }[] {
  return [
    {
      name: 'coverage-overview.csv',
      csv: kpiTable(coverageOverview(metrics)),
    },
    {
      name: 'coverage-links.csv',
      csv: toCsv(
        [
          'Metamodel', metricLabel('linkStatus'), metricLabel('fanIn'), metricLabel('fanOut'),
          metricLabel('coveredClasses'), 'Concrete classes', metricLabel('uncoveredClasses'),
        ],
        metrics.metamodelLinks.map(link => [
          link.name || 'Unnamed',
          link.isOrphan ? 'Orphan' : 'Linked',
          link.fanIn,
          link.fanOut,
          link.coveredConcreteClassCount,
          link.concreteClassCount,
          namesList(link.uncoveredClassNames),
        ]),
      ),
    },
    {
      name: 'coverage-gap.csv',
      csv: toCsv(['Kind', 'Count', 'Names'], detectionAndRepair(metrics)),
    },
  ];
}

function hotspotTables(metrics: MethodologistMetrics): { name: string; csv: string }[] {
  return [{
    name: 'hotspots.csv',
    csv: toCsv(
      [
        'Class', 'Metamodel', metricLabel('hotspotOclConstraints'),
        metricLabel('hotspotReactionsFiles'), metricLabel('hotspotScore'),
      ],
      metrics.hotspotClasses.map(hotspot => [
        hotspot.className,
        hotspot.metamodel,
        hotspot.oclRuleCount,
        hotspot.reactionFileCount,
        hotspot.score,
      ]),
    ),
  }];
}

function derivedTables(metrics: MethodologistMetrics): { name: string; csv: string }[] {
  return [{
    name: 'derived.csv',
    csv: toCsv(
      ['Metric', 'Value', 'Formula'],
      derivedMetricRows(metrics).map(row => [row.metric, row.value, row.formula]),
    ),
  }];
}

const CATEGORY_TABLES: Record<MetricsCategory, (metrics: MethodologistMetrics) => { name: string; csv: string }[]> = {
  size: sizeTables,
  reactions: reactionTables,
  coverage: coverageTables,
  hotspots: hotspotTables,
  derived: derivedTables,
};

export function orderedMetricsCategories(selected: Iterable<MetricsCategory>): MetricsCategory[] {
  const wanted = new Set(selected);
  return METRICS_CATEGORIES.filter(id => wanted.has(id));
}

export function formatSelectedLabel(selected: Iterable<MetricsCategory>): string {
  const ids = orderedMetricsCategories(selected);
  if (ids.length === 0) return 'Selected — none';
  return `Selected — ${ids.map(id => METRICS_CATEGORY_LABELS[id]).join(', ')}`;
}

export function buildMetricsCsv(
  metrics: MethodologistMetrics,
  categories: Iterable<MetricsCategory>,
  projectName?: string | null,
): string {
  const included = orderedMetricsCategories(categories);
  const project = safeProjectName(projectName);
  const includedLabel = included.map(id => METRICS_CATEGORY_LABELS[id]).join(', ');
  const rows = included.flatMap(id => CATEGORY_ROWS[id](metrics));
  return toCsv(
    ['Project', 'Included', 'Category', 'Section', 'Name', 'Value', 'Details'],
    rows.length === 0
      ? [[project, includedLabel, '', '', 'No categories selected', '', '']]
      : rows.map(row => [project, includedLabel, row.category, row.section, row.name, row.value, row.details ?? '']),
  );
}

export function buildMetricsCsvFiles(
  metrics: MethodologistMetrics,
  categories: Iterable<MetricsCategory>,
  projectName?: string | null,
): { name: string; csv: string }[] {
  const included = orderedMetricsCategories(categories);
  return included.flatMap(id => [
    { name: `${id}/all.csv`, csv: buildMetricsCsv(metrics, [id], projectName) },
    ...CATEGORY_TABLES[id](metrics).map(file => ({
      name: `${id}/${file.name}`,
      csv: file.csv,
    })),
  ]);
}

export function buildMetricsReportZip(
  metrics: MethodologistMetrics,
  categories: Iterable<MetricsCategory>,
  projectName?: string | null,
): Blob {
  return buildZipBlob(
    buildMetricsCsvFiles(metrics, categories, projectName).map(file => ({
      name: file.name,
      content: file.csv,
    })),
  );
}
