import {
  UMLAttribute,
  UMLClass,
  UMLModel,
  UMLRelationship,
} from './ecoreToUml';
import { parseMultiplicity } from './umlMultiplicity';

const ECORE_NS = 'http://www.eclipse.org/emf/2002/Ecore';
const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';

const PRIMITIVE_ETYPE: Record<string, string> = {
  EString: '//EString',
  String: '//EString',
  EInt: '//EInt',
  Int: '//EInt',
  EBoolean: '//EBoolean',
  Boolean: '//EBoolean',
  EFloat: '//EFloat',
  Float: '//EFloat',
  EDouble: '//EDouble',
  Double: '//EDouble',
  ELong: '//ELong',
  Long: '//ELong',
  EShort: '//EShort',
  Short: '//EShort',
  EChar: '//EChar',
  Char: '//EChar',
  EByte: '//EByte',
  Byte: '//EByte',
  EDate: '//EDate',
  Date: '//EDate',
  EBigDecimal: '//EBigDecimal',
  EBigInteger: '//EBigInteger',
  EObject: '//EObject',
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attributeEType(typeName: string, classNames: Set<string>): string {
  if (PRIMITIVE_ETYPE[typeName]) return PRIMITIVE_ETYPE[typeName];
  if (classNames.has(typeName)) return `#//${typeName}`;
  return `#//${typeName}`;
}

function extractPackageOpening(originalEcore?: string): {
  name: string;
  nsURI?: string;
  nsPrefix?: string;
} {
  const fallback = { name: 'model' };
  if (!originalEcore?.trim()) return fallback;

  const nameMatch = originalEcore.match(/<(?:ecore:)?EPackage[^>]*\bname="([^"]+)"/i);
  const nsUriMatch = originalEcore.match(/\bnsURI="([^"]+)"/);
  const nsPrefixMatch = originalEcore.match(/\bnsPrefix="([^"]+)"/);

  return {
    name: nameMatch?.[1] || fallback.name,
    nsURI: nsUriMatch?.[1],
    nsPrefix: nsPrefixMatch?.[1],
  };
}

function renderAttribute(attr: UMLAttribute, classNames: Set<string>): string {
  const { lower, upper } = parseMultiplicity(attr.multiplicity ?? '0..1');
  const eType = attributeEType(attr.type, classNames);
  return (
    `    <eStructuralFeatures xsi:type="ecore:EAttribute" name="${escapeXml(attr.name)}"` +
    ` eType="${escapeXml(eType)}" lowerBound="${lower}" upperBound="${upper}"/>`
  );
}

function renderReference(
  rel: UMLRelationship,
  targetName: string,
): string {
  const refName = rel.label?.trim() || `${rel.type}_${targetName}`.toLowerCase();
  const { lower, upper } = parseMultiplicity(rel.targetMultiplicity ?? '0..1');
  const containment = rel.type === 'composition';
  return (
    `    <eStructuralFeatures xsi:type="ecore:EReference" name="${escapeXml(refName)}"` +
    ` eType="#//${escapeXml(targetName)}" containment="${containment}"` +
    ` lowerBound="${lower}" upperBound="${upper}"/>`
  );
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
    attrs.push(`eSuperTypes="${inheritanceTargets.map(t => `#//${t}`).join(' ')}"`);
  }

  const attrLines = cls.attributes.map(a => renderAttribute(a, classNames));
  const refLines = outgoingRefs.map(rel => {
    const target = classById.get(rel.targetId);
    return target ? renderReference(rel, target.name) : '';
  }).filter(Boolean);

  const body = [...attrLines, ...refLines].join('\n');
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
