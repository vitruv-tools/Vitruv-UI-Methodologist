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