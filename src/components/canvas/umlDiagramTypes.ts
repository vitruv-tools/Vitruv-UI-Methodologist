import type {
  UMLAttribute,
  UMLOperation,
  UMLRelType,
  UMLVisibility,
} from '../../utils/ecoreToUml';

export interface UmlDiagramClass {
  id: string;
  name: string;
  isAbstract: boolean;
  isInterface: boolean;
  documentation?: string;
  attributes: UMLAttribute[];
  operations: UMLOperation[];
  x: number;
  y: number;
}

interface UmlClassNameEditState {
  classId: string;
  kind: 'name';
  val: string;
}

export interface UmlAttributeEditState {
  classId: string;
  kind: 'attr';
  attrId: string;
  name: string;
  type: string;
  visibility: UMLVisibility;
  documentation?: string;
}

export interface UmlOperationEditState {
  classId: string;
  kind: 'op';
  opId: string;
  name: string;
  returnType: string;
  visibility: UMLVisibility;
  documentation?: string;
}

export type UmlDiagramEditState =
  | UmlClassNameEditState
  | UmlAttributeEditState
  | UmlOperationEditState;

export const UML_RELATIONSHIP_TYPE_LABELS: Record<UMLRelType, string> = {
  association: 'Association',
  composition: 'Composition',
  inheritance: 'Inheritance',
};
