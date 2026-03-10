
export type FlowFineGranularMetaModelRelationData = {
  ecore: {
    eReferenceId?: string;
    eObjectSourceId: string;
    eObjectTargetId: string;
    fromModel: string;
    toModel: string;
  };
};

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