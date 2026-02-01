import type { EObject } from "ecore-ts";
import { Node, Edge } from "reactflow";

export type FlowNodeECoreData = {
  model: string;
  eObjectId: string;
};

export interface FlowNode extends Node {
  data: {
    label: string;
    onLabelChange?: (id: string, label: string) => void;
    ecoreData?: EcoreElementData;
    ecore?: FlowNodeECoreData;
    isBoundingBox?: boolean;
    group?: string;
  };
}

export type FlowEdgeECoreData = {
  eReferenceId?: string;
  eObjectSourceId: string;
  eObjectTargetId: string;
  fromModel: string;
  toModel: string;
}

export type FlowEdgeData = {
  relationshipType: string;
  targetMultiplicity?: string;
  ecore?: FlowEdgeECoreData;
  reactionNodeIdNumber?: number;
  labelX?: number;
  labelY?: number;
};
export type FlowEdge = Edge<FlowEdgeData>;

export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export type NodeType = "sequence" | "object" | "ecore";

export interface DragItem {
  type: NodeType;
  label: string;
}

export interface EcoreElementData {
  name: string;
  type:
    | "EClass"
    | "EAttribute"
    | "EReference"
    | "EPackage"
    | "EEnum"
    | "EEnumLiteral";
  attributes?: EcoreAttribute[];
  references?: EcoreReference[];
  operations?: EcoreOperation[];
  package?: string;
  superTypes?: string[];
  isAbstract?: boolean;
  isInterface?: boolean;
}

export interface EcoreAttribute {
  name: string;
  type: string;
  multiplicity: string;
  isRequired: boolean;
  defaultValue?: string;
}

export interface EcoreReference {
  name: string;
  type: string;
  multiplicity: string;
  isContainment: boolean;
  isRequired: boolean;
}

export interface EcoreOperation {
  name: string;
  parameters: EcoreParameter[];
  returnType: string;
  isAbstract: boolean;
}

export interface EcoreParameter {
  name: string;
  type: string;
  multiplicity: string;
}

export interface EcoreFileContent {
  name: string;
  nsURI: string;
  nsPrefix: string;
  packages: EcorePackage[];
}

export interface EcorePackage {
  name: string;
  nsURI: string;
  nsPrefix: string;
  classes: EcoreElementData[];
  packages: EcorePackage[];
}

export type OnEdgeClickParams = OnEdgeClickParamsExtension & OnEdgeClickParamsDefault;

export type OnEdgeClickParamsExtension = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  identifiersToEObject: Map<string, EObject>;
  setUmlEdgeDetailsEdge: (edge: FlowEdge | null) => void;
  setReactionEditorEdge: (edge: FlowEdge | null) => void;
};

export type OnEdgeClickParamsDefault = {
  edge: FlowEdge,
  event: React.MouseEvent,
};