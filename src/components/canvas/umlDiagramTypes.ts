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
}

export interface UmlOperationEditState {
  classId: string;
  kind: 'op';
  opId: string;
  name: string;
  returnType: string;
  visibility: UMLVisibility;
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
