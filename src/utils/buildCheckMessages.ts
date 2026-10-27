/**
 * Texts for the result of a VSUM build check, which also reports the constraint rule sets that
 * were built into the VSUM.
 */

const BUILD_SUCCESS = 'This VSUM can be built.';

const CONSTRAINT_FAILURE =
  'The constraints could not be built. Fix the rule set in Constraints mode and check the build again.';

/**
 * Messages of the setup-service that point to a problem in an OCL constraint file. A ".ocl" only
 * counts as file extension, so names like org.eclipse.ocl of dependencies do not match.
 */
const CONSTRAINT_FAILURE_PATTERN =
  /constraint file|\.ocl(?![\w.:\-/])|without metamodel|unknown metamodel/i;

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
 * Describes a failed build check, explaining failures caused by constraint rule sets.
 *
 * @param detail the error message of the build check
 */
export function describeBuildFailure(detail: string): BuildFailureDescription {
  if (CONSTRAINT_FAILURE_PATTERN.test(detail)) {
    return {
      message: `${CONSTRAINT_FAILURE}\n\n${detail}`,
      details: detail,
      constraintRelated: true,
    };
  }
  return { message: detail, constraintRelated: false };
}
