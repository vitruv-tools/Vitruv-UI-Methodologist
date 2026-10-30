import { calibrate } from './calibrate';
import { loadScenario, type LoadedScenario } from './suite';

describe('calibration of the acceptance threshold', () => {
  const scenarios = [loadScenario('fig1')!, loadScenario('wimmer-1')!, loadScenario('wimmer-3')!];

  it('takes the midpoint of the family-weighted means of correct and incorrect class pairs', () => {
    const calibration = calibrate([], scenarios);
    expect(Object.keys(calibration.perFamily)).toEqual(['fig1', 'wimmer']);
    const { fig1, wimmer } = calibration.perFamily;
    expect(calibration.meanCorrect).toBeCloseTo((fig1!.meanCorrect + wimmer!.meanCorrect) / 2);
    expect(calibration.meanIncorrect).toBeCloseTo((fig1!.meanIncorrect + wimmer!.meanIncorrect) / 2);
    expect(calibration.tau).toBeCloseTo((calibration.meanCorrect + calibration.meanIncorrect) / 2, 3);
    expect(calibration.meanCorrect).toBeGreaterThan(calibration.meanIncorrect);
  });

  it('weights families equally: a family with two scenarios counts once', () => {
    const wimmerOnly = calibrate([], scenarios.slice(1));
    const both = calibrate([], scenarios);
    expect(both.perFamily.wimmer).toEqual(wimmerOnly.perFamily.wimmer);
  });

  it('runs no search, so the result does not depend on the seed and is repeatable', () => {
    const shifted: LoadedScenario[] = scenarios.map(s => ({ ...s }));
    expect(calibrate(['calibrated-null'], shifted)).toEqual({ ...calibrate([], scenarios), configuration: ['calibrated-null'] });
  });
});
