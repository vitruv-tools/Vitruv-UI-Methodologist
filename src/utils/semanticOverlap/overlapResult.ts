import { CORRESPONDENCE_KINDS, type Correspondence, type ElementRef, type MetamodelRef, type OverlapResult } from './types';

/** Raised when a stored or imported result does not match schema version 1. */
export class OverlapResultFormatError extends Error {
  constructor(message: string) {
    super(`Invalid semantic overlap result: ${message}`);
    this.name = 'OverlapResultFormatError';
  }
}

export function serializeOverlapResult(result: OverlapResult): string {
  return JSON.stringify(result, null, 2);
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const isUnit = (value: unknown) => typeof value === 'number' && value >= 0 && value <= 1;

function ensure(condition: boolean, message: string): asserts condition {
  if (!condition) throw new OverlapResultFormatError(message);
}

function checkMetamodelRef(value: unknown, field: string): asserts value is MetamodelRef {
  ensure(isObject(value), `${field} is missing`);
  ensure(typeof value.libraryId === 'number' && typeof value.name === 'string'
    && typeof value.ecoreFileId === 'number' && typeof value.contentHash === 'string', `${field} is incomplete`);
}

function checkElementRef(value: unknown, field: string): asserts value is ElementRef {
  ensure(isObject(value)
    && (value.side === 'source' || value.side === 'target')
    && ['class', 'attribute', 'reference'].includes(value.kind as string)
    && typeof value.qualifiedName === 'string' && typeof value.name === 'string', `${field} is not an element reference`);
  if (value.path !== undefined) {
    ensure(Array.isArray(value.path) && value.path.length === 2 && value.path.every(isNonEmptyString),
      `${field}.path must name two features`);
    ensure(value.qualifiedName.endsWith(`.${value.path.join('.')}`), `${field}.qualifiedName does not end with its path`);
  }
}

/** Shape rules of the kinds beyond `same` and `instance`. */
function checkKindShape(value: Json, field: string) {
  const sources = value.sources as Json[];
  const targets = value.targets as Json[];
  const kind = value.kind as string;
  if (kind === 'path') {
    ensure(value.level === 'feature', `${field}: a path correspondence is on feature level`);
    const withPath = [...sources, ...targets].filter(ref => ref.path !== undefined);
    ensure(withPath.length === 1, `${field}: a path correspondence has exactly one element with a path`);
  } else if (kind === 'split') {
    ensure(value.level === 'class' && sources.length === 1 && targets.length >= 2,
      `${field}: a split is one source class and at least two target classes`);
  } else if (kind === 'merge') {
    ensure(value.level === 'class' && sources.length >= 2 && targets.length === 1,
      `${field}: a merge is at least two source classes and one target class`);
  } else if (kind === 'conditional') {
    ensure(value.level === 'class' && sources.length === 1 && targets.length === 1,
      `${field}: a conditional correspondence is one source and one target class`);
    const condition = value.condition;
    ensure(isObject(condition) && isNonEmptyString(condition.attribute) && isNonEmptyString(condition.value),
      `${field}.condition needs an attribute and a value`);
  }
}

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

const isCount = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;

function checkTypeObjectPattern(value: unknown, field: string) {
  ensure(isObject(value) && (value.side === 'source' || value.side === 'target'), `${field} is not a pattern`);
  for (const role of ['item', 'type', 'definition', 'value']) {
    ensure(typeof value[role] === 'string', `${field}.${role} must be a qualified name`);
  }
  ensure(value.container === null || typeof value.container === 'string', `${field}.container must be a qualified name`);
  ensure(isObject(value.definitionsByCategory) && isObject(value.valuesByCategory), `${field} has no data-type classes`);
  ensure(isUnit(value.confidence), `${field}.confidence must be between 0 and 1`);
}

function checkCorrespondence(value: unknown, field: string): asserts value is Correspondence {
  ensure(isObject(value), `${field} is not an object`);
  ensure(typeof value.id === 'string' && (value.level === 'class' || value.level === 'feature'), `${field} has no id or level`);
  ensure(Array.isArray(value.sources) && value.sources.length >= 1, `${field} needs at least one source`);
  ensure(Array.isArray(value.targets) && value.targets.length >= 1, `${field} needs at least one target`);
  value.sources.forEach((ref, k) => checkElementRef(ref, `${field}.sources[${k}]`));
  value.targets.forEach((ref, k) => checkElementRef(ref, `${field}.targets[${k}]`));
  ensure(isUnit(value.score), `${field}.score must be between 0 and 1`);
  ensure(isObject(value.scores) && isUnit(value.scores.structural) && isUnit(value.scores.syntactic)
    && Object.values(value.scores).every(isUnit), `${field}.scores must be between 0 and 1`);
  if (value.kind !== undefined) {
    ensure((CORRESPONDENCE_KINDS as readonly unknown[]).includes(value.kind), `${field}.kind must be one of ${CORRESPONDENCE_KINDS.join(', ')}`);
    checkKindShape(value, field);
  }
  if (value.kind === 'instance') {
    const instance = value.instance;
    ensure(isObject(instance) && (instance.side === 'source' || instance.side === 'target')
      && ['type', 'definition', 'value'].includes(instance.role as string), `${field}.instance needs a side and a role`);
    ensure(instance.role === 'type' ? value.level === 'class' : value.level === 'feature',
      `${field}.instance.role ${String(instance.role)} does not fit level ${String(value.level)}`);
  }
  if (value.children !== undefined) {
    ensure(Array.isArray(value.children), `${field}.children must be a list`);
    value.children.forEach((child, k) => checkCorrespondence(child, `${field}.children[${k}]`));
  }
}

const REPAIR_RULES = ['subclass', 'reference-ends', 'opposite', 'containment'];

function checkRepairSide(value: unknown, field: string) {
  ensure(isObject(value) && (value.level === 'class' || value.level === 'feature')
    && Array.isArray(value.sources) && value.sources.every(v => typeof v === 'string')
    && Array.isArray(value.targets) && value.targets.every(v => typeof v === 'string')
    && typeof value.score === 'number', `${field} is not a correspondence summary`);
}

/** Repairs, embedding model and baseline, acceptance threshold (all optional). */
function checkOptionalExtensions(data: Json) {
  if (data.repairs !== undefined) {
    ensure(Array.isArray(data.repairs), 'repairs must be a list');
    data.repairs.forEach((repair, k) => {
      ensure(isObject(repair) && REPAIR_RULES.includes(repair.rule as string), `repairs[${k}] has an unknown rule`);
      checkRepairSide(repair.removed, `repairs[${k}].removed`);
      checkRepairSide(repair.kept, `repairs[${k}].kept`);
      ensure(typeof repair.reason === 'string', `repairs[${k}].reason is missing`);
    });
  }
  if (data.embeddingModel !== undefined) {
    const model = data.embeddingModel;
    ensure(isObject(model) && typeof model.id === 'string' && typeof model.revision === 'string'
      && typeof model.sha256 === 'string', 'embeddingModel needs an id, a revision and a checksum');
  }
  if (data.embeddingBaseline !== undefined) {
    const baseline = data.embeddingBaseline;
    ensure(isObject(baseline) && typeof baseline.class === 'number' && typeof baseline.feature === 'number',
      'embeddingBaseline needs a class and a feature value');
  }
  if (data.acceptanceThreshold !== undefined) {
    const threshold = data.acceptanceThreshold;
    ensure(isObject(threshold) && isUnit(threshold.value)
      && (threshold.source === 'settings' || threshold.source === 'calibrated')
      && (threshold.note === undefined || typeof threshold.note === 'string'), 'acceptanceThreshold is invalid');
  }
}

/** 1–3 alternatives, exactly one default, and the main fields equal to the default one. */
function checkAlternatives(data: Json) {
  const alternatives = data.alternatives;
  ensure(Array.isArray(alternatives) && alternatives.length >= 1 && alternatives.length <= 3, 'alternatives must have 1 to 3 entries');
  alternatives.forEach((alternative, k) => {
    const field = `alternatives[${k}]`;
    ensure(isObject(alternative) && typeof alternative.label === 'string' && typeof alternative.isDefault === 'boolean',
      `${field} needs a label and a default flag`);
    ensure(isObject(alternative.objectives) && typeof alternative.objectives.lexical === 'number'
      && typeof alternative.objectives.structural === 'number', `${field}.objectives are missing`);
    ensure(Array.isArray(alternative.correspondences), `${field}.correspondences are missing`);
    alternative.correspondences.forEach((c, j) => checkCorrespondence(c, `${field}.correspondences[${j}]`));
    ensure(isObject(alternative.unmatched) && Array.isArray(alternative.unmatched.source)
      && Array.isArray(alternative.unmatched.target), `${field}.unmatched is missing`);
    ensure(isObject(alternative.summary), `${field}.summary is missing`);
  });
  const defaults = (alternatives as Json[]).filter(alternative => alternative.isDefault === true);
  ensure(defaults.length === 1, 'alternatives need exactly one default');
  const main = JSON.stringify([data.correspondences, data.unmatched]);
  ensure(JSON.stringify([defaults[0].correspondences, defaults[0].unmatched]) === main, 'alternatives are inconsistent');
}

/** Reads a result written by {@link serializeOverlapResult}, validating schema version 1. */
export function parseOverlapResult(json: string): OverlapResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new OverlapResultFormatError('not JSON');
  }
  ensure(isObject(data), 'not an object');
  ensure(data.schemaVersion === 1, `unsupported schema version ${String(data.schemaVersion)}`);
  for (const field of ['id', 'createdAt']) ensure(typeof data[field] === 'string', `${field} is missing`);
  ensure(typeof data.durationMs === 'number' && data.durationMs >= 0, 'durationMs is missing');
  checkMetamodelRef(data.source, 'source');
  checkMetamodelRef(data.target, 'target');
  ensure(isObject(data.settings), 'settings are missing');
  const seed = data.settings.seed;
  ensure(Number.isInteger(seed) && (seed as number) >= 0 && (seed as number) <= 0xffffffff, 'settings.seed must be a uint32');
  ensure(isObject(data.engine) && isObject(data.engine.strategy) && Array.isArray(data.engine.measures), 'engine is missing');
  ensure(Array.isArray(data.warnings), 'warnings are missing');
  ensure(isObject(data.summary), 'summary is missing');
  if (data.approach !== undefined) {
    ensure(isObject(data.approach) && typeof data.approach.id === 'string' && typeof data.approach.version === 'string',
      'approach needs an id and a version');
  }
  if (data.summary.kindCounts !== undefined) {
    const counts = data.summary.kindCounts;
    ensure(isObject(counts) && Object.entries(counts).every(([kind, count]) =>
      (CORRESPONDENCE_KINDS as readonly string[]).includes(kind) && isCount(count)), 'summary.kindCounts must be counts');
  }
  if (data.summary.coverage !== undefined) {
    const coverage = data.summary.coverage;
    const shares = (side: unknown) => isObject(side) && isUnit(side.classes) && isUnit(side.features);
    ensure(isObject(coverage) && shares(coverage.source) && shares(coverage.target), 'summary.coverage must be shares between 0 and 1');
  }
  checkOptionalExtensions(data);
  if (data.typeObjectPatterns !== undefined) {
    ensure(Array.isArray(data.typeObjectPatterns), 'typeObjectPatterns must be a list');
    data.typeObjectPatterns.forEach((pattern, k) => checkTypeObjectPattern(pattern, `typeObjectPatterns[${k}]`));
  }
  ensure(isObject(data.classMatrix) && Array.isArray(data.classMatrix.rows) && Array.isArray(data.classMatrix.columns)
    && Array.isArray(data.classMatrix.overall) && data.classMatrix.overall.every(isUnit), 'classMatrix is invalid');
  ensure(Array.isArray(data.correspondences), 'correspondences are missing');
  data.correspondences.forEach((c, k) => checkCorrespondence(c, `correspondences[${k}]`));
  ensure(isObject(data.unmatched) && Array.isArray(data.unmatched.source) && Array.isArray(data.unmatched.target), 'unmatched is missing');
  if (data.alternatives !== undefined) checkAlternatives(data);
  return data as unknown as OverlapResult;
}

const CSV_HEADER = 'level,parent,sources,targets,score,structural,syntactic,kind,role';

const APPROACH_LABELS: Record<string, string> = { paper: 'Kessentini et al. 2014 (paper)', improved: 'Improved' };

const approachLabel = (result: OverlapResult) => (result.approach
  ? `${APPROACH_LABELS[result.approach.id] ?? result.approach.id} ${result.approach.version}`
  : APPROACH_LABELS.paper);

/** Quotes a CSV field when it contains a comma, quote or line break (RFC 4180). */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const metamodelLabel = (ref: MetamodelRef) => (ref.version ? `${ref.name} (${ref.version})` : ref.name);

/** `role` column: the instance role, or `<attribute QN>=<value>` for conditional correspondences. */
const roleOf = (c: Correspondence) =>
  (c.kind === 'conditional' && c.condition ? `${c.condition.attribute}=${c.condition.value}` : c.instance?.role ?? '');

const refList = (names: readonly string[]) => names.join('; ');

/**
 * Flat CSV of a result: `#` comment lines with the compared metamodels, approach, seed and
 * creation time, then one row per class correspondence followed by its feature correspondences.
 */
export function overlapResultToCsv(result: OverlapResult, shown?: { alternative: number }): string {
  const row = (c: Correspondence, parent: string) => [
    c.level,
    parent,
    c.sources.map(ref => ref.qualifiedName).join('; '),
    c.targets.map(ref => ref.qualifiedName).join('; '),
    c.score.toFixed(3),
    c.scores.structural.toFixed(3),
    c.scores.syntactic.toFixed(3),
    c.kind ?? 'same',
    roleOf(c),
  ].map(csvField).join(',');
  const lines = [
    `# Semantic overlap: ${metamodelLabel(result.source)} -> ${metamodelLabel(result.target)}`,
    `# approach: ${approachLabel(result)}`,
    `# seed: ${result.settings.seed}`,
    `# created: ${result.createdAt}`,
  ];
  const alternative = shown && result.alternatives?.[shown.alternative];
  if (alternative) lines.push(`# alternative: ${alternative.label} (${alternative.isDefault ? 'default' : 'selected'})`);
  if (result.acceptanceThreshold) {
    lines.push(`# acceptance threshold: ${result.acceptanceThreshold.value} (${result.acceptanceThreshold.source})`);
  }
  for (const repair of result.repairs ?? []) {
    lines.push(`# repair: ${repair.rule}: removed ${refList(repair.removed.sources)} -> ${refList(repair.removed.targets)} (${repair.removed.score.toFixed(3)})`);
  }
  lines.push(CSV_HEADER);
  for (const correspondence of alternative ? alternative.correspondences : result.correspondences) {
    lines.push(row(correspondence, ''));
    for (const child of correspondence.children ?? []) lines.push(row(child, correspondence.id));
  }
  return `${lines.join('\n')}\n`;
}
