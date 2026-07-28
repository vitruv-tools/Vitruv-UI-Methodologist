import type {
  UMLAttribute,
  UMLOperation,
  UMLRelType,
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

export const UML_RELATIONSHIP_TYPE_LABELS: Record<UMLRelType, string> = {
  association: 'Association',
  composition: 'Composition',
  inheritance: 'Inheritance',
};
