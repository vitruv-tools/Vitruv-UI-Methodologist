import { noLexicalSource } from '../../../../utils/semanticOverlap/lexical/wordNetSource';
import { buildClassProfiles, buildFeatureProfiles } from '../../../../utils/semanticOverlap/measures/profiles';
import { DEFAULT_SETTINGS } from '../../../../utils/semanticOverlap/settings';
import type { MetamodelGraph } from '../../../../utils/semanticOverlap/types';
import { ecoreExcerpt, refFor, umlExcerpt } from '../fixtures';

describe('element profiles', () => {
  it('computes NAT, NAC, WMC, DIT and NOC for classes', () => {
    const profiles = buildClassProfiles(ecoreExcerpt(), 'source', noLexicalSource, DEFAULT_SETTINGS);
    expect(profiles.map(p => [p.ref.name, p.metrics])).toEqual([
      ['EClass', [1, 2, 0, 0, 0]],
      ['EReference', [1, 1, 0, 0, 0]],
      ['EAttribute', [1, 0, 0, 0, 0]],
    ]);
    expect(profiles[0].tokens).toEqual(['class']);
    expect([...profiles[0].vocabulary.keys()]).toEqual(expect.arrayContaining(['class', 'abstract', 'attributes', 'references']));
  });

  it('computes inheritance depth and number of children', () => {
    const cls = (name: string, superTypes: string[] = []) => ({
      qualifiedName: `p.${name}`, name, isAbstract: false, isInterface: false, superTypes, attributes: [], references: [], operations: [],
    });
    const graph: MetamodelGraph = {
      ref: refFor('Tree'), rootPackage: 'p', nsUri: null, enums: [], unresolvedSupertypes: [],
      classes: [cls('Root'), cls('Mid', ['p.Root']), cls('Leaf', ['p.Mid']), cls('Other', ['p.Root'])],
    };
    const metrics = buildClassProfiles(graph, 'source', noLexicalSource, DEFAULT_SETTINGS).map(p => p.metrics.slice(3));
    expect(metrics).toEqual([[0, 2], [1, 1], [2, 0], [1, 0]]);
  });

  it('encodes feature metrics', () => {
    const property = umlExcerpt().classes.find(c => c.name === 'Property')!;
    const profiles = buildFeatureProfiles([...property.attributes, ...property.references], 'target', noLexicalSource, DEFAULT_SETTINGS);
    expect(profiles.map(p => [p.ref.kind, p.ref.containingClass, p.metrics])).toEqual([
      ['attribute', 'uml.Property', [0, 0, 1, 0, 1]],
      ['reference', 'uml.Property', [1, 0, 1, 0, 2]],
    ]);
  });
});
