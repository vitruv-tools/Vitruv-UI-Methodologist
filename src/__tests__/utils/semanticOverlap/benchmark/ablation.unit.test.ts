import type { ImprovementId } from '../../../../utils/semanticOverlap/improved/settings';
import { classify, delta, selectCombination, summarise, type ConfigurationResult } from './ablation';

const scores = (fMeasure: number) => ({ class: { precision: fMeasure, recall: fMeasure, fMeasure } });

describe('ablation decision rule', () => {
  it('needs +0.02 on the family average and no family losing more than 0.02 to be helpful', () => {
    expect(classify(0.02, [0.05, -0.01])).toBe('helpful');
    expect(classify(0.0199, [0.05])).toBe('neutral');
    expect(classify(0.05, [0.2, -0.021])).toBe('neutral');
    expect(classify(0.05, [0.2, -0.02])).toBe('helpful');
    // A family loss just above the threshold blocks "helpful", however large the average gain.
    expect(classify(0.3, [0.9, 0.3, -0.021])).toBe('neutral');
  });

  it('calls an average loss of more than 0.02 harmful', () => {
    expect(classify(-0.02, [-0.02])).toBe('neutral');
    expect(classify(-0.021, [0])).toBe('harmful');
  });

  it('computes deltas of the class-level F-measure per family, per scenario and on the family average', () => {
    const before = summarise([], [['fig1', scores(1)], ['brake-bom', scores(0)]]);
    const after = summarise(['type-object'], [['fig1', scores(0.9)], ['brake-bom', scores(0.8)]]);
    const d = delta(before, after);
    expect(d.average).toBeCloseTo(0.35);
    expect(d.perFamily.fig1).toBeCloseTo(-0.1);
    expect(d.perFamily['brake-bom']).toBeCloseTo(0.8);
    expect(d.perScenario['brake-bom']).toBeCloseTo(0.8);
  });

  it('weights families equally: two scenarios of one family count as one', () => {
    // brake-bom and bom-brake form one family; Fig. 1 is another.
    const result = summarise([], [['fig1', scores(0)], ['brake-bom', scores(1)], ['bom-brake', scores(0.6)]]);
    expect(result.perFamily['brake-bom']?.fMeasure).toBeCloseTo(0.8);
    expect(result.average.fMeasure).toBeCloseTo(0.4);
    // The rule sees one delta per family, not per scenario.
    const better = summarise([], [['fig1', scores(0.05)], ['brake-bom', scores(1)], ['bom-brake', scores(0.6)]]);
    expect(Object.keys(delta(result, better).perFamily)).toEqual(['fig1', 'brake-bom']);
  });
});

describe('combination procedure', () => {
  /** Fake evaluation: one scenario whose F is given by a function of the enabled improvements. */
  const evaluator = (f: (enabled: ImprovementId[]) => number) => (enabled: ImprovementId[]): ConfigurationResult => {
    return summarise(enabled, [['fig1', scores(f(enabled))]]);
  };
  const has = (enabled: ImprovementId[], id: ImprovementId) => enabled.includes(id);

  it('drops an improvement that another one overshadows', () => {
    // idf and roles each add 0.1 alone, but together only 0.1: idf adds nothing once roles is on.
    const evaluate = evaluator(e => 0.5 + (has(e, 'roles') || has(e, 'idf') ? 0.1 : 0));
    const { final, steps } = selectCombination(evaluate, [
      { improvement: 'idf', classification: 'helpful' }, { improvement: 'roles', classification: 'helpful' },
    ]);
    expect(final).toHaveLength(1);
    expect(steps.some(s => s.step === 'leave-one-out' && !s.kept)).toBe(true);
    expect(steps.every(s => s.reason.length > 0)).toBe(true);
  });

  it('adds an improvement that only helps together with others', () => {
    // flooding alone adds nothing, but with type-object it adds 0.05.
    const evaluate = evaluator(e => 0.4 + (has(e, 'type-object') ? 0.3 : 0) + (has(e, 'type-object') && has(e, 'flooding') ? 0.05 : 0));
    const { final, steps } = selectCombination(evaluate, [
      { improvement: 'type-object', classification: 'helpful' }, { improvement: 'flooding', classification: 'neutral' },
    ]);
    expect(final).toEqual(['type-object', 'flooding']);
    expect(steps.find(s => s.improvement === 'flooding' && s.step === 'add-one')?.kept).toBe(true);
  });

  it('keeps every improvement whose removal costs at least the threshold', () => {
    const evaluate = evaluator(e => 0.3 + (has(e, 'roles') ? 0.1 : 0) + (has(e, 'type-object') ? 0.3 : 0));
    const { final } = selectCombination(evaluate, [
      { improvement: 'roles', classification: 'helpful' }, { improvement: 'type-object', classification: 'helpful' },
      { improvement: 'datatypes', classification: 'harmful' },
    ]);
    expect(final).toEqual(['roles', 'type-object']);
  });
});
