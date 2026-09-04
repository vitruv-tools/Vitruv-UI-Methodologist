import type { MethodologistMetrics } from './methodologistMetrics';
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

export function derivedMetricRows(metrics: MethodologistMetrics): { metric: string; value: string; formula: string }[] {
  return [
    {
      metric: 'Attributes per class',
      value: formatAvg(metrics.attributesPerClass),
      formula: 'attributes / classes',
    },
    {
      metric: 'References per class',
      value: formatAvg(metrics.referencesPerClass),
      formula: 'references / classes',
    },
    {
      metric: 'Containment ratio',
      value: formatPercent(metrics.containmentRatio),
      formula: 'containment references / total references',
    },
    {
      metric: 'Classes covered by views',
      value: `${formatPercent(metrics.classesCoveredByViewsRatio)} (${metrics.classesCoveredByViews}/${metrics.classCount})`,
      formula: 'classes in ≥1 view type / total classes',
    },
    {
      metric: 'View element density',
      value: formatAvg(metrics.viewElementDensity),
      formula: 'model elements / view types',
    },
    {
      metric: 'Reactions per correspondence type',
      value: formatAvg(metrics.reactionsPerCorrespondenceType),
      formula: 'reactions / correspondence types',
    },
    {
      metric: 'Reaction complexity ratio',
      value: formatAvg(metrics.reactionComplexityRatio),
      formula: 'total reaction LOC / reactions',
    },
    {
      metric: 'Constraint density',
      value: formatAvg(metrics.constraintDensity),
      formula: 'OCL constraints / classes',
    },
    {
      metric: 'Metamodel-to-view ratio',
      value: formatAvg(metrics.metamodelToViewRatio),
      formula: 'metamodel classes / classes aggregated across views',
    },
    {
      metric: 'Correspondence coverage',
      value: formatAvg(metrics.correspondenceToViewPairRatio),
      formula: `correspondence types / view-type pairs (${metrics.viewTypePairCount} pairs)`,
    },
    {
      metric: 'Modularization ratio',
      value: formatAvg(metrics.modularizationRatio),
      formula: 'classes / packages',
    },
  ];
}

type CsvRow = {
  category: string;
  section: string;
  name: string;
  value: string | number;
  details?: string;
};

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

function kpis(category: string, section: string, rows: Array<[string, string | number, string?]>): CsvRow[] {
  return rows.map(([name, value, details]) => ({ category, section, name, value, details: details ?? '' }));
}

function sizeRows(metrics: MethodologistMetrics): CsvRow[] {
  const category = METRICS_CATEGORY_LABELS.size;
  const rows: CsvRow[] = kpis(category, 'Overview', [
    ['Metamodels', metrics.metamodels.length],
    ['Classes', metrics.classCount, `${metrics.abstractClassCount} abstract, ${metrics.concreteClassCount} concrete`],
    ['Attributes', metrics.attributesTotal],
    ['Associations', metrics.nonContainmentReferences, `${metrics.containmentReferences} containment`],
    ['View types', metrics.viewTypeCount, `${metrics.singleViewTypeCount} single, ${metrics.multiViewTypeCount} multi`],
    ['Enums', metrics.enumCount],
    ['Enum literals', metrics.enumLiteralCount],
    ['Packages', metrics.packageCount],
    ['Model elements', metrics.instanceElementTotal, metrics.instanceModels.length === 0 ? 'No instance models' : `${metrics.instanceModels.length} models`],
    ['Operations', metrics.operationsTotal],
    ['Children max', metrics.nocMax, `avg ${formatAvg(metrics.nocAvg)}`],
    ['Containment height', metrics.containmentHeightMax, `${metrics.crossPackageReferences} cross-package refs`],
    ['Viewpoints', metrics.viewpointCount],
    ['Views (instances)', 0, 'Not persisted'],
  ]);

  for (const mm of metrics.metamodels) {
    rows.push({
      category,
      section: 'Metamodels',
      name: mm.name || 'Unnamed',
      value: mm.classCount,
      details: [
        `abstract=${mm.abstractClassCount}`,
        `concrete=${mm.concreteClassCount}`,
        `attributes=${mm.attributesTotal}`,
        `containment refs=${mm.containmentReferences}`,
        `association refs=${mm.nonContainmentReferences}`,
        `enums=${mm.enumCount}`,
        `literals=${mm.enumLiteralCount}`,
        `packages=${mm.packageCount}`,
        `operations=${mm.operationsTotal}`,
        `children max/avg=${mm.nocMax}/${formatAvg(mm.nocAvg)}`,
        `inheritance max/avg=${mm.inheritanceDepthMax}/${formatAvg(mm.inheritanceDepthAvg)}`,
        `cont. height=${mm.containmentHeightMax}`,
        `cross-pkg=${mm.crossPackageReferences}`,
      ].join('; '),
    });
    for (const cls of mm.classes) {
      rows.push({
        category,
        section: 'Classes',
        name: cls.name,
        value: cls.attributeCount,
        details: [
          `metamodel=${mm.name || 'Unnamed'}`,
          `abstract=${cls.isAbstract ? 'yes' : 'no'}`,
          `operations=${cls.operationCount}`,
          `children=${cls.childCount}`,
          `depth=${cls.inheritanceDepth}`,
          `cont. height=${cls.containmentHeight}`,
        ].join('; '),
      });
    }
  }

  return rows;
}

function reactionRows(metrics: MethodologistMetrics): CsvRow[] {
  const category = METRICS_CATEGORY_LABELS.reactions;
  const rows = kpis(category, 'Overview', [
    ['Reactions', metrics.reactionCount, `${metrics.oneWayReactionPairCount} one-way, ${metrics.bidirectionalReactionPairCount} both-ways`],
    ['Correspondence types', metrics.correspondenceTypeCount],
    ['One-way links', metrics.oneWayReactionPairCount],
    ['Both-ways links', metrics.bidirectionalReactionPairCount],
    ['Reaction LOC', metrics.reactionTotalLoc, `avg ${formatAvg(metrics.avgLocPerReaction)} / reaction`],
    ['Correspondence instances', metrics.correspondenceInstanceCount, metrics.correspondenceInstanceCount === 0 ? 'none loaded' : ''],
  ]);

  for (const ct of metrics.correspondenceTypes) {
    rows.push({
      category,
      section: 'Correspondences',
      name: `${ct.sourceName} → ${ct.targetName}`,
      value: ct.reactionCount,
      details: [
        `direction=${ct.direction === 'both-ways' ? 'both-ways' : 'one-way'}`,
        `types=${ct.correspondenceTypeCount}`,
        `routines=${ct.routineCount}`,
        `LOC=${ct.linesOfCode}`,
        ct.reactions.length === 0
          ? ''
          : 'LOC per reaction=' + ct.reactions.map(r => r.name + ': ' + r.linesOfCode).join('; '),
      ].filter(Boolean).join('; '),
    });
  }

  return rows;
}

function coverageRows(metrics: MethodologistMetrics): CsvRow[] {
  const category = METRICS_CATEGORY_LABELS.coverage;
  const rows = kpis(category, 'Overview', [
    ['Correspondence coverage %', metrics.correspondenceCoveragePercent, `${metrics.coveredConcreteClassCount} of ${metrics.concreteClassCount} concrete`],
    ['Orphans', metrics.orphanMetamodelCount, `${metrics.linkedMetamodelCount} linked`],
    ['OCL constraints', metrics.oclConstraintCount],
  ]);

  for (const link of metrics.metamodelLinks) {
    rows.push({
      category,
      section: 'Links',
      name: link.name || 'Unnamed',
      value: link.isOrphan ? 'Orphan' : 'Linked',
      details: [
        `fan-in=${link.fanIn}`,
        `fan-out=${link.fanOut}`,
        `covered=${link.coveredConcreteClassCount}/${link.concreteClassCount}`,
        namesList(link.uncoveredClassNames) ? `uncovered=${namesList(link.uncoveredClassNames)}` : '',
      ].filter(Boolean).join('; '),
    });
  }

  const gapRows: Array<[string, number, string]> = [
    ['Detect only', metrics.detectOnlyClassNames.length, namesList(metrics.detectOnlyClassNames)],
    ['Repair only', metrics.repairOnlyClassNames.length, namesList(metrics.repairOnlyClassNames)],
    ['Detect and repair', metrics.detectAndRepairClassNames.length, namesList(metrics.detectAndRepairClassNames)],
    [
      'Rules with no reaction',
      metrics.oclRulesWithoutReaction.length,
      metrics.oclRulesWithoutReaction.map(rule => `${rule.name} (${rule.contextClass || 'no context'})`).join(', '),
    ],
    ['Unprotected classes', metrics.unprotectedClassNames.length, namesList(metrics.unprotectedClassNames)],
    ['Unprotected associations', metrics.unprotectedAssociationNames.length, namesList(metrics.unprotectedAssociationNames)],
  ];
  for (const [name, value, details] of gapRows) {
    rows.push({ category, section: 'Gap', name, value, details });
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
    details: `metamodel=${hotspot.metamodel}; OCL rules=${hotspot.oclRuleCount}; reaction files=${hotspot.reactionFileCount}`,
  }));
}

function derivedRows(metrics: MethodologistMetrics): CsvRow[] {
  const category = METRICS_CATEGORY_LABELS.derived;
  return derivedMetricRows(metrics).map(row => ({
    category,
    section: 'Ratios',
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

function kpiTable(rows: Array<[string, string | number, string?]>): string {
  return toCsv(
    ['Metric', 'Value', 'Details'],
    rows.map(([name, value, details]) => [name, value, details ?? '']),
  );
}

function sizeTables(metrics: MethodologistMetrics): { name: string; csv: string }[] {
  return [
    {
      name: 'size-overview.csv',
      csv: kpiTable([
        ['Metamodels', metrics.metamodels.length],
        ['Classes', metrics.classCount, `${metrics.abstractClassCount} abstract, ${metrics.concreteClassCount} concrete`],
        ['Attributes', metrics.attributesTotal],
        ['Associations', metrics.nonContainmentReferences, `${metrics.containmentReferences} containment`],
        ['View types', metrics.viewTypeCount, `${metrics.singleViewTypeCount} single, ${metrics.multiViewTypeCount} multi`],
        ['Enums', metrics.enumCount],
        ['Enum literals', metrics.enumLiteralCount],
        ['Packages', metrics.packageCount],
        ['Model elements', metrics.instanceElementTotal, metrics.instanceModels.length === 0 ? 'No instance models' : `${metrics.instanceModels.length} models`],
        ['Operations', metrics.operationsTotal],
        ['Children max', metrics.nocMax, `avg ${formatAvg(metrics.nocAvg)}`],
        ['Containment height', metrics.containmentHeightMax, `${metrics.crossPackageReferences} cross-package refs`],
        ['Viewpoints', metrics.viewpointCount],
        ['Views (instances)', 0, 'Not persisted'],
      ]),
    },
    {
      name: 'size-metamodels.csv',
      csv: toCsv(
        [
          'Metamodel', 'Classes', 'Abstract', 'Concrete', 'Attributes',
          'Containment refs', 'Association refs', 'Enums', 'Literals', 'Packages',
          'Operations', 'Children max', 'Children avg', 'Inheritance max', 'Inheritance avg',
          'Cont. height', 'Cross-pkg refs',
        ],
        metrics.metamodels.map(mm => [
          mm.name || 'Unnamed',
          mm.classCount,
          mm.abstractClassCount,
          mm.concreteClassCount,
          mm.attributesTotal,
          mm.containmentReferences,
          mm.nonContainmentReferences,
          mm.enumCount,
          mm.enumLiteralCount,
          mm.packageCount,
          mm.operationsTotal,
          mm.nocMax,
          formatAvg(mm.nocAvg),
          mm.inheritanceDepthMax,
          formatAvg(mm.inheritanceDepthAvg),
          mm.containmentHeightMax,
          mm.crossPackageReferences,
        ]),
      ),
    },
    {
      name: 'size-classes.csv',
      csv: toCsv(
        ['Metamodel', 'Class', 'Abstract', 'Attributes', 'Operations', 'Children', 'Depth', 'Cont. height'],
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
      csv: kpiTable([
        ['Reactions', metrics.reactionCount, `${metrics.oneWayReactionPairCount} one-way, ${metrics.bidirectionalReactionPairCount} both-ways`],
        ['Correspondence types', metrics.correspondenceTypeCount],
        ['One-way links', metrics.oneWayReactionPairCount],
        ['Both-ways links', metrics.bidirectionalReactionPairCount],
        ['Reaction LOC', metrics.reactionTotalLoc, `avg ${formatAvg(metrics.avgLocPerReaction)} / reaction`],
        ['Correspondence instances', metrics.correspondenceInstanceCount, metrics.correspondenceInstanceCount === 0 ? 'none loaded' : ''],
      ]),
    },
    {
      name: 'reactions-correspondences.csv',
      csv: toCsv(
        ['Source', 'Target', 'Direction', 'Types in file', 'Reactions', 'Routines', 'LOC (file)', 'LOC per reaction'],
        metrics.correspondenceTypes.map(ct => [
          ct.sourceName,
          ct.targetName,
          ct.direction === 'both-ways' ? 'Both ways' : 'One-way',
          ct.correspondenceTypeCount,
          ct.reactionCount,
          ct.routineCount,
          ct.linesOfCode,
          ct.reactions.length === 0 ? '' : ct.reactions.map(r => `${r.name}: ${r.linesOfCode}`).join('; '),
        ]),
      ),
    },
  ];
}

function coverageTables(metrics: MethodologistMetrics): { name: string; csv: string }[] {
  return [
    {
      name: 'coverage-overview.csv',
      csv: kpiTable([
        ['Correspondence coverage %', metrics.correspondenceCoveragePercent, `${metrics.coveredConcreteClassCount} of ${metrics.concreteClassCount} concrete`],
        ['Orphans', metrics.orphanMetamodelCount, `${metrics.linkedMetamodelCount} linked`],
        ['OCL constraints', metrics.oclConstraintCount],
      ]),
    },
    {
      name: 'coverage-links.csv',
      csv: toCsv(
        ['Metamodel', 'Status', 'Fan-in', 'Fan-out', 'Covered classes', 'Concrete classes', 'Uncovered concrete classes'],
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
      csv: toCsv(
        ['Kind', 'Count', 'Names'],
        [
          ['Detect only', metrics.detectOnlyClassNames.length, namesList(metrics.detectOnlyClassNames)],
          ['Repair only', metrics.repairOnlyClassNames.length, namesList(metrics.repairOnlyClassNames)],
          ['Detect and repair', metrics.detectAndRepairClassNames.length, namesList(metrics.detectAndRepairClassNames)],
          [
            'Rules with no reaction',
            metrics.oclRulesWithoutReaction.length,
            metrics.oclRulesWithoutReaction.map(rule => `${rule.name} (${rule.contextClass || 'no context'})`).join(', '),
          ],
          ['Unprotected classes', metrics.unprotectedClassNames.length, namesList(metrics.unprotectedClassNames)],
          ['Unprotected associations', metrics.unprotectedAssociationNames.length, namesList(metrics.unprotectedAssociationNames)],
        ],
      ),
    },
  ];
}

function hotspotTables(metrics: MethodologistMetrics): { name: string; csv: string }[] {
  return [{
    name: 'hotspots.csv',
    csv: toCsv(
      ['Class', 'Metamodel', 'OCL rules', 'Reaction files', 'Score'],
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
