/**
 * A single fine-granular (EObject-level) relation between two meta-model elements.
 *
 * `id: null` indicates a newly created relation that has not been persisted yet.
 * `lowCodeReactionRequestBase` holds the form state from the Low Code editor.
 */
export type EditableFineGranularMetaModelRelation = {
  id: number | null;
  sourceId: string;
  targetId: string;
  reactionFileStorageId?: number;
  lowCodeReactionRequestBase?: { [key: string]: unknown };
};
