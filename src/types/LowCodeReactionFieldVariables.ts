/**
 * Template variables resolved from the source/target EObject context.
 *
 * Used by FieldUtils.evaluateTemplate to interpolate default field
 * values that reference the connected Ecore elements.
 */
export type LowCodeReactionFieldVariables = {
  sourceModelUri: string;
  sourceModelAlias: string;
  sourceUri: string;
  sourceAlias: string;
  targetModelUri: string;
  targetModelAlias: string;
  targetUri: string;
  targetAlias: string;
};
