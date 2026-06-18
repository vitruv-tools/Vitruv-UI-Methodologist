import {
  isPrimitiveAttributeType,
  UMLModel,
} from './ecoreToUml';

export interface UmlValidationIssue {
  severity: 'warning' | 'error';
  message: string;
}

export function validateUmlModel(model: UMLModel): UmlValidationIssue[] {
  const issues: UmlValidationIssue[] = [];
  const classNames = new Map<string, string>();

  for (const cls of model.classes) {
    const normalized = cls.name.trim().toLowerCase();
    if (!normalized) {
      issues.push({ severity: 'error', message: 'A class has an empty name' });
      continue;
    }
    if (classNames.has(normalized)) {
      issues.push({
        severity: 'warning',
        message: `Duplicate class name "${cls.name}"`,
      });
    } else {
      classNames.set(normalized, cls.id);
    }

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

  for (const rel of model.relationships) {
    if (rel.sourceId === rel.targetId) {
      issues.push({
        severity: 'error',
        message: 'A connection cannot link a class to itself',
      });
    }
    const source = model.classes.find(c => c.id === rel.sourceId);
    const target = model.classes.find(c => c.id === rel.targetId);
    if (!source || !target) {
      issues.push({
        severity: 'error',
        message: 'A connection references a missing class',
      });
    }
  }

  return issues;
}

export function hasUmlValidationErrors(issues: UmlValidationIssue[]): boolean {
  return issues.some(i => i.severity === 'error');
}
