import { XSI_XML_NAMESPACE } from './ecoreXmlNamespaces';

export interface EcoreClassMetrics {
  name: string;
  qualifiedName: string;
  isAbstract: boolean;
  isInterface: boolean;
  attributeCount: number;
  inheritanceDepth: number;
  childCount: number;
  operationCount: number;
  containmentHeight: number;
}

export interface EcoreAssociationMetrics {
  name: string;
  ownerClass: string;
  targetClass: string;
  containment: boolean;
}

export interface EcoreEnumMetrics {
  name: string;
  literalCount: number;
}

export interface EcoreMetamodelMetrics {
  name: string;
  packageCount: number;
  classCount: number;
  abstractClassCount: number;
  concreteClassCount: number;
  attributesTotal: number;
  attributesPerClass: { className: string; count: number }[];
  referencesTotal: number;
  containmentReferences: number;
  nonContainmentReferences: number;
  enumCount: number;
  enumLiteralCount: number;
  enumerations: EcoreEnumMetrics[];
  inheritanceDepthMax: number;
  inheritanceDepthAvg: number;
  operationsTotal: number;
  nocMax: number;
  nocAvg: number;
  containmentHeightMax: number;
  containmentHeightAvg: number;
  crossPackageReferences: number;
  associations: EcoreAssociationMetrics[];
  classes: EcoreClassMetrics[];
}

const EMPTY_METRICS: EcoreMetamodelMetrics = {
  name: '',
  packageCount: 0,
  classCount: 0,
  abstractClassCount: 0,
  concreteClassCount: 0,
  attributesTotal: 0,
  attributesPerClass: [],
  referencesTotal: 0,
  containmentReferences: 0,
  nonContainmentReferences: 0,
  enumCount: 0,
  enumLiteralCount: 0,
  enumerations: [],
  inheritanceDepthMax: 0,
  inheritanceDepthAvg: 0,
  operationsTotal: 0,
  nocMax: 0,
  nocAvg: 0,
  containmentHeightMax: 0,
  containmentHeightAvg: 0,
  crossPackageReferences: 0,
  associations: [],
  classes: [],
};

function localName(el: Element): string {
  return el.localName || el.tagName.split(':').pop() || el.tagName;
}

function xsiType(el: Element): string {
  return el.getAttribute('xsi:type')
    || el.getAttributeNS(XSI_XML_NAMESPACE, 'type')
    || el.getAttribute('type')
    || '';
}

function isPackageElement(el: Element): boolean {
  const name = localName(el);
  if (name === 'EPackage' || name === 'eSubpackages') return true;
  return xsiType(el).includes('EPackage');
}

function isEClassElement(el: Element): boolean {
  const type = xsiType(el);
  if (type.includes('EEnum') || type.includes('EDataType')) return false;
  if (type.includes('EClass')) return true;
  return localName(el) === 'eClassifiers' && el.querySelectorAll('eStructuralFeatures').length > 0;
}

function isEEnumElement(el: Element): boolean {
  const type = xsiType(el);
  if (type.includes('EEnum')) return true;
  return localName(el) === 'eClassifiers' && el.querySelectorAll('eLiterals').length > 0 && !type.includes('EClass');
}

function parseTypeName(eType: string): string {
  const cleaned = eType.split('#').pop() || eType;
  const parts = cleaned.replace(/^\/\//, '').split('/');
  return parts.at(-1) || '';
}

function collectPackages(root: Element): Element[] {
  const packages: Element[] = [];
  const visit = (el: Element) => {
    if (isPackageElement(el)) packages.push(el);
    for (const child of Array.from(el.children)) {
      if (isPackageElement(child)) visit(child);
    }
  };
  visit(root);
  return packages;
}

function findRootPackage(xmlDoc: Document): Element | null {
  const tagged = xmlDoc.getElementsByTagName('ecore:EPackage')[0]
    || xmlDoc.getElementsByTagName('EPackage')[0];
  if (tagged) return tagged;
  for (const el of Array.from(xmlDoc.getElementsByTagName('*'))) {
    if (isPackageElement(el) && !el.parentElement?.closest?.('ecore\\:EPackage, EPackage, eSubpackages')) {
      return el;
    }
  }
  return xmlDoc.documentElement && isPackageElement(xmlDoc.documentElement)
    ? xmlDoc.documentElement
    : null;
}

function classifierChildren(pkg: Element): Element[] {
  return Array.from(pkg.children).filter(el => localName(el) === 'eClassifiers');
}

function superTypeNames(cls: Element): string[] {
  const raw = cls.getAttribute('eSuperTypes');
  if (!raw) return [];
  return raw.trim().split(/\s+/).map(parseTypeName).filter(Boolean);
}

function structuralFeatures(cls: Element): Element[] {
  return Array.from(cls.children).filter(el => localName(el) === 'eStructuralFeatures');
}

function countAttributes(cls: Element): number {
  let count = 0;
  for (const feat of structuralFeatures(cls)) {
    const type = xsiType(feat);
    if (type.includes('EReference')) continue;
    if (type.includes('EAttribute') || !type) count += 1;
  }
  return count;
}

function countReferences(cls: Element): { containment: number; nonContainment: number } {
  let containment = 0;
  let nonContainment = 0;
  for (const feat of structuralFeatures(cls)) {
    if (!xsiType(feat).includes('EReference')) continue;
    if (feat.getAttribute('containment') === 'true') containment += 1;
    else nonContainment += 1;
  }
  return { containment, nonContainment };
}

function collectAssociations(cls: Element, ownerName: string): EcoreAssociationMetrics[] {
  const associations: EcoreAssociationMetrics[] = [];
  for (const feat of structuralFeatures(cls)) {
    if (!xsiType(feat).includes('EReference')) continue;
    associations.push({
      name: feat.getAttribute('name') || 'unnamed',
      ownerClass: ownerName,
      targetClass: parseTypeName(feat.getAttribute('eType') || ''),
      containment: feat.getAttribute('containment') === 'true',
    });
  }
  return associations;
}

function countOperations(cls: Element): number {
  return Array.from(cls.children).filter(el => localName(el) === 'eOperations').length;
}

function referenceTargets(cls: Element, containmentOnly = false): { name: string; eType: string }[] {
  const targets: { name: string; eType: string }[] = [];
  for (const feat of structuralFeatures(cls)) {
    if (!xsiType(feat).includes('EReference')) continue;
    if (containmentOnly && feat.getAttribute('containment') !== 'true') continue;
    const eType = feat.getAttribute('eType') || '';
    const name = parseTypeName(eType);
    if (name) targets.push({ name, eType });
  }
  return targets;
}

function averageOf(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function computeLongestPathDepths(
  nodes: { name: string; next: string[] }[],
): Map<string, number> {
  const byName = new Map(nodes.map(c => [c.name, c]));
  const depths = new Map<string, number>();
  const visiting = new Set<string>();

  const depthOf = (name: string): number => {
    const cached = depths.get(name);
    if (cached !== undefined) return cached;
    if (visiting.has(name)) return 0;
    const node = byName.get(name);
    if (!node || node.next.length === 0) {
      depths.set(name, 0);
      return 0;
    }
    visiting.add(name);
    const nextDepths = node.next
      .filter(s => s !== name)
      .map(s => (byName.has(s) ? depthOf(s) : 0));
    visiting.delete(name);
    const depth = nextDepths.length === 0 ? 0 : 1 + Math.max(...nextDepths);
    depths.set(name, depth);
    return depth;
  };

  for (const node of nodes) depthOf(node.name);
  return depths;
}

export function parseEcoreMetamodelMetrics(
  ecoreContent: string,
  fallbackName = '',
): EcoreMetamodelMetrics {
  if (!ecoreContent?.trim()) {
    return { ...EMPTY_METRICS, name: fallbackName };
  }

  try {
    const xmlDoc = new DOMParser().parseFromString(ecoreContent, 'text/xml');
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      return { ...EMPTY_METRICS, name: fallbackName };
    }

    const root = findRootPackage(xmlDoc);
    if (!root) return { ...EMPTY_METRICS, name: fallbackName };

    const packageName = root.getAttribute('name') || fallbackName;
    const packages = collectPackages(root);

    const classElems: { el: Element; pkg: string }[] = [];
    const enumerations: EcoreEnumMetrics[] = [];

    for (const pkg of packages) {
      const pkgName = pkg.getAttribute('name') || packageName;
      for (const classifier of classifierChildren(pkg)) {
        if (isEEnumElement(classifier)) {
          enumerations.push({
            name: classifier.getAttribute('name') || 'Enum',
            literalCount: classifier.querySelectorAll('eLiterals').length,
          });
          continue;
        }
        if (isEClassElement(classifier)) {
          classElems.push({ el: classifier, pkg: pkgName });
        }
      }
    }

    const classInfos = classElems.map(({ el, pkg }) => {
      const name = el.getAttribute('name') || 'Unknown';
      const isAbstract = el.getAttribute('abstract') === 'true' || el.getAttribute('interface') === 'true';
      const isInterface = el.getAttribute('interface') === 'true';
      return {
        name,
        pkg,
        qualifiedName: pkg ? `${pkg}::${name}` : name,
        isAbstract,
        isInterface,
        attributeCount: countAttributes(el),
        operationCount: countOperations(el),
        supers: superTypeNames(el),
        containmentTargets: referenceTargets(el, true).map(t => t.name),
        referenceTargets: referenceTargets(el),
      };
    });

    const knownNames = new Set(classInfos.map(c => c.name));
    const classPkg = new Map(classInfos.map(c => [c.name, c.pkg]));
    const childCounts = new Map(classInfos.map(c => [c.name, 0]));
    for (const cls of classInfos) {
      for (const parent of cls.supers) {
        if (childCounts.has(parent)) {
          childCounts.set(parent, (childCounts.get(parent) ?? 0) + 1);
        }
      }
    }

    const depths = computeLongestPathDepths(classInfos.map(c => ({ name: c.name, next: c.supers })));
    const containmentHeights = computeLongestPathDepths(
      classInfos.map(c => ({
        name: c.name,
        next: c.containmentTargets.filter(t => knownNames.has(t)),
      })),
    );

    let containment = 0;
    let nonContainment = 0;
    for (const { el } of classElems) {
      const refs = countReferences(el);
      containment += refs.containment;
      nonContainment += refs.nonContainment;
    }

    let crossPackageReferences = 0;
    for (const cls of classInfos) {
      for (const target of cls.referenceTargets) {
        const targetPkg = classPkg.get(target.name);
        if (targetPkg && targetPkg !== cls.pkg) crossPackageReferences += 1;
      }
    }

    const depthValues = classInfos.map(c => depths.get(c.name) ?? 0);
    const nocValues = classInfos.map(c => childCounts.get(c.name) ?? 0);
    const heightValues = classInfos.map(c => containmentHeights.get(c.name) ?? 0);
    const operationsTotal = classInfos.reduce((s, c) => s + c.operationCount, 0);

    const classes: EcoreClassMetrics[] = classInfos.map(c => ({
      name: c.name,
      qualifiedName: c.qualifiedName,
      isAbstract: c.isAbstract,
      isInterface: c.isInterface,
      attributeCount: c.attributeCount,
      inheritanceDepth: depths.get(c.name) ?? 0,
      childCount: childCounts.get(c.name) ?? 0,
      operationCount: c.operationCount,
      containmentHeight: containmentHeights.get(c.name) ?? 0,
    }));

    const associations: EcoreAssociationMetrics[] = [];
    for (const { el } of classElems) {
      associations.push(...collectAssociations(el, el.getAttribute('name') || 'Unknown'));
    }

    const abstractClassCount = classes.filter(c => c.isAbstract).length;

    return {
      name: packageName,
      packageCount: packages.length,
      classCount: classes.length,
      abstractClassCount,
      concreteClassCount: classes.length - abstractClassCount,
      attributesTotal: classes.reduce((s, c) => s + c.attributeCount, 0),
      attributesPerClass: classes.map(c => ({ className: c.name, count: c.attributeCount })),
      referencesTotal: containment + nonContainment,
      containmentReferences: containment,
      nonContainmentReferences: nonContainment,
      enumCount: enumerations.length,
      enumLiteralCount: enumerations.reduce((s, e) => s + e.literalCount, 0),
      enumerations,
      inheritanceDepthMax: depthValues.length === 0 ? 0 : Math.max(0, ...depthValues),
      inheritanceDepthAvg: averageOf(depthValues),
      operationsTotal,
      nocMax: nocValues.length === 0 ? 0 : Math.max(0, ...nocValues),
      nocAvg: averageOf(nocValues),
      containmentHeightMax: heightValues.length === 0 ? 0 : Math.max(0, ...heightValues),
      containmentHeightAvg: averageOf(heightValues),
      crossPackageReferences,
      associations,
      classes,
    };
  } catch {
    return { ...EMPTY_METRICS, name: fallbackName };
  }
}

/** Counts instance-level model elements in an XMI / XML instance document. */
export function countXmiModelElements(xmiContent: string): number {
  if (!xmiContent?.trim()) return 0;
  try {
    const xmlDoc = new DOMParser().parseFromString(xmiContent, 'text/xml');
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) return 0;
    const root = xmlDoc.documentElement;
    if (!root) return 0;
    const local = localName(root);
    if (local === 'parsererror') return 0;
    return xmlDoc.getElementsByTagName('*').length;
  } catch {
    return 0;
  }
}
