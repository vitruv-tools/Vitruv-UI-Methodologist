import { createWordNetSource } from '../../../../utils/semanticOverlap/lexical/wordNetSource';
import { classNeighbourhoodMeasure, neighbourhoodSimilarity } from '../../../../utils/semanticOverlap/measures/neighbourhoodMeasure';
import { buildClassProfiles } from '../../../../utils/semanticOverlap/measures/profiles';
import { DEFAULT_SETTINGS } from '../../../../utils/semanticOverlap/settings';
import type { ClassNode, FeatureNode, MetamodelGraph } from '../../../../utils/semanticOverlap/types';
import { refFor } from '../fixtures';

const lexical = createWordNetSource({ source: 't', version: 't', license: 't', url: 't', words: [], synsets: [] });
const reference = (owner: string, typeName: string): FeatureNode => ({
  kind: 'reference', name: `to${typeName}`, qualifiedName: `${owner}.to${typeName}`, owner, typeName,
  typeCategory: 'class', lower: 0, upper: 1, containment: false, opposite: null,
});
const cls = (pkg: string, name: string, superTypes: string[] = [], refs: string[] = []): ClassNode => ({
  qualifiedName: `${pkg}.${name}`, name, isAbstract: false, isInterface: false,
  superTypes: superTypes.map(s => `${pkg}.${s}`), attributes: [], operations: [],
  references: refs.map(r => reference(`${pkg}.${name}`, r)),
});
const graph = (pkg: string, classes: ClassNode[]): MetamodelGraph => ({
  ref: refFor(pkg), rootPackage: pkg, nsUri: null, enums: [], unresolvedSupertypes: [], classes,
});

describe('neighbourhood measure', () => {
  const ecore = buildClassProfiles(graph('ecore', [
    cls('ecore', 'EStructuralFeature'), cls('ecore', 'EAttribute', ['EStructuralFeature']), cls('ecore', 'EObject'),
  ]), 'source', lexical, DEFAULT_SETTINGS);
  const uml = buildClassProfiles(graph('uml', [
    cls('uml', 'StructuralFeature'), cls('uml', 'Property', ['StructuralFeature'], ['Association']),
    cls('uml', 'Interface', ['Classifier']), cls('uml', 'Classifier'),
  ]), 'target', lexical, DEFAULT_SETTINGS);
  const [, attribute, object] = ecore;
  const [, property, iface] = uml;

  it('collects direct supertypes and reference target types as neighbours', () => {
    expect(property.neighbours.map(n => n.tokens.join(' '))).toEqual(['structural feature', 'association']);
  });

  it('scores classes with similar neighbours higher', () => {
    expect(neighbourhoodSimilarity(attribute, property)).toBeGreaterThan(neighbourhoodSimilarity(attribute, iface));
    // EAttribute→Property: 1 (StructuralFeature) vs best of {StructuralFeature 1, Association 0} averaged
    expect(neighbourhoodSimilarity(attribute, property)).toBeCloseTo((1 + 0.5) / 2);
  });

  it('is 0 without neighbours and applies to classes only', () => {
    expect(neighbourhoodSimilarity(object, property)).toBe(0);
    expect(classNeighbourhoodMeasure.level).toBe('class');
  });
});
