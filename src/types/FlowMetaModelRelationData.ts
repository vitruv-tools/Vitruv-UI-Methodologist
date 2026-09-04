/**
 * Data attached to a coarse-grained reaction edge in React Flow.
 *
 * Carried on `Edge.data` for edges with `type: 'reactions'`.
 */
export type FlowMetaModelRelationData = {
  relationshipType: string;
  reactionFileId?: number;
  reactionFileStorageId?: number;
};
