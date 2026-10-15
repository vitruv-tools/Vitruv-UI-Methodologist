import { formatEcoreMultiplicity, normalizeMultiplicityDisplay } from './umlMultiplicity';
import { applyUmlDiagramLayout } from './umlClassLayout';
import { GENMODEL_ANNOTATION_SOURCE } from './ecoreXmlNamespaces';
import { collectClassElements, getElementType, parseEcoreDocument } from './ecoreDocument';

export interface UMLAttribute {
  id: string;
  name: string;
  type: string;
  visibility: '+' | '-' | '#';
  documentation?: string;
}

export type UMLVisibility = UMLAttribute['visibility'];

export const UML_VISIBILITY_OPTIONS: readonly UMLVisibility[] = ['+', '-', '#'];

/** Ecore annotation source for UML visibility (+ / - / #). */
export const UML_VISIBILITY_ANNOTATION = 'uml.visibility';
/**
 * Ecore stores only the target end of a reference. The source end of a UML
 * association is kept in this annotation so a save does not reset it to 1.
 */
export const UML_SOURCE_MULTIPLICITY_ANNOTATION = 'uml.sourceMultiplicity';
/** Standard Ecore/GenModel annotation source for element documentation. */
export const ECORE_DOCUMENTATION_ANNOTATION = GENMODEL_ANNOTATION_SOURCE;

function directChildElements(element: Element, tagName: string): Element[] {
  const fromChildren = Array.from(element.children ?? []).filter(
    child => (child.localName || child.tagName) === tagName,
  );
  if (fromChildren.length > 0) return fromChildren;
  return Array.from(element.getElementsByTagName(tagName)).filter(
    node => node.parentElement === element,
  );
}

/** Ecore bound stored as an attribute or a child element (`lowerBound` / `upperBound`). */
export function readEcoreBound(
  element: Element,
  bound: 'lowerBound' | 'upperBound',
): string | null {
  const attribute = element.getAttribute(bound);
  if (attribute != null && attribute !== '') return attribute;
  for (const child of directChildElements(element, bound)) {
    const text = child.textContent?.trim();
    if (text) return text;
  }
  return null;
}

/** Feature name from an Ecore `eOpposite` such as `#//Course/students`. */
export function oppositeFeatureName(eOpposite: string | null): string | undefined {
  if (!eOpposite) return undefined;
  const cleaned = eOpposite.split('#').pop()?.replace(/^\/\//, '') ?? '';
  const name = cleaned.split('/').filter(Boolean).at(-1);
  return name || undefined;
}

/** Read documentation directly attached to this Ecore element. */
export function parseEcoreDocumentation(element: Element): string | undefined {
  for (const annotation of directChildElements(element, 'eAnnotations')) {
    if (annotation.getAttribute('source') !== ECORE_DOCUMENTATION_ANNOTATION) continue;
    for (const detail of directChildElements(annotation, 'details')) {
      if (detail.getAttribute('key') === 'documentation') {
        return detail.getAttribute('value') ?? '';
      }
    }
  }
  return undefined;
}

/** Source-end multiplicity stored on a reference, or undefined when it was not saved. */
export function parseAnnotatedSourceMultiplicity(element: Element): string | undefined {
  for (const annotation of directChildElements(element, 'eAnnotations')) {
    if (annotation.getAttribute('source') !== UML_SOURCE_MULTIPLICITY_ANNOTATION) continue;
    for (const detail of directChildElements(annotation, 'details')) {
      if (detail.getAttribute('key') !== 'value') continue;
      const value = normalizeMultiplicityDisplay(detail.getAttribute('value'));
      return value || undefined;
    }
  }
  return undefined;
}

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
  documentation?: string;
}

export interface UMLClass {
  id: string;       // stable id = sanitized original name
  name: string;     // display name (editable)
  isAbstract: boolean;
  isInterface: boolean;
  documentation?: string;
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
  documentation?: string;
  /** Feature name of the Ecore `eOpposite` on the target class, when this end is bidirectional. */
  opposite?: string;
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

/** Pick a name not already in `existingNames` (case-insensitive), adding 2, 3, … if needed. */
function nextUniqueName(existingNames: Iterable<string>, base: string, fallback: string): string {
  const taken = new Set(
    Array.from(existingNames, n => n.trim().toLowerCase()).filter(Boolean),
  );
  const root = base.trim() || fallback;
  if (!taken.has(root.toLowerCase())) return root;
  let suffix = 2;
  while (taken.has(`${root}${suffix}`.toLowerCase())) suffix++;
  return `${root}${suffix}`;
}

/** Pick a name that is not already used among class attributes (case-insensitive). */
export function nextUniqueAttributeName(
  existingNames: Iterable<string>,
  base = 'attribute',
): string {
  return nextUniqueName(existingNames, base, 'attribute');
}

/** Pick a unique operation name within a class (case-insensitive). */
export function nextUniqueOperationName(
  existingNames: Iterable<string>,
  base = 'operation',
): string {
  return nextUniqueName(existingNames, base, 'operation');
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
  documentation?: string;
  sourceMultiplicity?: string;
  opposite?: string;
}

const EMPTY_UML_MODEL: UMLModel = { classes: [], relationships: [] };

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
        lower: readEcoreBound(feat, 'lowerBound'),
        upper: readEcoreBound(feat, 'upperBound'),
        documentation: parseEcoreDocumentation(feat),
        sourceMultiplicity: parseAnnotatedSourceMultiplicity(feat),
        opposite: oppositeFeatureName(feat.getAttribute('eOpposite')),
      });
      continue;
    }

    if (!isPrimitiveAttributeType(typeName)) continue;

    attributes.push({
      id: `${id}-${attrIdx++}`,
      name: nextUniqueAttributeName(attributes.map(a => a.name), attrName),
      type: normalizeAttributeTypeDisplay(typeName),
      visibility: parseUmlVisibility(feat),
      documentation: parseEcoreDocumentation(feat),
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
      documentation: parseEcoreDocumentation(op),
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
    documentation: parseEcoreDocumentation(cls),
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

function buildReferenceMultiplicities(
  lower: string | null,
  upper: string | null,
  annotatedSource?: string,
): {
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
} {
  return {
    sourceMultiplicity: annotatedSource,
    targetMultiplicity: formatEcoreMultiplicity(lower, upper),
  };
}

function findOppositeRelationship(
  relationships: UMLRelationship[],
  relationship: UMLRelationship,
): UMLRelationship | undefined {
  if (relationship.type === 'inheritance' || !relationship.opposite) return undefined;
  return relationships.find(other => (
    other.id !== relationship.id
    && other.type !== 'inheritance'
    && other.sourceId === relationship.targetId
    && other.targetId === relationship.sourceId
    && other.label === relationship.opposite
  ));
}

/**
 * The source end of a reference is the target end of its `eOpposite`.
 * An explicit annotation wins so a saved edit is kept. Otherwise the
 * opposite bounds are used, and a reference with only its own bounds
 * keeps the historical source default of 1.
 */
function fillSourceMultiplicities(relationships: UMLRelationship[]): void {
  for (const relationship of relationships) {
    if (relationship.type === 'inheritance' || relationship.sourceMultiplicity) continue;
    const opposite = findOppositeRelationship(relationships, relationship);
    if (opposite?.targetMultiplicity) {
      relationship.sourceMultiplicity = opposite.targetMultiplicity;
      continue;
    }
    if (relationship.targetMultiplicity !== undefined) {
      relationship.sourceMultiplicity = '1';
    }
  }
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
      readEcoreBound(feat, 'lowerBound'),
      readEcoreBound(feat, 'upperBound'),
      parseAnnotatedSourceMultiplicity(feat),
    );
    const opposite = oppositeFeatureName(feat.getAttribute('eOpposite'));

    relationships.push({
      id: `rel-${relIdx.value++}`,
      sourceId,
      targetId,
      type: feat.getAttribute('containment') === 'true' ? 'composition' : 'association',
      label: feat.getAttribute('name') || undefined,
      documentation: parseEcoreDocumentation(feat),
      ...multiplicities,
      ...(opposite ? { opposite } : {}),
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

    const multiplicities = buildReferenceMultiplicities(
      ref.lower,
      ref.upper,
      ref.sourceMultiplicity,
    );
    relationships.push({
      id: `rel-${relIdx.value++}`,
      sourceId: ref.sourceId,
      targetId: ref.targetId,
      type: 'association',
      label: ref.name || undefined,
      documentation: ref.documentation,
      ...multiplicities,
      ...(ref.opposite ? { opposite: ref.opposite } : {}),
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
  fillSourceMultiplicities(relationships);
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
