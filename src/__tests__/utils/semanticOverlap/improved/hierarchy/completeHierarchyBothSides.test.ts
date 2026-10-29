import { completeHierarchyBothSides } from '../../../../../utils/semanticOverlap/improved/hierarchy/completeHierarchyBothSides';
import { createMatchingProblem } from '../../../../../utils/semanticOverlap/improved/matchingProblem';
import { createDefaultMeasureRegistry } from '../../../../../utils/semanticOverlap/improved/measures/registry';
import { computeMatrices } from '../../../../../utils/semanticOverlap/improved/measures/similarityMatrices';
import { completeHierarchy } from '../../../../../utils/semanticOverlap/improved/runImprovedAnalysis';
import { resolveImprovedSettings } from '../../../../../utils/semanticOverlap/improved/settings';
import type { ClassNode, MetamodelGraph } from '../../../../../utils/semanticOverlap/types';
import { profile } from '../../helpers';
import { refFor } from '../../fixtures';

const node = (name: string, superTypes: string[] = []): ClassNode => ({
  qualifiedName: `p.${name}`, name, isAbstract: false, isInterface: false, superTypes: superTypes.map(s => `p.${s}`),
  attributes: [], references: [], operations: [],
});
const graph = (classes: ClassNode[]): MetamodelGraph =>
  ({ ref: refFor('p'), rootPackage: 'p', nsUri: null, classes, enums: [], unresolvedSupertypes: [] });

// Source: Part ← Bolt ← SmallBolt; Other is unrelated. Target: Item, Thing.
const source = graph([node('Part'), node('Bolt', ['Part']), node('SmallBolt', ['Bolt']), node('Other')]);
const target = graph([node('Item'), node('Thing')]);

function problemWith(scores: number[][], maxTargetsPerElement = 3) {
  const sources = source.classes.map(c => profile(c.name, 'source'));
  const targets = target.classes.map(c => profile(c.name, 'target'));
  const settings = resolveImprovedSettings({ seed: 1, nullScore: 0.3, maxTargetsPerElement });
  const matrices = computeMatrices('class', sources, targets, createDefaultMeasureRegistry(), settings);
  scores.forEach((row, i) => row.forEach((value, j) => { matrices.combined[i * targets.length + j] = value; }));
  return createMatchingProblem('class', sources, targets, matrices, createDefaultMeasureRegistry(), settings);
}

describe('hierarchy completion on both sides', () => {
  const scores = [[0.8, 0.1], [0.5, 0.1], [0.4, 0.1], [0.6, 0.2]];

  it('keeps the target-side behaviour of the paper approach', () => {
    const problem = problemWith(scores);
    const solution = { assignments: [[0], [], [], []], fitness: 0 };
    expect(completeHierarchyBothSides(problem, solution, source, target).assignments.slice(0, 1))
      .toEqual(completeHierarchy(problem, solution, target).assignments.slice(0, 1));
  });

  it('adds unmatched sources whose best target is matched to a super- or subclass', () => {
    const problem = problemWith(scores);
    const result = completeHierarchyBothSides(problem, { assignments: [[0], [], [], []], fitness: 0 }, source, target);
    // Bolt (direct) and SmallBolt (transitive) join Part → Item; Other is unrelated.
    expect(result.assignments).toEqual([[0], [0], [0], []]);
  });

  it('requires the null score and limits how many sources share a target', () => {
    const low = problemWith([[0.8, 0.1], [0.2, 0.1], [0.25, 0.1], [0.1, 0.1]]);
    expect(completeHierarchyBothSides(low, { assignments: [[0], [], [], []], fitness: 0 }, source, target).assignments)
      .toEqual([[0], [], [], []]);
    const limited = problemWith(scores, 2);
    expect(completeHierarchyBothSides(limited, { assignments: [[0], [], [], []], fitness: 0 }, source, target).assignments)
      .toEqual([[0], [0], [], []]);
  });

  it('leaves fixed elements alone', () => {
    const problem = problemWith(scores);
    const fixed = { sources: new Set([1]), targets: new Set<number>() };
    expect(completeHierarchyBothSides(problem, { assignments: [[0], [], [], []], fitness: 0 }, source, target, fixed).assignments)
      .toEqual([[0], [], [0], []]);
  });
});
