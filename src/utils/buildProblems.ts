import type {
  BuildFailure,
  BuildProblem,
  BuildProblemSource,
  VsumBuildErrorCode,
  VsumBuildResponse,
} from '../types/vsumBuild';
import { extractApiErrorMessage } from './apiErrorMessage';

/** Who has to act on a failed build: the user's models, the build environment, or the service. */
export type BuildFailureKind = 'models' | 'unavailable' | 'internal';

const BUILD_PROBLEM_SOURCES: ReadonlySet<string> = new Set<BuildProblemSource>([
  'METAMODEL',
  'REACTIONS',
  'CONSTRAINTS',
  'VIEWS',
  'INFRASTRUCTURE',
  'INTERNAL',
]);

const UNAVAILABLE_CODE: VsumBuildErrorCode = 'VSUM_BUILD_UNAVAILABLE';
const INTERNAL_CODE: VsumBuildErrorCode = 'VSUM_INTERNAL_ERROR';

const SOURCE_LABELS: Record<BuildProblemSource, string> = {
  METAMODEL: 'Metamodels',
  REACTIONS: 'Reactions',
  CONSTRAINTS: 'Constraints',
  VIEWS: 'Views',
  INFRASTRUCTURE: 'Build environment',
  INTERNAL: 'Setup service',
};

const HEADLINES: Record<BuildFailureKind, string> = {
  models: 'Your models need changes',
  unavailable: 'The build environment is temporarily unavailable, please try again later',
  internal: 'The setup service failed; this is not caused by your models',
};

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** Turns one raw entry of a `problems` array into a {@link BuildProblem}, or null if unusable. */
export function toBuildProblem(raw: unknown): BuildProblem | null {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as Record<string, unknown>;
  const message = optionalString(entry.message);
  if (!message) return null;
  const source = typeof entry.source === 'string' && BUILD_PROBLEM_SOURCES.has(entry.source)
    ? entry.source as BuildProblemSource
    : 'INTERNAL';
  const problem: BuildProblem = { source, message };
  const file = optionalString(entry.file);
  if (file) problem.file = file;
  if (typeof entry.fileId === 'number' && Number.isFinite(entry.fileId)) problem.fileId = entry.fileId;
  if (isPositiveInteger(entry.line)) problem.line = entry.line;
  if (isPositiveInteger(entry.column)) problem.column = entry.column;
  const excerpt = optionalString(entry.excerpt);
  if (excerpt) problem.excerpt = excerpt;
  const hint = optionalString(entry.hint);
  if (hint) problem.hint = hint;
  if (isPositiveInteger(entry.hiddenFollowUpErrors)) {
    problem.hiddenFollowUpErrors = entry.hiddenFollowUpErrors;
  }
  return problem;
}

/** Reads a `problems` array from a response, dropping malformed entries. */
export function normalizeBuildProblems(raw: unknown): BuildProblem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(entry => toBuildProblem(entry)).filter((p): p is BuildProblem => p !== null);
}

/** Reads the build failure carried by an API error (see `ApiService.createApiError`). */
export function buildFailureFromError(error: unknown, fallback: string): BuildFailure {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
  const body = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  return {
    errorCode: optionalString(body.errorCode),
    message: extractApiErrorMessage(error, fallback),
    problems: normalizeBuildProblems(body.problems),
  };
}

/** The failure of an asynchronous build, or null while it has not failed. */
export function buildFailureFromBuildResponse(
  build: VsumBuildResponse | null | undefined,
  fallback = 'The build failed.',
): BuildFailure | null {
  if (build?.status !== 'FAILED') return null;
  return {
    errorCode: optionalString(build.errorCode),
    message: optionalString(build.errorMessage) ?? fallback,
    problems: normalizeBuildProblems(build.problems),
  };
}

/**
 * Decides whom a failure is addressed to. `VSUM_BUILD_UNAVAILABLE` and `VSUM_INTERNAL_ERROR` win;
 * otherwise a failure whose problems all come from the build environment or the service is not
 * blamed on the models.
 */
export function getBuildFailureKind(failure: BuildFailure): BuildFailureKind {
  if (failure.errorCode === UNAVAILABLE_CODE) return 'unavailable';
  if (failure.errorCode === INTERNAL_CODE) return 'internal';
  if (failure.problems.length === 0) return 'models';
  if (failure.problems.every(p => p.source === 'INFRASTRUCTURE')) return 'unavailable';
  if (failure.problems.every(p => p.source === 'INFRASTRUCTURE' || p.source === 'INTERNAL')) {
    return 'internal';
  }
  return 'models';
}

export function getBuildFailureHeadline(kind: BuildFailureKind): string {
  return HEADLINES[kind];
}

export function getBuildProblemSourceLabel(source: BuildProblemSource): string {
  return SOURCE_LABELS[source];
}

/** "Line 51, column 30", "Line 51", or an empty string without a line. */
export function formatBuildProblemLocation(problem: BuildProblem): string {
  if (!problem.line) return '';
  return problem.column ? `Line ${problem.line}, column ${problem.column}` : `Line ${problem.line}`;
}

export function formatHiddenFollowUpErrors(count: number): string {
  return count === 1 ? '1 follow-up error hidden' : `${count} follow-up errors hidden`;
}

function hasExtension(file: string | undefined, extensions: readonly string[]): boolean {
  const lower = file?.toLowerCase() ?? '';
  return extensions.some(ext => lower.endsWith(ext));
}

export function isReactionsProblem(problem: BuildProblem): boolean {
  return problem.source === 'REACTIONS' || hasExtension(problem.file, ['.reactions']);
}

export function isMetamodelProblem(problem: BuildProblem): boolean {
  return problem.source === 'METAMODEL' || hasExtension(problem.file, ['.ecore', '.genmodel']);
}

/** Whether the UI can take the user to the file of the problem. */
export function isNavigableBuildProblem(problem: BuildProblem): boolean {
  return problem.fileId != null && (isReactionsProblem(problem) || isMetamodelProblem(problem));
}

export interface BuildProblemEntry {
  /** Stable React key, unique within the failure. */
  key: string;
  problem: BuildProblem;
}

export interface BuildProblemGroup {
  key: string;
  label: string;
  /** Whether the group is one uploaded file (as opposed to a source like "Build environment"). */
  isFile: boolean;
  entries: BuildProblemEntry[];
}

/** Groups problems by file, and problems without a file by their source, in order of appearance. */
export function groupBuildProblems(problems: readonly BuildProblem[]): BuildProblemGroup[] {
  const groups = new Map<string, BuildProblemGroup>();
  const seenKeys = new Map<string, number>();
  for (const problem of problems) {
    const groupKey = problem.file ? `file:${problem.file}` : `source:${problem.source}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        key: groupKey,
        label: problem.file ?? getBuildProblemSourceLabel(problem.source),
        isFile: Boolean(problem.file),
        entries: [],
      };
      groups.set(groupKey, group);
    }
    const baseKey = `${groupKey}:${problem.line ?? ''}:${problem.column ?? ''}:${problem.message}`;
    const occurrence = seenKeys.get(baseKey) ?? 0;
    seenKeys.set(baseKey, occurrence + 1);
    group.entries.push({ key: occurrence === 0 ? baseKey : `${baseKey}#${occurrence}`, problem });
  }
  return Array.from(groups.values());
}

/** Plain-text rendering of all problems, for copying into an issue or chat. */
export function formatBuildFailureAsText(failure: BuildFailure): string {
  if (failure.problems.length === 0) return failure.message;
  const lines: string[] = [getBuildFailureHeadline(getBuildFailureKind(failure))];
  for (const group of groupBuildProblems(failure.problems)) {
    lines.push('', `${group.label}:`);
    for (const { problem } of group.entries) {
      const location = formatBuildProblemLocation(problem);
      lines.push(location ? `- ${location}: ${problem.message}` : `- ${problem.message}`);
      if (problem.excerpt) lines.push(problem.excerpt);
      if (problem.hint) lines.push(`  Hint: ${problem.hint}`);
      if (problem.hiddenFollowUpErrors) {
        lines.push(`  (${formatHiddenFollowUpErrors(problem.hiddenFollowUpErrors)})`);
      }
    }
  }
  return lines.join('\n');
}
