import {
  isPrimitiveAttributeType,
  UMLClass,
  UMLModel,
  UMLRelationship,
} from './ecoreToUml';

export interface UmlValidationIssue {
  severity: 'warning' | 'error';
  message: string;
}

function validateClassName(
  cls: UMLClass,
  classNames: Map<string, string>,
  issues: UmlValidationIssue[],
): boolean {
  const normalized = cls.name.trim().toLowerCase();
  if (!normalized) {
    issues.push({ severity: 'error', message: 'A class has an empty name' });
    return false;
  }

  if (classNames.has(normalized)) {
    issues.push({
      severity: 'warning',
      message: `Duplicate class name "${cls.name}"`,
    });
  } else {
    classNames.set(normalized, cls.id);
  }

  return true;
}

function validateClassAttributes(cls: UMLClass, issues: UmlValidationIssue[]): void {
  const attrNames = new Set<string>();
  for (const attr of cls.attributes) {
    const attrKey = attr.name.trim().toLowerCase();
    if (!attrKey) continue;

    if (attrNames.has(attrKey)) {
      issues.push({
        severity: 'warning',
        message: `Class "${cls.name}": duplicate attribute "${attr.name}"`,
      });
    }
    attrNames.add(attrKey);

    if (!isPrimitiveAttributeType(attr.type)) {
      issues.push({
        severity: 'warning',
        message: `Class "${cls.name}": attribute "${attr.name}" must use a primitive type`,
      });
    }
  }
}

function validateClassOperations(cls: UMLClass, issues: UmlValidationIssue[]): void {
  const opNames = new Set<string>();
  for (const op of cls.operations ?? []) {
    const opKey = op.name.trim().toLowerCase();
    if (!opKey) continue;

    if (opNames.has(opKey)) {
      issues.push({
        severity: 'warning',
        message: `Class "${cls.name}": duplicate operation "${op.name}"`,
      });
    }
    opNames.add(opKey);
  }
}

function validateClass(
  cls: UMLClass,
  classNames: Map<string, string>,
  issues: UmlValidationIssue[],
): void {
  if (!validateClassName(cls, classNames, issues)) return;

  validateClassAttributes(cls, issues);
  validateClassOperations(cls, issues);
}

function validateRelationship(
  rel: UMLRelationship,
  classes: UMLClass[],
  issues: UmlValidationIssue[],
): void {
  if (rel.sourceId === rel.targetId) {
    issues.push({
      severity: 'error',
      message: 'A connection cannot link a class to itself',
    });
  }

  const hasSource = classes.some(c => c.id === rel.sourceId);
  const hasTarget = classes.some(c => c.id === rel.targetId);
  if (!hasSource || !hasTarget) {
    issues.push({
      severity: 'error',
      message: 'A connection references a missing class',
    });
  }
}

export function validateUmlModel(model: UMLModel, allClasses?: UMLClass[]): UmlValidationIssue[] {
  const issues: UmlValidationIssue[] = [];
  const classNames = new Map<string, string>();

  model.classes.forEach(cls => validateClass(cls, classNames, issues));
  const relClasses = allClasses ?? model.classes;
  model.relationships.forEach(rel => validateRelationship(rel, relClasses, issues));

  return issues;
}

export function hasUmlValidationErrors(issues: UmlValidationIssue[]): boolean {
  return issues.some(i => i.severity === 'error');
}
