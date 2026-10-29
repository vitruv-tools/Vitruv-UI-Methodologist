import {
  blend, buildClassGraph, pairEdgeCount, similarityFlooding, type ClassGraph,
} from '../../../../../utils/semanticOverlap/improved/flooding/similarityFlooding';
import type { ClassNode, FeatureNode, MetamodelGraph } from '../../../../../utils/semanticOverlap/types';
import { refFor } from '../../fixtures';

const reference = (owner: string, name: string, typeName: string, containment: boolean): FeatureNode => ({
  kind: 'reference', name, qualifiedName: `${owner}.${name}`, owner, typeName, typeCategory: 'class',
  lower: 0, upper: -1, containment, opposite: null,
});
const node = (pkg: string, name: string, refs: [string, string, boolean][] = [], superTypes: string[] = []): ClassNode => ({
  qualifiedName: `${pkg}.${name}`, name, isAbstract: false, isInterface: false, superTypes: superTypes.map(s => `${pkg}.${s}`),
  attributes: [], references: refs.map(([n, t, c]) => reference(`${pkg}.${name}`, n, t, c)), operations: [],
});
const graph = (pkg: string, classes: ClassNode[]): MetamodelGraph =>
  ({ ref: refFor(pkg), rootPackage: pkg, nsUri: null, classes, enums: [], unresolvedSupertypes: [] });

// Root contains Part; Leaf extends Part. Same shape on both sides with different names.
const left = graph('a', [node('a', 'Root', [['parts', 'Part', true]]), node('a', 'Part'), node('a', 'Leaf', [], ['Part'])]);
const right = graph('b', [node('b', 'Whole', [['pieces', 'Piece', true]]), node('b', 'Piece'), node('b', 'Twig', [], ['Piece'])]);

describe('similarity flooding', () => {
  it('builds labelled edges with inverses', () => {
    const g = buildClassGraph(left);
    expect(g.contains).toEqual([[1], [], []]);
    expect(g.containedBy).toEqual([[], [0], []]);
    expect(g.extends).toEqual([[], [], [1]]);
    expect(g.extendedBy).toEqual([[], [2], []]);
    expect(g.refers).toEqual([[], [], []]);
  });

  it('propagates only along equal labels with inverse-product coefficients', () => {
    const a: ClassGraph = { contains: [[1, 2], [], []], containedBy: [[], [0], [0]], refers: [[], [], []], referredBy: [[], [], []], extends: [[], [], []], extendedBy: [[], [], []] };
    const b: ClassGraph = { contains: [[1], []], containedBy: [[], [0]], refers: [[], []], referredBy: [[], []], extends: [[], []], extendedBy: [[], []] };
    expect(pairEdgeCount(a, b)).toBe(2 * 1 + 2 * 1);
    // Only (0,0) is similar at first; it flows to (1,1) and (2,1) with weight 1/(2·1) each.
    const { flood } = similarityFlooding(a, b, [1, 0, 0, 0, 0, 0], 3, 2, 1);
    // σ¹ before normalising: (0,0) = 1 + 1, (1,1) = (2,1) = 2 · 1/(2·1) = 1; normalised by the maximum 2.
    expect(Array.from(flood!)).toEqual([1, 0, 0, 0.5, 0, 0.5]);
  });

  it('gives the highest scores to the structurally corresponding pairs', () => {
    const uniform = new Array(9).fill(0.5);
    const { flood, iterations } = similarityFlooding(buildClassGraph(left), buildClassGraph(right), uniform, 3, 3, 30);
    const best = (i: number) => [0, 1, 2].reduce((b, j) => (flood![i * 3 + j] > flood![i * 3 + b] ? j : b), 0);
    expect([best(0), best(1), best(2)]).toEqual([0, 1, 2]);
    expect(iterations).toBeLessThanOrEqual(30);
  });

  it('stops after the maximum number of iterations', () => {
    expect(similarityFlooding(buildClassGraph(left), buildClassGraph(right), new Array(9).fill(0.5), 3, 3, 2).iterations).toBe(2);
  });

  it('blends the fixpoint into the combined scores', () => {
    const blended = blend([0.2, 0.8], [1, 0], 0.5);
    expect(blended[0]).toBeCloseTo(0.6);
    expect(blended[1]).toBeCloseTo(0.4);
  });

  it('is skipped for graphs with too many pair edges', () => {
    const star = (k: number): ClassGraph => ({
      contains: [Array.from({ length: k }, (_, i) => i + 1), ...Array.from({ length: k }, () => [])],
      containedBy: [[], ...Array.from({ length: k }, () => [0])],
      refers: Array.from({ length: k + 1 }, () => []), referredBy: Array.from({ length: k + 1 }, () => []),
      extends: Array.from({ length: k + 1 }, () => []), extendedBy: Array.from({ length: k + 1 }, () => []),
    });
    // (2000 + 2000) · ... edges: 2000·2000·2 = 8M > 5M
    expect(similarityFlooding(star(2000), star(2000), [], 2001, 2001, 1).flood).toBeNull();
  });
});
