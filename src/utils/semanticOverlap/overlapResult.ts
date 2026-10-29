import type { Correspondence, ElementRef, MetamodelRef, OverlapResult } from './types';

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
}

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
    ensure(value.kind === 'same' || value.kind === 'instance', `${field}.kind must be 'same' or 'instance'`);
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
    ensure(isObject(counts) && isCount(counts.same) && isCount(counts.instance), 'summary.kindCounts must be counts');
  }
  if (data.typeObjectPatterns !== undefined) {
    ensure(Array.isArray(data.typeObjectPatterns), 'typeObjectPatterns must be a list');
    data.typeObjectPatterns.forEach((pattern, k) => checkTypeObjectPattern(pattern, `typeObjectPatterns[${k}]`));
  }
  ensure(isObject(data.classMatrix) && Array.isArray(data.classMatrix.rows) && Array.isArray(data.classMatrix.columns)
    && Array.isArray(data.classMatrix.overall) && data.classMatrix.overall.every(isUnit), 'classMatrix is invalid');
  ensure(Array.isArray(data.correspondences), 'correspondences are missing');
  data.correspondences.forEach((c, k) => checkCorrespondence(c, `correspondences[${k}]`));
  ensure(isObject(data.unmatched) && Array.isArray(data.unmatched.source) && Array.isArray(data.unmatched.target), 'unmatched is missing');
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

/**
 * Flat CSV of a result: `#` comment lines with the compared metamodels, approach, seed and
 * creation time, then one row per class correspondence followed by its feature correspondences.
 */
export function overlapResultToCsv(result: OverlapResult): string {
  const row = (c: Correspondence, parent: string) => [
    c.level,
    parent,
    c.sources.map(ref => ref.qualifiedName).join('; '),
    c.targets.map(ref => ref.qualifiedName).join('; '),
    c.score.toFixed(3),
    c.scores.structural.toFixed(3),
    c.scores.syntactic.toFixed(3),
    c.kind ?? 'same',
    c.instance?.role ?? '',
  ].map(csvField).join(',');
  const lines = [
    `# Semantic overlap: ${metamodelLabel(result.source)} -> ${metamodelLabel(result.target)}`,
    `# approach: ${approachLabel(result)}`,
    `# seed: ${result.settings.seed}`,
    `# created: ${result.createdAt}`,
    CSV_HEADER,
  ];
  for (const correspondence of result.correspondences) {
    lines.push(row(correspondence, ''));
    for (const child of correspondence.children ?? []) lines.push(row(child, correspondence.id));
  }
  return `${lines.join('\n')}\n`;
}
