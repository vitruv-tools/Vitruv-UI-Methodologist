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
  return name.replace(/\W/g, '_');
}

function parseTypeName(eType: string): string {
  const cleaned = eType.split('#').pop() || eType;
  const parts = cleaned.replace(/^\/\//, '').split('/');
  return parts.at(-1) || 'Unknown';
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

const EMPTY_UML_MODEL: UMLModel = { classes: [], relationships: [] };

function parseEcoreDocument(ecoreContent: string): Document | null {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(ecoreContent, 'text/xml');
  if (xmlDoc.getElementsByTagName('parsererror').length > 0) return null;
  return xmlDoc;
}

function getElementType(el: Element): string {
  return el.getAttribute('xsi:type') || el.getAttribute('type') || '';
}

function isEClassElement(el: Element): boolean {
  const type = getElementType(el);
  return type.includes('EClass') || (!type && el.querySelectorAll('eStructuralFeatures').length > 0);
}

function collectClassElements(xmlDoc: Document): Element[] {
  return Array.from(xmlDoc.querySelectorAll('eClassifiers')).filter(isEClassElement);
}

function buildClassIdSet(classElems: Element[]): Set<string> {
  return new Set(classElems.map(cls => sanitize(cls.getAttribute('name') || 'Unknown')));
}

function parseClassAttributes(
  cls: Element,
  id: string,
  classIds: Set<string>,
  deferredClassRefs: DeferredClassRef[],
): UMLAttribute[] {
  const attributes: UMLAttribute[] = [];
  let attrIdx = 0;

  for (const feat of cls.querySelectorAll('eStructuralFeatures')) {
    if (getElementType(feat).includes('EReference')) continue;

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

    attributes.push({
      id: `${id}-${attrIdx++}`,
      name: nextUniqueAttributeName(attributes.map(a => a.name), attrName),
      type: normalizeAttributeTypeDisplay(typeName),
      visibility: parseUmlVisibility(feat),
    });
  }

  return attributes;
}

function parseClassOperations(cls: Element, id: string): UMLOperation[] {
  const operations: UMLOperation[] = [];
  let opIdx = 0;

  for (const op of cls.querySelectorAll('eOperations')) {
    const opName = op.getAttribute('name') || 'operation';
    const typeName = parseTypeName(op.getAttribute('eType') || '//EVoid');
    operations.push({
      id: `${id}-op-${opIdx++}`,
      name: nextUniqueOperationName(operations.map(o => o.name), opName),
      returnType: normalizeOperationReturnType(typeName),
      visibility: parseUmlVisibility(op),
    });
  }

  return operations;
}

function buildUmlClass(
  cls: Element,
  classIds: Set<string>,
  deferredClassRefs: DeferredClassRef[],
): UMLClass {
  const rawName = cls.getAttribute('name') || 'Unknown';
  const id = sanitize(rawName);

  return {
    id,
    name: rawName,
    isAbstract: cls.getAttribute('abstract') === 'true',
    isInterface: cls.getAttribute('interface') === 'true',
    attributes: parseClassAttributes(cls, id, classIds, deferredClassRefs),
    operations: parseClassOperations(cls, id),
    x: 0,
    y: 0,
  };
}

function buildClassMap(
  classElems: Element[],
  classIds: Set<string>,
): { classMap: Map<string, UMLClass>; deferredClassRefs: DeferredClassRef[] } {
  const classMap = new Map<string, UMLClass>();
  const deferredClassRefs: DeferredClassRef[] = [];

  classElems.forEach(cls => {
    const umlClass = buildUmlClass(cls, classIds, deferredClassRefs);
    classMap.set(umlClass.id, umlClass);
  });

  return { classMap, deferredClassRefs };
}

function buildReferenceMultiplicities(lower: string | null, upper: string | null): {
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
} {
  const targetMultiplicity = formatEcoreMultiplicity(lower, upper);
  return {
    sourceMultiplicity: targetMultiplicity === undefined ? undefined : '1',
    targetMultiplicity,
  };
}

function isValidRelationshipTarget(
  sourceId: string,
  targetId: string,
  classMap: Map<string, UMLClass>,
): boolean {
  return Boolean(targetId && targetId !== sourceId && classMap.has(targetId));
}

function appendInheritanceRelationships(
  relationships: UMLRelationship[],
  relIdx: { value: number },
  cls: Element,
  sourceId: string,
  classMap: Map<string, UMLClass>,
): void {
  const superTypes = cls.getAttribute('eSuperTypes');
  if (!superTypes) return;

  for (const superType of superTypes.trim().split(/\s+/)) {
    const parentId = sanitize(parseTypeName(superType));
    if (!isValidRelationshipTarget(sourceId, parentId, classMap)) continue;

    relationships.push({
      id: `rel-${relIdx.value++}`,
      sourceId,
      targetId: parentId,
      type: 'inheritance',
    });
  }
}

function appendReferenceRelationships(
  relationships: UMLRelationship[],
  relIdx: { value: number },
  cls: Element,
  sourceId: string,
  classMap: Map<string, UMLClass>,
): void {
  for (const feat of cls.querySelectorAll('eStructuralFeatures')) {
    if (!getElementType(feat).includes('EReference')) continue;

    const targetId = sanitize(parseTypeName(feat.getAttribute('eType') || ''));
    if (!isValidRelationshipTarget(sourceId, targetId, classMap)) continue;

    const multiplicities = buildReferenceMultiplicities(
      feat.getAttribute('lowerBound'),
      feat.getAttribute('upperBound'),
    );

    relationships.push({
      id: `rel-${relIdx.value++}`,
      sourceId,
      targetId,
      type: feat.getAttribute('containment') === 'true' ? 'composition' : 'association',
      label: feat.getAttribute('name') || undefined,
      ...multiplicities,
    });
  }
}

function appendDeferredRelationships(
  relationships: UMLRelationship[],
  relIdx: { value: number },
  deferredClassRefs: DeferredClassRef[],
  classMap: Map<string, UMLClass>,
): void {
  for (const ref of deferredClassRefs) {
    if (!classMap.has(ref.sourceId) || !classMap.has(ref.targetId)) continue;
    if (ref.sourceId === ref.targetId) continue;

    const multiplicities = buildReferenceMultiplicities(ref.lower, ref.upper);
    relationships.push({
      id: `rel-${relIdx.value++}`,
      sourceId: ref.sourceId,
      targetId: ref.targetId,
      type: 'association',
      label: ref.name || undefined,
      ...multiplicities,
    });
  }
}

function buildRelationships(
  classElems: Element[],
  classMap: Map<string, UMLClass>,
  deferredClassRefs: DeferredClassRef[],
): UMLRelationship[] {
  const relationships: UMLRelationship[] = [];
  const relIdx = { value: 0 };

  classElems.forEach(cls => {
    const sourceId = sanitize(cls.getAttribute('name') || 'Unknown');
    appendInheritanceRelationships(relationships, relIdx, cls, sourceId, classMap);
    appendReferenceRelationships(relationships, relIdx, cls, sourceId, classMap);
  });

  appendDeferredRelationships(relationships, relIdx, deferredClassRefs, classMap);
  return relationships;
}

export function ecoreToUml(ecoreContent: string): UMLModel {
  try {
    const xmlDoc = parseEcoreDocument(ecoreContent);
    if (!xmlDoc) return EMPTY_UML_MODEL;

    const classElems = collectClassElements(xmlDoc);
    if (classElems.length === 0) return EMPTY_UML_MODEL;

    const classIds = buildClassIdSet(classElems);
    const { classMap, deferredClassRefs } = buildClassMap(classElems, classIds);
    const relationships = buildRelationships(classElems, classMap, deferredClassRefs);
    const classes = Array.from(classMap.values());

    applyUmlDiagramLayout(classes, relationships);
    return { classes, relationships };
  } catch {
    return EMPTY_UML_MODEL;
  }
}
