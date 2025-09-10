import { Node, Edge } from 'reactflow';

export interface FlowNode extends Node {
  data: {
    label: string;
    onLabelChange?: (id: string, label: string) => void;
    ecoreData?: EcoreElementData;
  };
}

export type FlowEdge = Edge & {
};

export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export type NodeType = 'sequence' | 'object' | 'ecore';

export interface DragItem {
  type: NodeType;
  label: string;
}

export interface EcoreElementData {
  name: string;
  type: 'EClass' | 'EAttribute' | 'EReference' | 'EPackage' | 'EEnum' | 'EEnumLiteral';
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