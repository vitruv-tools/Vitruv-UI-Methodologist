import { readFileSync } from 'node:fs';
import { featuresWithInherited } from '../../../../utils/semanticOverlap/improved/runImprovedAnalysis';
import type { MetamodelGraph } from '../../../../utils/semanticOverlap/types';
import { loadScenario, pairKeys, readReference, scenarios, type ReferenceEntry } from './suite';

/** Resolves a class, a feature (own or inherited) or a path `<owner>.<r>.<g>` of a graph. */
function resolves(graph: MetamodelGraph, name: string): boolean {
  const classes = new Map(graph.classes.map(c => [c.qualifiedName, c]));
  if (classes.has(name)) return true;
  const featureOf = (owner: string, feature: string) =>
    featuresWithInherited(graph, owner).find(f => f.name === feature);
  const parts = name.split('.');
  for (let k = parts.length - 1; k >= 1; k--) {
    const owner = parts.slice(0, k).join('.');
    if (!classes.has(owner)) continue;
    const rest = parts.slice(k);
    if (rest.length === 1) return featureOf(owner, rest[0]) !== undefined;
    if (rest.length === 2) {
      // `typeName` is the simple name of the referenced class.
      const reference = featureOf(owner, rest[0]);
      const type = graph.classes.find(c => c.name === reference?.typeName);
      return reference?.kind === 'reference' && type !== undefined && featureOf(type.qualifiedName, rest[1]) !== undefined;
    }
  }
  return false;
}

const committed = scenarios().filter(s => s.origin === 'committed' && s.id !== 'fig1');
const downloaded = scenarios().filter(s => s.origin === 'downloaded' && s.id !== 'ecore-uml20');

describe('hand-made benchmark fixtures', () => {
  it('has the six Wimmer cases and Tree2Graph as committed scenarios', () => {
    expect(committed.map(s => s.id)).toEqual(['wimmer-1', 'wimmer-2', 'wimmer-3', 'wimmer-4', 'wimmer-5', 'wimmer-6', 'tree2graph']);
  });

  describe.each([...committed, ...downloaded].map(s => [s.label, s] as const))('%s', (_label, scenario) => {
    it.skipIf(!scenario.available)('parses, has no unresolved supertypes and resolves every reference name', () => {
      const loaded = loadScenario(scenario.id)!;
      expect(loaded.source.classes.length).toBeGreaterThan(0);
      expect(loaded.target.classes.length).toBeGreaterThan(0);
      expect(loaded.source.unresolvedSupertypes).toEqual([]);
      expect(loaded.target.unresolvedSupertypes).toEqual([]);
      const entries: ReferenceEntry[] = [...loaded.reference.correspondences, ...(loaded.reference.features ?? [])];
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        for (const name of entry.sources) expect({ name, resolves: resolves(loaded.source, name) }).toEqual({ name, resolves: true });
        for (const name of entry.targets) expect({ name, resolves: resolves(loaded.target, name) }).toEqual({ name, resolves: true });
      }
    });

    it('lists every source × target pair at most once, with one kind', () => {
      const reference = readReference(readFileSync(scenario.referenceFile, 'utf8'));
      for (const entries of [reference.correspondences, reference.features ?? []]) {
        const pairs = entries.flatMap(e => e.sources.flatMap(s => e.targets.map(t => `${s} -> ${t}`)));
        expect(pairs.length).toBe(new Set(pairs).size);
        expect(pairKeys(entries).size).toBe(pairs.length);
      }
    });
  });
});
