import {
  nextUniqueAttributeName,
  nextUniqueOperationName,
  normalizeAttributeTypeDisplay,
  normalizeOperationReturnType,
  type UMLAttribute,
  type UMLOperation,
  type UMLRelationship,
  type UMLVisibility,
} from '../../utils/ecoreToUml';
import type { UmlDiagramClass } from './umlDiagramTypes';

export function nextUniqueClassName(
  existingNames: Iterable<string>,
): string {
  const taken = existingNames instanceof Set
    ? existingNames
    : new Set(existingNames);
  let candidate = 'NewClass';
  let suffix = 1;
  while (taken.has(candidate)) {
    candidate = `NewClass${suffix++}`;
  }
  return candidate;
}

function remapAttributeIds(
  attributes: readonly UMLAttribute[],
  classId: string,
): UMLAttribute[] {
  return attributes.map((attribute, index) => ({
    ...attribute,
    id: `${classId}-${index}`,
  }));
}

function remapOperationIds(
  operations: readonly UMLOperation[],
  classId: string,
): UMLOperation[] {
  return operations.map((operation, index) => ({
    ...operation,
    id: `${classId}-op-${index}`,
  }));
}

export function renameClassInList(
  classes: readonly UmlDiagramClass[],
  oldId: string,
  newId: string,
  trimmedName: string,
): UmlDiagramClass[] {
  return classes.map(classItem => {
    if (classItem.id !== oldId) return classItem;
    return {
      ...classItem,
      id: newId,
      name: trimmedName,
      attributes: remapAttributeIds(classItem.attributes, newId),
      operations: remapOperationIds(classItem.operations, newId),
    };
  });
}

export function renameClassInRelationships(
  relationships: readonly UMLRelationship[],
  oldId: string,
  newId: string,
): UMLRelationship[] {
  return relationships.map(relationship => ({
    ...relationship,
    sourceId: relationship.sourceId === oldId
      ? newId
      : relationship.sourceId,
    targetId: relationship.targetId === oldId
      ? newId
      : relationship.targetId,
  }));
}

export function updateClassById(
  classes: readonly UmlDiagramClass[],
  classId: string,
  updater: (classItem: UmlDiagramClass) => UmlDiagramClass,
): UmlDiagramClass[] {
  return classes.map(classItem =>
    (classItem.id === classId ? updater(classItem) : classItem),
  );
}

export function removeAttributeFromClass(
  classItem: UmlDiagramClass,
  attrId: string,
): UmlDiagramClass {
  return {
    ...classItem,
    attributes: classItem.attributes.filter(
      attribute => attribute.id !== attrId,
    ),
  };
}

export function removeOperationFromClass(
  classItem: UmlDiagramClass,
  opId: string,
): UmlDiagramClass {
  return {
    ...classItem,
    operations: classItem.operations.filter(
      operation => operation.id !== opId,
    ),
  };
}

function patchAttribute(
  attribute: UMLAttribute,
  attrId: string,
  resolvedName: string,
  type: string,
  visibility: UMLVisibility,
): UMLAttribute {
  if (attribute.id === attrId) {
    return {
      ...attribute,
      name: resolvedName,
      type: normalizeAttributeTypeDisplay(type.trim() || attribute.type),
      visibility,
    };
  }
  return attribute;
}

function getOtherAttributeNames(
  attributes: readonly UMLAttribute[],
  attrId: string,
): string[] {
  const otherNames: string[] = [];
  for (const attribute of attributes) {
    if (attribute.id !== attrId) otherNames.push(attribute.name);
  }
  return otherNames;
}

function applyAttributeSaveToClass(
  classItem: UmlDiagramClass,
  classId: string,
  attrId: string,
  name: string,
  type: string,
  visibility: UMLVisibility,
): UmlDiagramClass {
  if (classItem.id !== classId) return classItem;
  const current = classItem.attributes.find(
    attribute => attribute.id === attrId,
  );
  if (!current) return classItem;
  const otherNames = getOtherAttributeNames(classItem.attributes, attrId);
  const trimmed = name.trim();
  const resolvedName = trimmed
    ? nextUniqueAttributeName(otherNames, trimmed)
    : current.name;
  return {
    ...classItem,
    attributes: classItem.attributes.map(attribute =>
      patchAttribute(
        attribute,
        attrId,
        resolvedName,
        type,
        visibility,
      ),
    ),
  };
}

export function updateClassAttribute(
  classes: readonly UmlDiagramClass[],
  classId: string,
  attrId: string,
  name: string,
  type: string,
  visibility: UMLVisibility,
): UmlDiagramClass[] {
  return classes.map(classItem =>
    applyAttributeSaveToClass(
      classItem,
      classId,
      attrId,
      name,
      type,
      visibility,
    ),
  );
}

function patchOperation(
  operation: UMLOperation,
  opId: string,
  resolvedName: string,
  returnType: string,
  visibility: UMLVisibility,
): UMLOperation {
  if (operation.id === opId) {
    return {
      ...operation,
      name: resolvedName,
      returnType: normalizeOperationReturnType(
        returnType.trim() || operation.returnType,
      ),
      visibility,
    };
  }
  return operation;
}

function getOtherOperationNames(
  operations: readonly UMLOperation[],
  opId: string,
): string[] {
  const otherNames: string[] = [];
  for (const operation of operations) {
    if (operation.id !== opId) otherNames.push(operation.name);
  }
  return otherNames;
}

function applyOperationSaveToClass(
  classItem: UmlDiagramClass,
  classId: string,
  opId: string,
  name: string,
  returnType: string,
  visibility: UMLVisibility,
): UmlDiagramClass {
  if (classItem.id !== classId) return classItem;
  const current = classItem.operations.find(
    operation => operation.id === opId,
  );
  if (!current) return classItem;
  const otherNames = getOtherOperationNames(classItem.operations, opId);
  const trimmed = name.trim();
  const resolvedName = trimmed
    ? nextUniqueOperationName(otherNames, trimmed)
    : current.name;
  return {
    ...classItem,
    operations: classItem.operations.map(operation =>
      patchOperation(
        operation,
        opId,
        resolvedName,
        returnType,
        visibility,
      ),
    ),
  };
}

export function updateClassOperation(
  classes: readonly UmlDiagramClass[],
  classId: string,
  opId: string,
  name: string,
  returnType: string,
  visibility: UMLVisibility,
): UmlDiagramClass[] {
  return classes.map(classItem =>
    applyOperationSaveToClass(
      classItem,
      classId,
      opId,
      name,
      returnType,
      visibility,
    ),
  );
}

export function mergeAdditionalClassesWithPositions(
  previousClasses: readonly UmlDiagramClass[],
  newClasses: readonly UmlDiagramClass[],
): UmlDiagramClass[] {
  return newClasses.map(newClass => {
    const existing = previousClasses.find(
      previousClass => previousClass.id === newClass.id,
    );
    return existing
      ? { ...newClass, x: existing.x, y: existing.y }
      : newClass;
  });
}

export function applyWrapperDragToClass(
  classItem: UmlDiagramClass,
  origins: ReadonlyMap<string, { x: number; y: number }>,
  dx: number,
  dy: number,
): UmlDiagramClass {
  const origin = origins.get(classItem.id);
  if (!origin) return classItem;
  return {
    ...classItem,
    x: origin.x + dx,
    y: origin.y + dy,
  };
}
