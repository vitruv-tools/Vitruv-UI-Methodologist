/**
 * Optional edge payload carrying backend and frontend meta model ids.
 */
export type FlowMetaModelRelationData = Partial<{
    /**
     * Backend meta model source id
     */
    sourceMetaModelId: number;
    /**
     * Backend meta model target id
     */
    targetMetaModelId: number;
    /**
     * Frontend meta model source flow node id
     */
    sourceMetaModelSourceId: number;
    /**
     * Frontend meta model target flow node id
     */
    targetMetaModelSourceId: number;
}>;

/**
 * Type guard for meta-model relation edge payloads.
 * @param {unknown} data - Candidate value to validate.
 * @returns {boolean} True when the value matches FlowMetaModelRelationData.
 */
export function isFlowMetaModelRelationData(data: unknown) : data is FlowMetaModelRelationData {
    return (
        typeof data === "object" &&
        !!data &&
        typeof (data as FlowMetaModelRelationData) === "object" &&
        typeof (data as FlowMetaModelRelationData).sourceMetaModelId === "number" &&
        typeof (data as FlowMetaModelRelationData).targetMetaModelId === "number" &&
        typeof (data as FlowMetaModelRelationData).sourceMetaModelSourceId === "number" &&
        typeof (data as FlowMetaModelRelationData).targetMetaModelSourceId === "number"
    );
}