
/**
 * Edge payload describing a fine-granular relation in the flow diagram.
 */
export type FlowFineGranularMetaModelRelationData = {
  ecore: {
    eReferenceId?: string;
    eObjectSourceId: string;
    eObjectTargetId: string;
    fromModel: string;
    toModel: string;
  };
  reactionFileId?: number;
};

/**
 * Type guard for fine-granular relation edge payloads.
 * @param {unknown} data - Candidate value to validate.
 * @returns {boolean} True when the value matches FlowFineGranularMetaModelRelationData.
 */
export function isFlowFineGranularMetaModelRelationData(data: unknown): data is FlowFineGranularMetaModelRelationData {
  return (
    typeof data === "object" &&
    !!data &&
    typeof (data as FlowFineGranularMetaModelRelationData).ecore === "object" &&
    typeof (data as FlowFineGranularMetaModelRelationData).ecore.eObjectSourceId === "string" &&
    typeof (data as FlowFineGranularMetaModelRelationData).ecore.eObjectTargetId === "string" &&
    typeof (data as FlowFineGranularMetaModelRelationData).ecore.fromModel === "string" &&
    typeof (data as FlowFineGranularMetaModelRelationData).ecore.toModel === "string"
  );
}