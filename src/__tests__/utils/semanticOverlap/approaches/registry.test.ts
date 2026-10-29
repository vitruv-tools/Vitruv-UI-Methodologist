import { APPROACHES, DEFAULT_APPROACH } from '../../../../utils/semanticOverlap/approaches/registry';
import { improvementsOf } from '../../../../utils/semanticOverlap/improved/settings';
import { createWordNetSource } from '../../../../utils/semanticOverlap/lexical/wordNetSource';
import { runOverlapAnalysis } from '../../../../utils/semanticOverlap/runOverlapAnalysis';
import { resolveSettings } from '../../../../utils/semanticOverlap/settings';
import table from '../../../../assets/wordnet/oewn-2025-synonyms.json';
import { ecoreExcerpt, umlExcerpt } from '../fixtures';

const deps = { lexical: createWordNetSource(table), now: () => 0, createId: () => 'r' };

describe('approach registry', () => {
  it('offers the paper and the improved approach', () => {
    expect(Object.keys(APPROACHES)).toEqual(['paper', 'improved']);
    expect(APPROACHES.paper).toMatchObject({ label: 'Kessentini et al. 2014 (paper)', version: '2014.1' });
    // Version 0.2: defaults set from the ablation run over the benchmark suite.
    expect(APPROACHES.improved).toMatchObject({ label: 'Improved', version: '0.2' });
    // The improved approach meets the Brake ↔ BOM and Ecore → UML 2.0 benchmark thresholds.
    expect(DEFAULT_APPROACH).toBe('improved');
  });

  it('runs the paper approach unchanged and labels the result', () => {
    const input = { source: ecoreExcerpt(), target: umlExcerpt(), settings: resolveSettings({ seed: 5 }, 'fast') };
    const before = JSON.stringify(input);
    const result = APPROACHES.paper.run(input, deps);
    expect(JSON.stringify(input)).toBe(before);
    const { approach, ...rest } = result;
    expect(approach).toEqual({ id: 'paper', version: '2014.1' });
    expect(rest).toEqual(runOverlapAnalysis(input, deps));
  });

  it('labels improved results', () => {
    const settings = { ...APPROACHES.improved.defaultSettings(), seed: 5 };
    const result = APPROACHES.improved.run({ source: ecoreExcerpt(), target: umlExcerpt(), settings }, deps);
    expect(result.approach).toEqual({ id: 'improved', version: '0.2' });
  });

  it('names the resources an approach needs', () => {
    const improved = APPROACHES.improved.defaultSettings();
    expect(APPROACHES.paper.requiredResources(APPROACHES.paper.defaultSettings())).toEqual(['synonyms']);
    expect(APPROACHES.improved.requiredResources({ ...improved, improvements: improvementsOf([]) })).toEqual(['synonyms']);
    expect(APPROACHES.improved.requiredResources({ ...improved, improvements: improvementsOf(['hypernyms']) })).toEqual(['synonyms', 'hypernyms']);
    expect(APPROACHES.improved.requiredResources({ ...improved, improvements: improvementsOf(['compounds']) })).toEqual(['synonyms', 'hypernyms']);
  });

  it('creates defaults with a fresh random seed', () => {
    const seeds = new Set(Array.from({ length: 5 }, () => APPROACHES.paper.defaultSettings().seed));
    expect(seeds.size).toBeGreaterThan(1);
    expect(APPROACHES.improved.validate(APPROACHES.improved.defaultSettings())).toEqual([]);
  });
});
