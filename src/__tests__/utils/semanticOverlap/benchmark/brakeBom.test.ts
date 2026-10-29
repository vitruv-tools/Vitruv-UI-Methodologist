import { existsSync } from 'node:fs';
import { resolveImprovedSettings } from '../../../../utils/semanticOverlap/improved/settings';
import { resolveSettings } from '../../../../utils/semanticOverlap/settings';
import { BRAKE_FILE, SEEDS, formatScores, loadScenario, pairKeys, runScenario } from './suite';

/**
 * Brake Specification Model ↔ BOM (local brake model, skipped when it is missing, e.g. in CI).
 * The paper approach finds no correspondence; the improved approach's defaults must reach the
 * targets below.
 */
describe.skipIf(!existsSync(BRAKE_FILE))('Brake ↔ BOM benchmark', () => {
  const brakeBom = loadScenario('brake-bom')!;
  const bomBrake = loadScenario('bom-brake')!;
  const paper = runScenario(brakeBom, 'paper', seed => resolveSettings({ seed }));
  const improved = runScenario(brakeBom, 'improved', seed => resolveImprovedSettings({ seed }));
  const reverse = runScenario(bomBrake, 'improved', seed => resolveImprovedSettings({ seed }));

  it('reports both approaches', () => {
    console.log([
      'Scenario      approach   class                     feature',
      `Brake -> BOM  paper      ${formatScores(paper.scores.class)}    ${formatScores(paper.scores.feature)}`,
      `Brake -> BOM  improved   ${formatScores(improved.scores.class)}    ${formatScores(improved.scores.feature)}`,
      `BOM -> Brake  improved   ${formatScores(reverse.scores.class)}    ${formatScores(reverse.scores.feature)}`,
    ].join('\n'));
    expect(paper.scores.class.fMeasure).toBe(0);
  });

  it('reaches class-level F ≥ 0.70 on Brake -> BOM and finds the key correspondences in ≥ 8 of 10 seeds', () => {
    expect(improved.scores.class.fMeasure).toBeGreaterThanOrEqual(0.7);
    const keysPerSeed = improved.results.map(result => new Set(result.correspondences.flatMap(c =>
      c.sources.flatMap(s => c.targets.map(t => `${s.qualifiedName} -> ${t.qualifiedName} #${c.kind ?? 'same'}${c.instance ? `/${c.instance.role}` : ''}`)))));
    const seedsWith = (key: string) => keysPerSeed.filter(keys => keys.has(key)).length;
    expect(seedsWith('brakesystem.Brakesystem -> bom.BOM #same')).toBeGreaterThanOrEqual(8);
    expect(seedsWith('brakesystem.BrakeComponent -> bom.Item #same')).toBeGreaterThanOrEqual(8);
    const subclasses = ['ABSSensor', 'BrakeCaliper', 'BrakeHose', 'BrakeDisk', 'BrakePad']
      .filter(name => seedsWith(`brakesystem.${name} -> bom.ItemType #instance/type`) >= 8);
    expect(subclasses.length).toBeGreaterThanOrEqual(4);
  });

  it('reaches class-level F ≥ 0.60 on BOM -> Brake', () => {
    expect(reverse.scores.class.fMeasure).toBeGreaterThanOrEqual(0.6);
  });

  it('finds ≥ 80 % of the attribute → definition instances with the right data-type subclass', () => {
    const expected = pairKeys((brakeBom.reference.features ?? []).filter(e => e.role === 'definition'));
    expect(expected.size).toBe(24);
    const rates = improved.results.map(result => {
      const proposed = pairKeys(result.correspondences.flatMap(c => c.children ?? []).map(c => ({
        sources: c.sources.map(s => s.qualifiedName), targets: c.targets.map(t => t.qualifiedName), kind: c.kind, role: c.instance?.role,
      })));
      return [...expected].filter(key => proposed.has(key)).length / expected.size;
    });
    expect(rates.reduce((sum, rate) => sum + rate, 0) / SEEDS.length).toBeGreaterThanOrEqual(0.8);
  });
});
