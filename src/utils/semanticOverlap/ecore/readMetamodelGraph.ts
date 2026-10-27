import { parseEcoreDocument } from '../../ecoreDocument';
import type { ClassNode, EnumNode, FeatureNode, MetamodelGraph, MetamodelRef, OperationNode } from '../types';

/** Input limits of the analysis (FR-031). */
export const MAX_ECORE_BYTES = 5 * 1024 * 1024;
export const MAX_CLASSES = 2000;

/** Raised when an ecore file cannot be used for the analysis. */
export class EcoreReadError extends Error {
  constructor(public readonly metamodelName: string, public readonly reason: string) {
    super(`${metamodelName}: ${reason}`);
    this.name = 'EcoreReadError';
  }
}

const localName = (el: Element) => el.localName || el.nodeName.replace(/^.*:/, '');
const childElements = (el: Element, name: string) =>
  Array.from(el.children).filter(child => localName(child) === name);
const typeOf = (el: Element) => (el.getAttribute('xsi:type') || '').replace(/^.*:/, '');

interface PackageEntry { el: Element; qualifiedName: string; path: string }

function findRootPackage(doc: Document): Element | null {
  const root = doc.documentElement;
  if (localName(root) === 'EPackage') return root;
  return Array.from(root.children).find(child => localName(child) === 'EPackage') ?? null;
}

function collectPackages(root: Element): PackageEntry[] {
  const result: PackageEntry[] = [];
  const visit = (el: Element, qualifiedName: string, path: string) => {
    result.push({ el, qualifiedName, path });
    for (const sub of childElements(el, 'eSubpackages')) {
      const name = sub.getAttribute('name') || 'package';
      visit(sub, `${qualifiedName}.${name}`, path ? `${path}/${name}` : name);
    }
  };
  visit(root, root.getAttribute('name') || 'package', '');
  return result;
}

/** `#//sub/Name` or `ecore:EDataType http://…#//EString` → the part after `#//`, and whether it is local. */
function parseReference(raw: string | null): { path: string; local: boolean } | null {
  if (!raw) return null;
  const value = raw.trim().split(/\s+/).pop() ?? '';
  const hashIndex = value.indexOf('#//');
  if (hashIndex < 0) return null;
  return { path: value.slice(hashIndex + 3), local: hashIndex === 0 };
}

function eTypeOf(feature: Element): string | null {
  const direct = feature.getAttribute('eType');
  if (direct) return direct;
  const generic = childElements(feature, 'eGenericType')[0];
  return generic?.getAttribute('eClassifier') ?? null;
}

/**
 * Reads an ecore file into a plain {@link MetamodelGraph}. Runs on the main thread (needs DOMParser).
 * @throws EcoreReadError on invalid XML, a missing root EPackage or when the input limits are exceeded.
 */
export function readMetamodelGraph(ecoreText: string, ref: MetamodelRef): MetamodelGraph {
  if (ecoreText.length > MAX_ECORE_BYTES) {
    throw new EcoreReadError(ref.name, 'the ecore file is larger than 5 MB');
  }
  const doc = parseEcoreDocument(ecoreText);
  if (!doc) throw new EcoreReadError(ref.name, 'the file is not valid XML');
  const root = findRootPackage(doc);
  if (!root) throw new EcoreReadError(ref.name, 'no root EPackage found');

  const packages = collectPackages(root);
  const pathToQualified = new Map<string, string>();
  const classifierKinds = new Map<string, string>();
  for (const pkg of packages) {
    for (const classifier of childElements(pkg.el, 'eClassifiers')) {
      const name = classifier.getAttribute('name') || '';
      const path = pkg.path ? `${pkg.path}/${name}` : name;
      pathToQualified.set(path, `${pkg.qualifiedName}.${name}`);
      classifierKinds.set(path, typeOf(classifier));
    }
  }

  const classElements = packages.flatMap(pkg =>
    childElements(pkg.el, 'eClassifiers')
      .filter(el => typeOf(el) === 'EClass')
      .map(el => ({ el, pkg })));
  if (classElements.length > MAX_CLASSES) {
    throw new EcoreReadError(ref.name, `more than ${MAX_CLASSES} classes`);
  }

  const unresolvedSupertypes = new Set<string>();

  const readFeature = (el: Element, owner: string): FeatureNode => {
    const kind = typeOf(el) === 'EReference' ? 'reference' : 'attribute';
    const typeRef = parseReference(eTypeOf(el));
    const typeName = typeRef ? typeRef.path.split('/').pop() ?? '' : '';
    let typeCategory: FeatureNode['typeCategory'] = 'primitive';
    if (kind === 'reference') typeCategory = 'class';
    else if (typeRef?.local && classifierKinds.get(typeRef.path) === 'EEnum') typeCategory = 'enum';
    const oppositeRef = parseReference(el.getAttribute('eOpposite'));
    const name = el.getAttribute('name') || '';
    return {
      kind,
      name,
      qualifiedName: `${owner}.${name}`,
      owner,
      typeName,
      typeCategory,
      lower: Number(el.getAttribute('lowerBound') ?? 0) || 0,
      upper: el.getAttribute('upperBound') === null ? 1 : Number(el.getAttribute('upperBound')),
      containment: el.getAttribute('containment') === 'true',
      opposite: oppositeRef?.local ? resolveFeaturePath(oppositeRef.path, pathToQualified) : null,
    };
  };

  const classes: ClassNode[] = classElements.map(({ el, pkg }) => {
    const name = el.getAttribute('name') || '';
    const qualifiedName = `${pkg.qualifiedName}.${name}`;
    const superTypes: string[] = [];
    for (const raw of (el.getAttribute('eSuperTypes') || '').split(/\s+/).filter(Boolean)) {
      const parsed = parseReference(raw);
      const resolved = parsed?.local ? pathToQualified.get(parsed.path) : undefined;
      if (resolved) superTypes.push(resolved);
      else unresolvedSupertypes.add(raw);
    }
    for (const generic of childElements(el, 'eGenericSuperTypes')) {
      const parsed = parseReference(generic.getAttribute('eClassifier'));
      const resolved = parsed?.local ? pathToQualified.get(parsed.path) : undefined;
      if (resolved) superTypes.push(resolved);
      else if (generic.getAttribute('eClassifier')) unresolvedSupertypes.add(generic.getAttribute('eClassifier')!);
    }
    const features = childElements(el, 'eStructuralFeatures').map(f => readFeature(f, qualifiedName));
    const operations: OperationNode[] = childElements(el, 'eOperations').map(op => ({
      name: op.getAttribute('name') || '',
      parameterNames: childElements(op, 'eParameters').map(p => p.getAttribute('name') || ''),
    }));
    return {
      qualifiedName,
      name,
      isAbstract: el.getAttribute('abstract') === 'true',
      isInterface: el.getAttribute('interface') === 'true',
      superTypes: [...new Set(superTypes)],
      attributes: features.filter(f => f.kind === 'attribute'),
      references: features.filter(f => f.kind === 'reference'),
      operations,
    };
  });

  const enums: EnumNode[] = packages.flatMap(pkg =>
    childElements(pkg.el, 'eClassifiers')
      .filter(el => typeOf(el) === 'EEnum')
      .map(el => {
        const name = el.getAttribute('name') || '';
        return {
          name,
          qualifiedName: `${pkg.qualifiedName}.${name}`,
          literals: childElements(el, 'eLiterals').map(lit => lit.getAttribute('name') || ''),
        };
      }));

  return {
    ref,
    rootPackage: root.getAttribute('name') || '',
    nsUri: root.getAttribute('nsURI'),
    classes,
    enums,
    unresolvedSupertypes: [...unresolvedSupertypes].sort(),
  };
}

/** `sub/Class/feature` → `root.sub.Class.feature`, if the class part resolves. */
function resolveFeaturePath(path: string, pathToQualified: Map<string, string>): string | null {
  const slash = path.lastIndexOf('/');
  if (slash < 0) return null;
  const owner = pathToQualified.get(path.slice(0, slash));
  return owner ? `${owner}.${path.slice(slash + 1)}` : null;
}
