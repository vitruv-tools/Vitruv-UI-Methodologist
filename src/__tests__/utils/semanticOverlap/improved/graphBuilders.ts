import type { ClassNode, Correspondence, ElementRef, FeatureNode, MetamodelGraph } from '../../../../utils/semanticOverlap/types';
import { refFor } from '../fixtures';

/** Small in-memory metamodel graphs for unit tests of the improved approach. */

export const attribute = (owner: string, name: string, typeName: string, extra: Partial<FeatureNode> = {}): FeatureNode => ({
  kind: 'attribute', name, qualifiedName: `${owner}.${name}`, owner, typeName, typeCategory: 'primitive',
  lower: 0, upper: 1, containment: false, opposite: null, ...extra,
});

export const reference = (owner: string, name: string, typeName: string, extra: Partial<FeatureNode> = {}): FeatureNode =>
  attribute(owner, name, typeName, { kind: 'reference', typeCategory: 'class', ...extra });

export const cls = (pkg: string, name: string, extra: Partial<ClassNode> = {}): ClassNode => ({
  qualifiedName: `${pkg}.${name}`, name, isAbstract: false, isInterface: false, superTypes: [], attributes: [], references: [], operations: [], ...extra,
});

export const graph = (classes: ClassNode[], name = 'g', id = 1, enums: MetamodelGraph['enums'] = []): MetamodelGraph =>
  ({ ref: refFor(name, id), rootPackage: name, nsUri: null, classes, enums, unresolvedSupertypes: [] });

const elementRef = (side: ElementRef['side'], qualifiedName: string, kind: ElementRef['kind'] = 'class'): ElementRef =>
  ({ side, kind, qualifiedName, name: qualifiedName.split('.').pop()! });

/** A correspondence between qualified names; features are recognised by their `kind`. */
export const corr = (id: string, sources: string[], targets: string[], score: number, extra: Partial<Correspondence> = {},
  kind: ElementRef['kind'] = 'class'): Correspondence => ({
  id, level: kind === 'class' ? 'class' : 'feature', score, scores: { structural: score, syntactic: score },
  sources: sources.map(s => elementRef('source', s, kind)), targets: targets.map(t => elementRef('target', t, kind)), ...extra,
});
