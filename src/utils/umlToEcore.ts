import {
  isPrimitiveAttributeType,
  normalizeAttributeTypeDisplay,
  normalizeOperationReturnType,
  ECORE_DOCUMENTATION_ANNOTATION,
  UML_SOURCE_MULTIPLICITY_ANNOTATION,
  UML_VISIBILITY_ANNOTATION,
  UMLAttribute,
  UMLClass,
  UMLModel,
  UMLOperation,
  UMLRelationship,
  UMLVisibility,
} from './ecoreToUml';
import { ECORE_XML_NAMESPACE, XSI_XML_NAMESPACE } from './ecoreXmlNamespaces';
import { normalizeMultiplicityDisplay, parseMultiplicity } from './umlMultiplicity';

const ECORE_NS = ECORE_XML_NAMESPACE;
const XSI_NS = XSI_XML_NAMESPACE;

/** Reference to a built-in Ecore data type, e.g. `ecore:EDataType http://…/Ecore#//EString`. */
function ecoreDataType(name: string): string {
  return `ecore:EDataType ${ECORE_NS}#//${name}`;
}

// Built-in types must point into the Ecore package. A bare `//EString` would be resolved
// inside the user's own package, which EMF rejects as an unresolved reference.
const PRIMITIVE_ETYPE: Record<string, string> = {
  EString: ecoreDataType('EString'),
  String: ecoreDataType('EString'),
  EInt: ecoreDataType('EInt'),
  Int: ecoreDataType('EInt'),
  EBoolean: ecoreDataType('EBoolean'),
  Boolean: ecoreDataType('EBoolean'),
  EFloat: ecoreDataType('EFloat'),
  Float: ecoreDataType('EFloat'),
  EDouble: ecoreDataType('EDouble'),
  Double: ecoreDataType('EDouble'),
  ELong: ecoreDataType('ELong'),
  Long: ecoreDataType('ELong'),
  EShort: ecoreDataType('EShort'),
  Short: ecoreDataType('EShort'),
  EChar: ecoreDataType('EChar'),
  Char: ecoreDataType('EChar'),
  EByte: ecoreDataType('EByte'),
  Byte: ecoreDataType('EByte'),
  EDate: ecoreDataType('EDate'),
  Date: ecoreDataType('EDate'),
  EBigDecimal: ecoreDataType('EBigDecimal'),
  EBigInteger: ecoreDataType('EBigInteger'),
  EObject: `ecore:EClass ${ECORE_NS}#//EObject`,
};

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function attributeEType(typeName: string): string {
  const normalized = normalizeAttributeTypeDisplay(typeName);
  if (PRIMITIVE_ETYPE[normalized]) return PRIMITIVE_ETYPE[normalized];
  if (PRIMITIVE_ETYPE[typeName]) return PRIMITIVE_ETYPE[typeName];
  return PRIMITIVE_ETYPE.EString;
}

function extractPackageOpening(originalEcore?: string): {
  name: string;
  nsURI?: string;
  nsPrefix?: string;
} {
  const fallback = { name: 'model' };
  if (!originalEcore?.trim()) return fallback;

  const nameMatch = /<(?:ecore:)?EPackage[^>]*\bname="([^"]+)"/i.exec(originalEcore);
  const nsUriMatch = /\bnsURI="([^"]+)"/.exec(originalEcore);
  const nsPrefixMatch = /\bnsPrefix="([^"]+)"/.exec(originalEcore);

  return {
    name: nameMatch?.[1] || fallback.name,
    nsURI: nsUriMatch?.[1],
    nsPrefix: nsPrefixMatch?.[1],
  };
}

function renderVisibilityAnnotation(visibility: UMLVisibility, indent: string): string {
  if (visibility === '+') return '';
  return (
    `${indent}<eAnnotations source="${UML_VISIBILITY_ANNOTATION}">` +
    `\n${indent}  <details key="symbol" value="${escapeXml(visibility)}"/>` +
    `\n${indent}</eAnnotations>`
  );
}

function renderSourceMultiplicityAnnotation(
  sourceMultiplicity: string | undefined,
  indent: string,
): string {
  const value = normalizeMultiplicityDisplay(sourceMultiplicity);
  // Ecore's own bounds are the target end. `1` is the value readers assume
  // when this annotation is absent, so only a different source end is stored.
  if (!value || value === '1') return '';
  return (
    `${indent}<eAnnotations source="${UML_SOURCE_MULTIPLICITY_ANNOTATION}">` +
    `\n${indent}  <details key="value" value="${escapeXml(value)}"/>` +
    `\n${indent}</eAnnotations>`
  );
}

function renderDocumentationAnnotation(documentation: string | undefined, indent: string): string {
  if (documentation === undefined || documentation === '') return '';
  return (
    `${indent}<eAnnotations source="${ECORE_DOCUMENTATION_ANNOTATION}">` +
    `\n${indent}  <details key="documentation" value="${escapeXml(documentation)}"/>` +
    `\n${indent}</eAnnotations>`
  );
}

function renderAttribute(attr: UMLAttribute): string {
  const typeName = normalizeAttributeTypeDisplay(attr.type);
  if (!isPrimitiveAttributeType(typeName)) return '';
  const eType = attributeEType(typeName);
  const annotations = [
    renderDocumentationAnnotation(attr.documentation, '      '),
    renderVisibilityAnnotation(attr.visibility, '      '),
  ].filter(Boolean).join('\n');
  const openTag =
    `    <eStructuralFeatures xsi:type="ecore:EAttribute" name="${escapeXml(attr.name)}"` +
    ` eType="${escapeXml(eType)}" lowerBound="0" upperBound="1"`;
  // UML attributes are scalar; Ecore stores them as optional single values.
  if (!annotations) {
    return `${openTag}/>`;
  }
  return `${openTag}>\n${annotations}\n    </eStructuralFeatures>`;
}

/** Returns the operation's eType, or undefined for void operations (Ecore omits eType). */
function operationEType(typeName: string): string | undefined {
  const normalized = normalizeOperationReturnType(typeName);
  return PRIMITIVE_ETYPE[normalized];
}

function renderOperation(op: UMLOperation): string {
  const eType = operationEType(op.returnType);
  const annotations = [
    renderDocumentationAnnotation(op.documentation, '      '),
    renderVisibilityAnnotation(op.visibility, '      '),
  ].filter(Boolean).join('\n');
  const eTypeAttr = eType ? ` eType="${escapeXml(eType)}"` : '';
  const openTag = `    <eOperations name="${escapeXml(op.name)}"${eTypeAttr}`;
  if (!annotations) {
    return `${openTag}/>`;
  }
  return `${openTag}>\n${annotations}\n    </eOperations>`;
}

function renderReference(
  rel: UMLRelationship,
  targetName: string,
): string {
  const refName = rel.label?.trim() || `${rel.type}_${targetName}`.toLowerCase();
  const { lower, upper } = parseMultiplicity(rel.targetMultiplicity ?? '0..1');
  const containment = rel.type === 'composition';
  const openTag =
    `    <eStructuralFeatures xsi:type="ecore:EReference" name="${escapeXml(refName)}"` +
    ` eType="#//${escapeXml(targetName)}" containment="${containment}"` +
    ` lowerBound="${lower}" upperBound="${upper}"`;
  const annotations = [
    renderDocumentationAnnotation(rel.documentation, '      '),
    renderSourceMultiplicityAnnotation(rel.sourceMultiplicity, '      '),
  ].filter(Boolean).join('\n');
  return annotations
    ? `${openTag}>\n${annotations}\n    </eStructuralFeatures>`
    : `${openTag}/>`;
}

function renderClass(
  cls: UMLClass,
  inheritanceTargets: string[],
  outgoingRefs: UMLRelationship[],
  classById: Map<string, UMLClass>,
  classNames: Set<string>,
): string {
  const attrs: string[] = [];
  if (cls.isAbstract) attrs.push('abstract="true"');
  if (cls.isInterface) attrs.push('interface="true"');
  if (inheritanceTargets.length > 0) {
    const superTypeRefs = inheritanceTargets.map(t => '#//' + t).join(' ');
    attrs.push(`eSuperTypes="${superTypeRefs}"`);
  }

  const attrLines = cls.attributes.map(a => renderAttribute(a)).filter(Boolean);
  const opLines = (cls.operations ?? []).map(o => renderOperation(o));
  const refLines = outgoingRefs.map(rel => {
    const target = classById.get(rel.targetId);
    return target ? renderReference(rel, target.name) : '';
  }).filter(Boolean);

  const body = [
    renderDocumentationAnnotation(cls.documentation, '    '),
    ...attrLines,
    ...opLines,
    ...refLines,
  ].filter(Boolean).join('\n');
  const attrStr = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';

  if (body) {
    return (
      `  <eClassifiers xsi:type="ecore:EClass" name="${escapeXml(cls.name)}"${attrStr}>\n` +
      `${body}\n` +
      `  </eClassifiers>`
    );
  }
  return `  <eClassifiers xsi:type="ecore:EClass" name="${escapeXml(cls.name)}"${attrStr}/>`;
}

/**
 * Serialize a UML model back to Ecore XML.
 * Preserves package name / nsURI / nsPrefix from the original file when provided.
 */
export function umlToEcore(model: UMLModel, originalEcore?: string): string {
  const pkg = extractPackageOpening(originalEcore);
  const classById = new Map(model.classes.map(c => [c.id, c]));
  const classNames = new Set(model.classes.map(c => c.name));

  const inheritanceBySource = new Map<string, string[]>();
  const refsBySource = new Map<string, UMLRelationship[]>();

  for (const rel of model.relationships) {
    if (rel.type === 'inheritance') {
      const target = classById.get(rel.targetId);
      if (!target) continue;
      const list = inheritanceBySource.get(rel.sourceId) ?? [];
      list.push(target.name);
      inheritanceBySource.set(rel.sourceId, list);
    } else {
      const list = refsBySource.get(rel.sourceId) ?? [];
      list.push(rel);
      refsBySource.set(rel.sourceId, list);
    }
  }

  const classBlocks = model.classes.map(cls =>
    renderClass(
      cls,
      inheritanceBySource.get(cls.id) ?? [],
      refsBySource.get(cls.id) ?? [],
      classById,
      classNames,
    ),
  );

  const pkgAttrs = [
    `xmlns:xsi="${XSI_NS}"`,
    `xmlns:ecore="${ECORE_NS}"`,
    `name="${escapeXml(pkg.name)}"`,
  ];
  if (pkg.nsURI) pkgAttrs.push(`nsURI="${escapeXml(pkg.nsURI)}"`);
  if (pkg.nsPrefix) pkgAttrs.push(`nsPrefix="${escapeXml(pkg.nsPrefix)}"`);

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<ecore:EPackage ${pkgAttrs.join(' ')}>\n` +
    `${classBlocks.join('\n')}\n` +
    `</ecore:EPackage>\n`
  );
}

/** Stable JSON snapshot of semantic UML content (ignores layout coordinates). */
export function umlSemanticSnapshot(model: UMLModel): string {
  return JSON.stringify({
    classes: model.classes.map(({ x, y, ...rest }) => rest),
    relationships: model.relationships,
  });
}
