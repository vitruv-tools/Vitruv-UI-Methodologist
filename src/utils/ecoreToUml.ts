export interface UMLAttribute {
  id: string;
  name: string;
  type: string;
  visibility: '+' | '-' | '#';
  multiplicity?: string;
}

export interface UMLClass {
  id: string;       // stable id = sanitized original name
  name: string;     // display name (editable)
  isAbstract: boolean;
  isInterface: boolean;
  attributes: UMLAttribute[];
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
}

export interface UMLModel {
  classes: UMLClass[];
  relationships: UMLRelationship[];
}

const BOX_W = 190;
const COLS = 3;
const COL_GAP = 70;
const ROW_H_EST = 210;

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

function parseTypeName(eType: string): string {
  const cleaned = eType.split('#').pop() || eType;
  const parts = cleaned.replace(/^\/\//, '').split('/');
  return parts[parts.length - 1] || 'Unknown';
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

    const classMap = new Map<string, UMLClass>();

    classElems.forEach((cls, idx) => {
      const rawName = cls.getAttribute('name') || 'Unknown';
      const id = sanitize(rawName);
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);

      const attributes: UMLAttribute[] = [];
      let attrIdx = 0;
      for (const feat of cls.querySelectorAll('eStructuralFeatures')) {
        const fType = feat.getAttribute('xsi:type') || feat.getAttribute('type') || '';
        if (fType.includes('EReference')) continue;

        const attrName = feat.getAttribute('name') || 'attr';
        const eType = feat.getAttribute('eType') || 'EString';
        const typeName = parseTypeName(eType);
        const lower = feat.getAttribute('lowerBound');
        const upper = feat.getAttribute('upperBound');
        const mult =
          lower !== null && upper !== null
            ? `[${lower}..${upper === '-1' ? '*' : upper}]`
            : undefined;

        attributes.push({
          id: `${id}-${attrIdx++}`,
          name: attrName,
          type: typeName,
          visibility: '+',
          multiplicity: mult,
        });
      }

      classMap.set(id, {
        id,
        name: rawName,
        isAbstract: cls.getAttribute('abstract') === 'true',
        isInterface: cls.getAttribute('interface') === 'true',
        attributes,
        x: 40 + col * (BOX_W + COL_GAP),
        y: 40 + row * ROW_H_EST,
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
          relationships.push({
            id: `rel-${relIdx++}`,
            sourceId: id,
            targetId,
            type: feat.getAttribute('containment') === 'true' ? 'composition' : 'association',
            label: refName || undefined,
          });
        }
      }
    }

    return { classes: Array.from(classMap.values()), relationships };
  } catch {
    return { classes: [], relationships: [] };
  }
}
