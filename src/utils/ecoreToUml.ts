import { formatEcoreMultiplicity } from './umlMultiplicity';
import { applyUmlDiagramLayout } from './umlClassLayout';

export interface UMLAttribute {
  id: string;
  name: string;
  type: string;
  visibility: '+' | '-' | '#';
}

export type UMLVisibility = UMLAttribute['visibility'];

export const UML_VISIBILITY_OPTIONS: readonly UMLVisibility[] = ['+', '-', '#'];

/** Ecore annotation source for UML visibility (+ / - / #). */
export const UML_VISIBILITY_ANNOTATION = 'uml.visibility';

export function parseUmlVisibility(element: Element): UMLVisibility {
  for (const ann of element.querySelectorAll('eAnnotations')) {
    if (ann.getAttribute('source') !== UML_VISIBILITY_ANNOTATION) continue;
    for (const det of ann.querySelectorAll('details')) {
      if (det.getAttribute('key') !== 'symbol') continue;
      const value = det.getAttribute('value');
      if (value === '+' || value === '-' || value === '#') return value;
    }
  }
  return '+';
}

export interface UMLOperation {
  id: string;
  name: string;
  returnType: string;
  visibility: UMLVisibility;
}

export interface UMLClass {
  id: string;       // stable id = sanitized original name
  name: string;     // display name (editable)
  isAbstract: boolean;
  isInterface: boolean;
  attributes: UMLAttribute[];
  operations: UMLOperation[];
  x: number;
  y: number;
}

export type UMLRelType = 'inheritance' | 'composition' | 'association';

export interface UMLRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: UMLRelType;
  label?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
}

export interface UMLModel {
  classes: UMLClass[];
  relationships: UMLRelationship[];
}

/** Primitive attribute types shown in the UML editor dropdown. */
export const UML_PRIMITIVE_ATTRIBUTE_TYPES = [
  'String',
  'Int',
  'Boolean',
  'Float',
  'Double',
  'Long',
  'Short',
  'Char',
  'Byte',
  'Date',
] as const;

export const UML_OPERATION_RETURN_TYPES = [...UML_PRIMITIVE_ATTRIBUTE_TYPES, 'Void'] as const;

const ETYPE_TO_DISPLAY: Record<string, string> = {
  EString: 'String',
  EInt: 'Int',
  EBoolean: 'Boolean',
  EFloat: 'Float',
  EDouble: 'Double',
  ELong: 'Long',
  EShort: 'Short',
  EChar: 'Char',
  EByte: 'Byte',
  EDate: 'Date',
};

/** Map ecore type names (EString) to editor labels (String). */
export function normalizeAttributeTypeDisplay(type: string): string {
  const display = ETYPE_TO_DISPLAY[type] ?? type;
  return isPrimitiveAttributeType(display) ? display : 'String';
}

/** UML attributes may only use built-in primitive types — not class names. */
export function isPrimitiveAttributeType(type: string): boolean {
  const normalized = ETYPE_TO_DISPLAY[type] ?? type;
  return (UML_PRIMITIVE_ATTRIBUTE_TYPES as readonly string[]).includes(normalized);
}

/** Primitive types only — class names are modeled as associations, not attribute types. */
export function buildAttributeTypeOptions(currentType?: string): string[] {
  const options = [...UML_PRIMITIVE_ATTRIBUTE_TYPES];
  const normalized = currentType ? normalizeAttributeTypeDisplay(currentType) : undefined;
  if (normalized && !options.includes(normalized as typeof options[number])) {
    options.push(normalized as typeof options[number]);
  }
  return options;
}

export function normalizeOperationReturnType(type: string): string {
  if (type === 'EVoid' || type === 'Void') return 'Void';
  const display = normalizeAttributeTypeDisplay(type);
  return (UML_OPERATION_RETURN_TYPES as readonly string[]).includes(display) ? display : 'Void';
}

export function buildOperationReturnTypeOptions(currentType?: string): string[] {
  const options = [...UML_OPERATION_RETURN_TYPES];
  const normalized = currentType ? normalizeOperationReturnType(currentType) : undefined;
  if (normalized && !options.includes(normalized as typeof options[number])) {
    options.push(normalized as typeof options[number]);
  }
  return options;
}

/** Pick a name that is not already used among class attributes (case-insensitive). */
export function nextUniqueAttributeName(
  existingNames: Iterable<string>,
  base = 'attribute',
): string {
  const taken = new Set(
    Array.from(existingNames, n => n.trim().toLowerCase()).filter(Boolean),
  );
  const root = base.trim() || 'attribute';
  if (!taken.has(root.toLowerCase())) return root;
  let suffix = 2;
  while (taken.has(`${root}${suffix}`.toLowerCase())) suffix++;
  return `${root}${suffix}`;
}

/** Pick a unique operation name within a class (case-insensitive). */
export function nextUniqueOperationName(
  existingNames: Iterable<string>,
  base = 'operation',
): string {
  const taken = new Set(
    Array.from(existingNames, n => n.trim().toLowerCase()).filter(Boolean),
  );
  const root = base.trim() || 'operation';
  if (!taken.has(root.toLowerCase())) return root;
  let suffix = 2;
  while (taken.has(`${root}${suffix}`.toLowerCase())) suffix++;
  return `${root}${suffix}`;
}

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

function parseTypeName(eType: string): string {
  const cleaned = eType.split('#').pop() || eType;
  const parts = cleaned.replace(/^\/\//, '').split('/');
  return parts[parts.length - 1] || 'Unknown';
}

function isClassTypeReference(eType: string, classIds: Set<string>): boolean {
  if (!eType.includes('#')) return false;
  const targetId = sanitize(parseTypeName(eType));
  return classIds.has(targetId);
}

interface DeferredClassRef {
  sourceId: string;
  targetId: string;
  name: string;
  lower: string | null;
  upper: string | null;
}

export function ecoreToUml(ecoreContent: string): UMLModel {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(ecoreContent, 'text/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      return { classes: [], relationships: [] };
    }

    const classElems = Array.from(xmlDoc.querySelectorAll('eClassifiers')).filter(el => {
      const t = el.getAttribute('xsi:type') || el.getAttribute('type') || '';
      return t.includes('EClass') || (!t && el.querySelectorAll('eStructuralFeatures').length > 0);
    });

    if (classElems.length === 0) return { classes: [], relationships: [] };

    const classIds = new Set(
      classElems.map(cls => sanitize(cls.getAttribute('name') || 'Unknown')),
    );
    const classMap = new Map<string, UMLClass>();
    const deferredClassRefs: DeferredClassRef[] = [];

    classElems.forEach((cls) => {
      const rawName = cls.getAttribute('name') || 'Unknown';
      const id = sanitize(rawName);

      const attributes: UMLAttribute[] = [];
      let attrIdx = 0;
      for (const feat of cls.querySelectorAll('eStructuralFeatures')) {
        const fType = feat.getAttribute('xsi:type') || feat.getAttribute('type') || '';
        if (fType.includes('EReference')) continue;

        const attrName = feat.getAttribute('name') || 'attr';
        const eType = feat.getAttribute('eType') || 'EString';
        const typeName = parseTypeName(eType);

        if (isClassTypeReference(eType, classIds)) {
          deferredClassRefs.push({
            sourceId: id,
            targetId: sanitize(typeName),
            name: attrName,
            lower: feat.getAttribute('lowerBound'),
            upper: feat.getAttribute('upperBound'),
          });
          continue;
        }

        if (!isPrimitiveAttributeType(typeName)) continue;

        const uniqueName = nextUniqueAttributeName(
          attributes.map(a => a.name),
          attrName,
        );

        attributes.push({
          id: `${id}-${attrIdx++}`,
          name: uniqueName,
          type: normalizeAttributeTypeDisplay(typeName),
          visibility: parseUmlVisibility(feat),
        });
      }

      const operations: UMLOperation[] = [];
      let opIdx = 0;
      for (const op of cls.querySelectorAll('eOperations')) {
        const opName = op.getAttribute('name') || 'operation';
        const eType = op.getAttribute('eType') || '//EVoid';
        const typeName = parseTypeName(eType);
        const uniqueOpName = nextUniqueOperationName(
          operations.map(o => o.name),
          opName,
        );
        operations.push({
          id: `${id}-op-${opIdx++}`,
          name: uniqueOpName,
          returnType: normalizeOperationReturnType(typeName),
          visibility: parseUmlVisibility(op),
        });
      }

      classMap.set(id, {
        id,
        name: rawName,
        isAbstract: cls.getAttribute('abstract') === 'true',
        isInterface: cls.getAttribute('interface') === 'true',
        attributes,
        operations,
        x: 0,
        y: 0,
      });
    });

    const relationships: UMLRelationship[] = [];
    let relIdx = 0;

    for (const cls of classElems) {
      const id = sanitize(cls.getAttribute('name') || 'Unknown');

      const superTypes = cls.getAttribute('eSuperTypes');
      if (superTypes) {
        for (const st of superTypes.trim().split(/\s+/)) {
          const parentId = sanitize(parseTypeName(st));
          if (parentId && parentId !== id && classMap.has(parentId)) {
            relationships.push({
              id: `rel-${relIdx++}`,
              sourceId: id,
              targetId: parentId,
              type: 'inheritance',
            });
          }
        }
      }

      for (const feat of cls.querySelectorAll('eStructuralFeatures')) {
        const fType = feat.getAttribute('xsi:type') || feat.getAttribute('type') || '';
        if (!fType.includes('EReference')) continue;
        const refName = feat.getAttribute('name') || '';
        const eType = feat.getAttribute('eType') || '';
        const targetId = sanitize(parseTypeName(eType));
        if (targetId && targetId !== id && classMap.has(targetId)) {
          const lower = feat.getAttribute('lowerBound');
          const upper = feat.getAttribute('upperBound');
          const targetMultiplicity = formatEcoreMultiplicity(lower, upper);
          const sourceMultiplicity = targetMultiplicity !== undefined ? '1' : undefined;
          relationships.push({
            id: `rel-${relIdx++}`,
            sourceId: id,
            targetId,
            type: feat.getAttribute('containment') === 'true' ? 'composition' : 'association',
            label: refName || undefined,
            sourceMultiplicity,
            targetMultiplicity,
          });
        }
      }
    }

    for (const ref of deferredClassRefs) {
      if (!classMap.has(ref.sourceId) || !classMap.has(ref.targetId)) continue;
      if (ref.sourceId === ref.targetId) continue;
      const targetMultiplicity = formatEcoreMultiplicity(ref.lower, ref.upper);
      relationships.push({
        id: `rel-${relIdx++}`,
        sourceId: ref.sourceId,
        targetId: ref.targetId,
        type: 'association',
        label: ref.name || undefined,
        sourceMultiplicity: targetMultiplicity !== undefined ? '1' : undefined,
        targetMultiplicity,
      });
    }

    const classes = Array.from(classMap.values());
    applyUmlDiagramLayout(classes, relationships);

    return { classes, relationships };
  } catch {
    return { classes: [], relationships: [] };
  }
}
