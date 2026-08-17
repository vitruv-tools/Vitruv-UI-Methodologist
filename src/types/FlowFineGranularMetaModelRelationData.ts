/**
 * Data attached to a fine-granular reaction edge in React Flow.
 *
 * Carried on `Edge.data` for edges with `type: 'fine-granular-reaction'`.
 */
export type FlowFineGranularMetaModelRelationData = {
  ecore: {
    eReferenceId?: string;
    eObjectSourceId: string;
    eObjectTargetId: string;
    fromModel: string;
    toModel: string;
    fromModelAlias?: string;
    toModelAlias?: string;
  };
  reactionFileId?: number;
};
