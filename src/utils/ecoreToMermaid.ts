/**
 * Converts an Ecore XML string to Mermaid classDiagram syntax.
 * Used by the floating UML panel in the canvas view.
 */
export const ecoreToMermaid = (ecoreContent: string): string => {
  try {
    const xmlDoc = parseEcoreDocument(ecoreContent);
    if (!xmlDoc) return 'classDiagram\n  class ParseError';

    const classElems = collectClassElements(xmlDoc);
    if (classElems.length === 0) return 'classDiagram\n  class EmptyModel';

    const lines: string[] = ['classDiagram'];
    appendClassBodies(lines, classElems);
    appendRelationships(lines, classElems);
    return lines.join('\n');
  } catch {
    return 'classDiagram\n  class Error';
  }
};

const sanitizeName = (name: string) =>
  name.replace(/\W/g, '_');

const parseTypeName = (eType: string): string => {
  // Handles formats: "ecore:EDataType #//ClassName"  "//ClassName"  "#//ClassName"
  const cleaned = eType.split('#').pop() || eType;
  const parts = cleaned.replace(/^\/\//, '').split('/');
  return sanitizeName(parts.at(-1) || 'Unknown');
};

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

function getClassName(cls: Element): string {
  return sanitizeName(cls.getAttribute('name') || 'Unknown');
}

function formatUpperBound(upper: string): string {
  if (upper === '-1') return '*';
  return upper;
}

function formatMultiplicity(lower: string | null, upper: string | null): string {
  if (lower === null || upper === null) return '';
  return ` [${lower}..${formatUpperBound(upper)}]`;
}

function isReferenceFeature(feat: Element): boolean {
  return getElementType(feat).includes('EReference');
}

function appendStereotypes(lines: string[], cls: Element): void {
  if (cls.getAttribute('abstract') === 'true') lines.push('    <<abstract>>');
  if (cls.getAttribute('interface') === 'true') lines.push('    <<interface>>');
}

function appendAttributeLine(lines: string[], feat: Element): void {
  if (isReferenceFeature(feat)) return;

  const attrName = feat.getAttribute('name') || 'attr';
  const typeName = parseTypeName(feat.getAttribute('eType') || 'EString');
  const mult = formatMultiplicity(feat.getAttribute('lowerBound'), feat.getAttribute('upperBound'));
  lines.push(`    +${attrName} ${typeName}${mult}`);
}

function appendClassBody(lines: string[], cls: Element): void {
  const name = getClassName(cls);
  lines.push(`  class ${name} {`);
  appendStereotypes(lines, cls);
  cls.querySelectorAll('eStructuralFeatures').forEach(feat => appendAttributeLine(lines, feat));
  lines.push('  }');
}

function appendClassBodies(lines: string[], classElems: Element[]): void {
  classElems.forEach(cls => appendClassBody(lines, cls));
}

function appendInheritanceLines(lines: string[], cls: Element, name: string): void {
  const superTypes = cls.getAttribute('eSuperTypes');
  if (!superTypes) return;

  for (const superType of superTypes.trim().split(/\s+/)) {
    const parentName = parseTypeName(superType);
    if (parentName && parentName !== name) {
      lines.push(`  ${parentName} <|-- ${name}`);
    }
  }
}

function appendReferenceLine(lines: string[], name: string, feat: Element): void {
  if (!isReferenceFeature(feat)) return;

  const refName = feat.getAttribute('name') || '';
  const targetName = parseTypeName(feat.getAttribute('eType') || '');
  if (!targetName || targetName === name) return;

  const arrow = feat.getAttribute('containment') === 'true' ? '*--' : '-->';
  lines.push(`  ${name} ${arrow} ${targetName} : ${refName}`);
}

function appendRelationshipLines(lines: string[], cls: Element): void {
  const name = getClassName(cls);
  appendInheritanceLines(lines, cls, name);
  cls.querySelectorAll('eStructuralFeatures').forEach(feat => appendReferenceLine(lines, name, feat));
}

function appendRelationships(lines: string[], classElems: Element[]): void {
  classElems.forEach(cls => appendRelationshipLines(lines, cls));
}
