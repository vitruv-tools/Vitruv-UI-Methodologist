import { XSI_XML_NAMESPACE } from './ecoreXmlNamespaces';

export interface EcoreClassMetrics {
  name: string;
  /** Unique within its metamodel: the path below the root package, e.g. `nested/Kind`. */
  id: string;
  /** Subpackage path below the root package (`''` for the root package). */
  packagePath: string;
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
  /** {@link EcoreClassMetrics.id} of the owning class. */
  ownerId: string;
  targetClass: string;
  containment: boolean;
}

export interface EcoreEnumMetrics {
  name: string;
  literalCount: number;
}

export interface EcorePackageMetrics {
  name: string;
  /** Path below the root package (`''` for the root package). */
  path: string;
  nsURI: string;
  nsPrefix: string;
}

export interface EcoreMetamodelMetrics {
  name: string;
  packages: EcorePackageMetrics[];
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
  packages: [],
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

/** The `/`-separated class path of an eType / eSuperTypes reference, or `null` for external ones. */
function localTypePath(eType: string): string | null {
  const trimmed = eType.trim();
  if (!trimmed) return null;
  const hashIndex = trimmed.indexOf('#');
  // `other.ecore#//Name` and `http://uri#//Name` point into another resource.
  if (hashIndex > 0) return null;
  const path = (hashIndex === 0 ? trimmed.slice(1) : trimmed).replace(/^\/\//, '');
  return path || null;
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
    if (isPackageElement(el) && !el.parentElement?.closest?.(String.raw`ecore\:EPackage, EPackage, eSubpackages`)) {
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

function collectAssociations(cls: Element, ownerName: string, ownerId: string): EcoreAssociationMetrics[] {
  const associations: EcoreAssociationMetrics[] = [];
  for (const feat of structuralFeatures(cls)) {
    if (!xsiType(feat).includes('EReference')) continue;
    associations.push({
      name: feat.getAttribute('name') || 'unnamed',
      ownerClass: ownerName,
      ownerId,
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

type ClassElem = { el: Element; pkg: string; path: string };

type ClassInfo = {
  id: string;
  packagePath: string;
  name: string;
  pkg: string;
  qualifiedName: string;
  isAbstract: boolean;
  isInterface: boolean;
  attributeCount: number;
  operationCount: number;
  /** Class ids of the supertypes that live in this metamodel. */
  supers: string[];
  /** Class ids of containment targets that live in this metamodel. */
  containmentTargets: string[];
  referenceTargets: { name: string; eType: string; id: string | null }[];
};

function packagePathOf(pkg: Element, root: Element): string {
  const names: string[] = [];
  let current: Element | null = pkg;
  while (current && current !== root) {
    names.unshift(current.getAttribute('name') || '');
    current = current.parentElement;
  }
  return names.filter(Boolean).join('/');
}

function collectClassifiers(
  packages: Element[],
  packageName: string,
  root: Element,
): { classElems: ClassElem[]; enumerations: EcoreEnumMetrics[] } {
  const classElems: ClassElem[] = [];
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
        classElems.push({ el: classifier, pkg: pkgName, path: packagePathOf(pkg, root) });
      }
    }
  }
  return { classElems, enumerations };
}

function classIdOf(path: string, name: string): string {
  return path ? `${path}/${name}` : name;
}

/** Resolves eType references to class ids, falling back to a unique short-name match. */
function createClassResolver(classElems: ClassElem[]): (eType: string) => string | null {
  const ids = new Set<string>();
  const idsByName = new Map<string, string[]>();
  for (const { el, path } of classElems) {
    const name = el.getAttribute('name') || 'Unknown';
    const id = classIdOf(path, name);
    ids.add(id);
    idsByName.set(name, [...(idsByName.get(name) ?? []), id]);
  }
  return eType => {
    const path = localTypePath(eType);
    if (!path) return null;
    if (ids.has(path)) return path;
    const candidates = idsByName.get(path.split('/').pop() || '') ?? [];
    return candidates.length === 1 ? candidates[0] : null;
  };
}

function toClassInfo(
  el: Element,
  pkg: string,
  path: string,
  resolve: (eType: string) => string | null,
): ClassInfo {
  const name = el.getAttribute('name') || 'Unknown';
  const isInterface = el.getAttribute('interface') === 'true';
  const refs = referenceTargets(el).map(t => ({ ...t, id: resolve(t.eType) }));
  const containmentRefs = referenceTargets(el, true).map(t => resolve(t.eType));
  return {
    id: classIdOf(path, name),
    packagePath: path,
    name,
    pkg,
    qualifiedName: pkg ? `${pkg}::${name}` : name,
    isAbstract: el.getAttribute('abstract') === 'true' || isInterface,
    isInterface,
    attributeCount: countAttributes(el),
    operationCount: countOperations(el),
    supers: (el.getAttribute('eSuperTypes') || '')
      .trim()
      .split(/\s+/)
      .map(resolve)
      .filter((id): id is string => id !== null),
    containmentTargets: containmentRefs.filter((id): id is string => id !== null),
    referenceTargets: refs,
  };
}

function countChildrenByParent(classInfos: ClassInfo[]): Map<string, number> {
  const childCounts = new Map(classInfos.map(c => [c.id, 0]));
  for (const cls of classInfos) {
    // A class listing the same parent twice is still one child of it.
    for (const parent of new Set(cls.supers)) {
      if (parent !== cls.id && childCounts.has(parent)) {
        childCounts.set(parent, (childCounts.get(parent) ?? 0) + 1);
      }
    }
  }
  return childCounts;
}

function sumReferences(classElems: ClassElem[]): { containment: number; nonContainment: number } {
  let containment = 0;
  let nonContainment = 0;
  for (const { el } of classElems) {
    const refs = countReferences(el);
    containment += refs.containment;
    nonContainment += refs.nonContainment;
  }
  return { containment, nonContainment };
}

function countCrossPackageReferences(classInfos: ClassInfo[]): number {
  const classPkg = new Map(classInfos.map(c => [c.id, c.packagePath]));
  let count = 0;
  for (const cls of classInfos) {
    for (const target of cls.referenceTargets) {
      const targetPkg = target.id === null ? undefined : classPkg.get(target.id);
      if (targetPkg !== undefined && targetPkg !== cls.packagePath) count += 1;
    }
  }
  return count;
}

function toClassMetrics(
  classInfos: ClassInfo[],
  depths: Map<string, number>,
  childCounts: Map<string, number>,
  containmentHeights: Map<string, number>,
): EcoreClassMetrics[] {
  return classInfos.map(c => ({
    name: c.name,
    id: c.id,
    packagePath: c.packagePath,
    qualifiedName: c.qualifiedName,
    isAbstract: c.isAbstract,
    isInterface: c.isInterface,
    attributeCount: c.attributeCount,
    inheritanceDepth: depths.get(c.id) ?? 0,
    childCount: childCounts.get(c.id) ?? 0,
    operationCount: c.operationCount,
    containmentHeight: containmentHeights.get(c.id) ?? 0,
  }));
}

function collectAllAssociations(classElems: ClassElem[]): EcoreAssociationMetrics[] {
  const associations: EcoreAssociationMetrics[] = [];
  for (const { el, path } of classElems) {
    const name = el.getAttribute('name') || 'Unknown';
    associations.push(...collectAssociations(el, name, classIdOf(path, name)));
  }
  return associations;
}

function metricsFromParsed(
  packageName: string,
  packages: Element[],
  enumerations: EcoreEnumMetrics[],
  classElems: ClassElem[],
  classInfos: ClassInfo[],
  packageInfos: EcorePackageMetrics[],
): EcoreMetamodelMetrics {
  const knownIds = new Set(classInfos.map(c => c.id));
  const childCounts = countChildrenByParent(classInfos);
  const depths = computeLongestPathDepths(classInfos.map(c => ({ name: c.id, next: c.supers })));
  const containmentHeights = computeLongestPathDepths(
    classInfos.map(c => ({
      name: c.id,
      next: c.containmentTargets.filter(t => knownIds.has(t)),
    })),
  );
  const { containment, nonContainment } = sumReferences(classElems);
  const classes = toClassMetrics(classInfos, depths, childCounts, containmentHeights);
  const depthValues = classes.map(c => c.inheritanceDepth);
  const nocValues = classes.map(c => c.childCount);
  const heightValues = classes.map(c => c.containmentHeight);
  const abstractClassCount = classes.filter(c => c.isAbstract).length;

  return {
    name: packageName,
    packages: packageInfos,
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
    operationsTotal: classInfos.reduce((s, c) => s + c.operationCount, 0),
    nocMax: nocValues.length === 0 ? 0 : Math.max(0, ...nocValues),
    nocAvg: averageOf(nocValues),
    containmentHeightMax: heightValues.length === 0 ? 0 : Math.max(0, ...heightValues),
    containmentHeightAvg: averageOf(heightValues),
    crossPackageReferences: countCrossPackageReferences(classInfos),
    associations: collectAllAssociations(classElems),
    classes,
  };
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
    const { classElems, enumerations } = collectClassifiers(packages, packageName, root);
    const resolveClass = createClassResolver(classElems);
    const classInfos = classElems.map(({ el, pkg, path }) => toClassInfo(el, pkg, path, resolveClass));
    const packageInfos = packages.map(pkg => ({
      name: pkg.getAttribute('name') || packageName,
      path: packagePathOf(pkg, root),
      nsURI: (pkg.getAttribute('nsURI') || '').trim(),
      nsPrefix: (pkg.getAttribute('nsPrefix') || '').trim(),
    }));
    return metricsFromParsed(packageName, packages, enumerations, classElems, classInfos, packageInfos);
  } catch {
    return { ...EMPTY_METRICS, name: fallbackName };
  }
}
