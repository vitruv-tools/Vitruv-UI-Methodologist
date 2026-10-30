import {
  DEFAULT_COMBINATION, DEFAULT_IMPROVED_SETTINGS, IMPROVEMENT_IDS, IMPROVEMENT_LABELS, resolveImprovedSettings, validateImprovedSettings,
  type ImprovedSettings,
} from '../../../../utils/semanticOverlap/improved/settings';
import { DEFAULT_SETTINGS, validateSettings } from '../../../../utils/semanticOverlap/settings';

describe('improved approach settings', () => {
  it('lists the 17 improvements in a fixed order with labels', () => {
    // The nine of 0.2, then the eight added in 0.3.
    expect(IMPROVEMENT_IDS).toEqual([
      'adaptive-weights', 'hypernyms', 'compounds', 'idf', 'roles', 'datatypes', 'type-object', 'flooding', 'hierarchy-both',
      'embeddings', 'structure-types', 'consistency', 'calibrated-null', 'paths', 'split-merge', 'conditional', 'alternatives',
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
      // Added in 0.3.
      embeddingWeight: 0.75, embeddingModel: 'minilm', embeddingMaxTexts: 3000, structureTypesWeight: 0.5,
      structureTypesMaxSignatures: 48, calibratedNullScore: 0.25, splitMaxParts: 3, pathMaxLength: 2, alternativesCount: 3,
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
    ['a negative embedding weight', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, embeddingWeight: -0.1 } })],
    ['an unknown embedding model', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, embeddingModel: 'gpt' } })],
    ['99 embedded descriptions', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, embeddingMaxTexts: 99 } })],
    ['20001 embedded descriptions', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, embeddingMaxTexts: 20001 } })],
    ['a negative data-structure weight', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, structureTypesWeight: -1 } })],
    ['7 compared features', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, structureTypesMaxSignatures: 7 } })],
    ['201 compared features', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, structureTypesMaxSignatures: 201 } })],
    ['a calibrated null score above 1', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, calibratedNullScore: 1.1 } })],
    ['one split part', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, splitMaxParts: 1 } })],
    ['four split parts', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, splitMaxParts: 4 } })],
    ['a path length of 3', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, pathMaxLength: 3 } })],
    ['zero alternatives', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, alternativesCount: 0 } })],
    ['four alternatives', (s: ImprovedSettings) => ({ ...s, params: { ...s.params, alternativesCount: 4 } })],
  ])('reports %s', (_label, change) => {
    expect(validateImprovedSettings(change(DEFAULT_IMPROVED_SETTINGS) as ImprovedSettings)).toHaveLength(1);
  });

  it.each([
    ['embeddingMaxTexts', 100], ['embeddingMaxTexts', 20000], ['structureTypesMaxSignatures', 8], ['structureTypesMaxSignatures', 200],
    ['calibratedNullScore', 0], ['calibratedNullScore', 1], ['splitMaxParts', 2], ['splitMaxParts', 3],
    ['alternativesCount', 1], ['alternativesCount', 3], ['embeddingModel', 'bge-small'],
  ])('accepts %s = %s', (param, value) => {
    expect(validateImprovedSettings({ ...DEFAULT_IMPROVED_SETTINGS, params: { ...DEFAULT_IMPROVED_SETTINGS.params, [param]: value } })).toEqual([]);
  });

  it('migrates 0.2 settings without the new keys: new improvements off, new parameters defaulted', () => {
    const old = { ...DEFAULT_SETTINGS, seed: 4,
      improvements: { 'adaptive-weights': false, hypernyms: true, compounds: false, idf: false, roles: false, datatypes: false,
        'type-object': true, flooding: false, 'hierarchy-both': false },
      params: { floodingWeight: 0.5, floodingMaxIterations: 30, hypernymWeight: 0.5, hypernymSenses: 3, roleWeight: 0.5,
        datatypeWeight: 0.5, typeObjectMinSubclasses: 2 } } as unknown as Partial<ImprovedSettings>;
    const migrated = resolveImprovedSettings(old);
    expect(validateImprovedSettings(migrated)).toEqual([]);
    expect(IMPROVEMENT_IDS.filter(id => migrated.improvements[id])).toEqual(['hypernyms', 'type-object']);
    expect(migrated.params).toEqual(DEFAULT_IMPROVED_SETTINGS.params);
  });

  it('includes the problems of the base settings', () => {
    const invalid = { ...DEFAULT_IMPROVED_SETTINGS, seed: -1 };
    expect(validateImprovedSettings(invalid)).toEqual(expect.arrayContaining(validateSettings(invalid)));
  });
});
