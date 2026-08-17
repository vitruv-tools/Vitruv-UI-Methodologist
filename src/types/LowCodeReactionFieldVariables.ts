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
  /** Backend templates often use model1/model2 field names. */
  model1Uri: string;
  model2Uri: string;
  model1Alias: string;
  model2Alias: string;
  model1RootType: string;
  model2RootType: string;
  model1RootVar: string;
  model2RootVar: string;
};
