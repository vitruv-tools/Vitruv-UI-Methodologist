import {
  DEFAULT_COMBINATION, DEFAULT_IMPROVED_SETTINGS, IMPROVEMENT_IDS, IMPROVEMENT_LABELS, resolveImprovedSettings, validateImprovedSettings,
  type ImprovedSettings,
} from '../../../../utils/semanticOverlap/improved/settings';
import { DEFAULT_SETTINGS, validateSettings } from '../../../../utils/semanticOverlap/settings';

describe('improved approach settings', () => {
  it('lists the nine improvements in a fixed order with labels', () => {
    expect(IMPROVEMENT_IDS).toEqual([
      'adaptive-weights', 'hypernyms', 'compounds', 'idf', 'roles', 'datatypes', 'type-object', 'flooding', 'hierarchy-both',
    ]);
    expect(Object.keys(IMPROVEMENT_LABELS).sort()).toEqual([...IMPROVEMENT_IDS].sort());
  });

  it('switches on the combination selected by the ablation', () => {
    expect(DEFAULT_COMBINATION).toEqual(['type-object']);
  });

  it('switches on exactly the default combination and keeps the paper defaults otherwise', () => {
    expect(IMPROVEMENT_IDS.filter(id => DEFAULT_IMPROVED_SETTINGS.improvements[id])).toEqual([...DEFAULT_COMBINATION]);
    const { improvements: _i, params: _p, ...base } = DEFAULT_IMPROVED_SETTINGS;
    expect(base).toEqual(DEFAULT_SETTINGS);
  });

  it('has documented parameter defaults', () => {
    expect(DEFAULT_IMPROVED_SETTINGS.params).toEqual({
      floodingWeight: 0.5, floodingMaxIterations: 30, hypernymWeight: 0.5, hypernymSenses: 3,
      roleWeight: 0.5, datatypeWeight: 0.5, typeObjectMinSubclasses: 2,
    });
    expect(validateImprovedSettings(DEFAULT_IMPROVED_SETTINGS)).toEqual([]);
  });

  it('merges partial improvements and parameters', () => {
    const settings = resolveImprovedSettings({ seed: 7, improvements: { idf: true } as ImprovedSettings['improvements'] }, 'fast');
    expect(settings.seed).toBe(7);
    expect(settings.improvements.idf).toBe(true);
    expect(settings.improvements.flooding).toBe(false);
    expect(settings.effort).toBe('fast');
  });

  it.each([
    ['a missing improvement key', (s: ImprovedSettings) => ({ ...s, improvements: { ...s.improvements, flooding: undefined } })],
    ['flooding weight above 1', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, floodingWeight: 1.5 } })],
    ['zero flooding iterations', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, floodingMaxIterations: 0 } })],
    ['fractional flooding iterations', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, floodingMaxIterations: 2.5 } })],
    ['a negative hypernym weight', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, hypernymWeight: -1 } })],
    ['eleven hypernym senses', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, hypernymSenses: 11 } })],
    ['a negative role weight', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, roleWeight: -0.1 } })],
    ['a negative data-type weight', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, datatypeWeight: -0.1 } })],
    ['one minimum subclass', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, typeObjectMinSubclasses: 1 } })],
  ])('reports %s', (_label, change) => {
    expect(validateImprovedSettings(change(DEFAULT_IMPROVED_SETTINGS) as ImprovedSettings)).toHaveLength(1);
  });

  it('includes the problems of the base settings', () => {
    const invalid = { ...DEFAULT_IMPROVED_SETTINGS, seed: -1 };
    expect(validateImprovedSettings(invalid)).toEqual(expect.arrayContaining(validateSettings(invalid)));
  });
});
