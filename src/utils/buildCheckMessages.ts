/**
 * Texts for the result of a VSUM build check, which also reports the constraint rule sets that
 * were built into the VSUM.
 */

const BUILD_SUCCESS = 'This VSUM can be built.';

const CONSTRAINT_FAILURE =
  'The constraints could not be built. Fix the rule set in Constraints mode and check the build again.';

/**
 * Messages of the setup-service that point to a problem in an OCL constraint file. A ".ocl" only
 * counts as file extension, so names like org.eclipse.ocl of dependencies do not match; the
 * problems of a file are listed below a line "<file>.ocl:".
 */
const CONSTRAINT_FAILURE_PATTERN =
  /constraint file|\.ocl(?![\w.:\-/])|\.ocl:[ \t]*$|without metamodel|unknown metamodel/im;

/** Prefix the backend puts in front of the answer of the setup-service. */
const SETUP_SERVICE_PREFIX = /^Setup-service request to '[^']*' failed with status [^:]*:\s*/;

/** The name of a constraint file, which is the name of its rule set followed by ".ocl". */
const CONSTRAINT_FILE = /Constraint file (.+?)\.ocl\b/g;

/** The line above the problems of a constraint file. */
const CONSTRAINT_FILE_HEADER = /^(.+?)\.ocl:[ \t]*$/gm;

/** Result of describing a failed build check. */
export interface BuildFailureDescription {
  /** The text to show, which contains the original error. */
  message: string;
  /** The original error alone, e.g. to copy it. */
  details?: string;
  /** Whether the build failed because of a constraint rule set. */
  constraintRelated: boolean;
}

/**
 * Describes a successful build check.
 *
 * @param constraintRuleSets the names of the rule sets built into the VSUM, or undefined/null if
 *     the backend did not report them, e.g. because they changed during the build
 */
export function describeBuildSuccess(constraintRuleSets: string[] | null | undefined): string {
  if (!constraintRuleSets) return BUILD_SUCCESS;
  if (constraintRuleSets.length === 0) return `${BUILD_SUCCESS} It has no constraint rule sets.`;
  const label = constraintRuleSets.length === 1 ? 'constraint rule set' : 'constraint rule sets';
  return `${BUILD_SUCCESS} It includes ${constraintRuleSets.length} ${label}: ${constraintRuleSets.join(', ')}.`;
}

/**
 * Extracts the reason from an error of the setup-service, without the request and the JSON around
 * it, and names rule sets instead of their files, e.g. 'Rule set "Prices" declares context(s)
 * [Item] without metamodel; …'.
 */
function readableConstraintReason(detail: string): string {
  const reason = setupServiceMessage(detail) ?? detail.replace(SETUP_SERVICE_PREFIX, '');
  return reason
    .replace(CONSTRAINT_FILE, (_match, name: string) => `Rule set "${name}"`)
    .replace(CONSTRAINT_FILE_HEADER, (_match, name: string) => `Rule set "${name}":`)
    .trim();
}

/** Returns the "message" of the JSON error body of the setup-service, if the detail contains one. */
function setupServiceMessage(detail: string): string | undefined {
  const start = detail.indexOf('{');
  const end = detail.lastIndexOf('}');
  if (start < 0 || end < start) return undefined;
  try {
    const body: unknown = JSON.parse(detail.slice(start, end + 1));
    const message = (body as { message?: unknown } | null)?.message;
    return typeof message === 'string' && message.trim() ? message : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Describes a failed build check, explaining failures caused by constraint rule sets. For those,
 * only the reason is shown; the original error stays available in the details, e.g. to copy it.
 *
 * @param detail the error message of the build check
 */
export function describeBuildFailure(detail: string): BuildFailureDescription {
  if (CONSTRAINT_FAILURE_PATTERN.test(detail)) {
    return {
      message: `${CONSTRAINT_FAILURE}\n\n${readableConstraintReason(detail)}`,
      details: detail,
      constraintRelated: true,
    };
  }
  return { message: detail, constraintRelated: false };
}
