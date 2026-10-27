import { DEFAULT_SETTINGS, EFFORT_PRESETS, resolveSettings, validateSettings } from '../../../utils/semanticOverlap/settings';

describe('semantic overlap settings', () => {
  it('uses the paper defaults and is valid', () => {
    expect(DEFAULT_SETTINGS.weights).toEqual({ structural: 0.5, syntactic: 0.5 });
    expect(DEFAULT_SETTINGS.syntactic).toEqual({ alpha: 0.5, beta: 0.5 });
    expect(DEFAULT_SETTINGS.strategy).toBe('hybrid-ga-sa');
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual([]);
    expect(DEFAULT_SETTINGS).not.toHaveProperty('minScore');
  });

  it('scales the effort presets relative to balanced', () => {
    expect(EFFORT_PRESETS.balanced.ga.populationSize).toBe(60);
    expect(EFFORT_PRESETS.balanced.ga.generations).toBe(150);
    expect(EFFORT_PRESETS.fast.ga.populationSize).toBe(24);
    expect(EFFORT_PRESETS.thorough.ga.generations).toBe(375);
    expect(EFFORT_PRESETS.thorough.sa.iterationsPerElement).toBe(2.5);
  });

  it('takes GA/SA parameters from an explicitly chosen effort', () => {
    const settings = resolveSettings({ seed: 7, ga: { ...EFFORT_PRESETS.balanced.ga, populationSize: 3 } }, 'fast');
    expect(settings.seed).toBe(7);
    expect(settings.ga.populationSize).toBe(24);
    expect(resolveSettings({ ga: { ...EFFORT_PRESETS.balanced.ga, populationSize: 3 } }).ga.populationSize).toBe(3);
  });

  it.each([
    ['weights not adding up to 1', { weights: { structural: 0.6, syntactic: 0.6 } }],
    ['alpha/beta not adding up to 1', { syntactic: { alpha: 0.2, beta: 0.2 } }],
    ['a negative seed', { seed: -1 }],
    ['a seed above uint32', { seed: 2 ** 32 }],
    ['a fractional seed', { seed: 1.5 }],
    ['zero max targets', { maxTargetsPerElement: 0 }],
    ['six max targets', { maxTargetsPerElement: 6 }],
    ['a null score above 1', { nullScore: 1.2 }],
    ['a cooling factor of 1', { sa: { ...DEFAULT_SETTINGS.sa, coolingFactor: 1 } }],
  ])('rejects %s', (_label, override) => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, ...override })).not.toEqual([]);
  });
});
