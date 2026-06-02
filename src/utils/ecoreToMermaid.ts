/**
 * Converts an Ecore XML string to Mermaid classDiagram syntax.
 * Used by the floating UML panel in the canvas view.
 */
export const ecoreToMermaid = (ecoreContent: string): string => {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(ecoreContent, 'text/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      return 'classDiagram\n  class ParseError';
    }

    const lines: string[] = ['classDiagram'];

    // Collect EClass elements
    const allClassifiers = Array.from(xmlDoc.querySelectorAll('eClassifiers'));
    const classElems = allClassifiers.filter(el => {
      const t = el.getAttribute('xsi:type') || el.getAttribute('type') || '';
      return t.includes('EClass') || (!t && el.querySelectorAll('eStructuralFeatures').length > 0);
    });

    if (classElems.length === 0) {
      return 'classDiagram\n  class EmptyModel';
    }

    // First pass: class bodies
    for (const cls of classElems) {
      const name = sanitizeName(cls.getAttribute('name') || 'Unknown');
      const isAbstract = cls.getAttribute('abstract') === 'true';
      const isInterface = cls.getAttribute('interface') === 'true';

      lines.push(`  class ${name} {`);
      if (isAbstract) lines.push(`    <<abstract>>`);
      if (isInterface) lines.push(`    <<interface>>`);

      const features = cls.querySelectorAll('eStructuralFeatures');
      for (const feat of features) {
        const fType = feat.getAttribute('xsi:type') || feat.getAttribute('type') || '';
        const isRef = fType.includes('EReference');
        if (isRef) continue; // references become edges, not fields

        const attrName = feat.getAttribute('name') || 'attr';
        const eType = feat.getAttribute('eType') || 'EString';
        const typeName = parseTypeName(eType);
        const lower = feat.getAttribute('lowerBound');
        const upper = feat.getAttribute('upperBound');
        const mult = lower !== null && upper !== null ? ` [${lower}..${upper === '-1' ? '*' : upper}]` : '';

        lines.push(`    +${attrName} ${typeName}${mult}`);
      }
      lines.push(`  }`);
    }

    // Second pass: relationships
    for (const cls of classElems) {
      const name = sanitizeName(cls.getAttribute('name') || 'Unknown');

      // Inheritance via eSuperTypes
      const superTypes = cls.getAttribute('eSuperTypes');
      if (superTypes) {
        for (const st of superTypes.trim().split(/\s+/)) {
          const parentName = parseTypeName(st);
          if (parentName && parentName !== name) {
            lines.push(`  ${parentName} <|-- ${name}`);
          }
        }
      }

      // EReference → associations
      const features = cls.querySelectorAll('eStructuralFeatures');
      for (const feat of features) {
        const fType = feat.getAttribute('xsi:type') || feat.getAttribute('type') || '';
        if (!fType.includes('EReference')) continue;

        const refName = feat.getAttribute('name') || '';
        const eType = feat.getAttribute('eType') || '';
        const targetName = parseTypeName(eType);
        const containment = feat.getAttribute('containment') === 'true';

        if (targetName && targetName !== name) {
          const arrow = containment ? '*--' : '-->';
          lines.push(`  ${name} ${arrow} ${targetName} : ${refName}`);
        }
      }
    }

    return lines.join('\n');
  } catch {
    return 'classDiagram\n  class Error';
  }
};

const sanitizeName = (name: string) =>
  name.replace(/[^a-zA-Z0-9_]/g, '_');

const parseTypeName = (eType: string): string => {
  // Handles formats: "ecore:EDataType #//ClassName"  "//ClassName"  "#//ClassName"
  const cleaned = eType.split('#').pop() || eType;
  const parts = cleaned.replace(/^\/\//, '').split('/');
  return sanitizeName(parts[parts.length - 1] || 'Unknown');
};
