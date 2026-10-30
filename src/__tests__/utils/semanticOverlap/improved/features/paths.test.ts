import { pathCandidates, pickPaths } from '../../../../../utils/semanticOverlap/improved/features/paths';
import type { MatchingProblem } from '../../../../../utils/semanticOverlap/improved/matchingProblem';
import type { ElementRef } from '../../../../../utils/semanticOverlap/types';
import { loadScenario } from '../../benchmark/suite';
import { cls, graph, reference, attribute } from '../graphBuilders';

const node: ElementRef = { side: 'target', kind: 'class', qualifiedName: 'graph.Node', name: 'Node' };

describe('path correspondences', () => {
  const tree2graph = loadScenario('tree2graph')!;

  it('builds length-2 navigations from the class, without round trips over the opposite', () => {
    const candidates = pathCandidates(tree2graph.target, [node], 'target');
    expect(candidates.map(c => c.ref.qualifiedName)).toEqual(['graph.Node.incoming.source', 'graph.Node.outgoing.target']);
    expect(candidates[0].ref).toEqual({
      side: 'target', kind: 'reference', qualifiedName: 'graph.Node.incoming.source', name: 'incoming.source',
      containingClass: 'graph.Node', path: ['incoming', 'source'],
    });
  });

  it('collapses multiplicities (many over anything is many) and keeps the type of the last feature', () => {
    const [first] = pathCandidates(tree2graph.target, [node], 'target');
    expect(first.feature).toMatchObject({ kind: 'reference', name: 'incoming source', typeName: 'Node', upper: -1, lower: 0, owner: 'graph.Node' });
  });

  it('includes inherited references and inherited second features', () => {
    const g = graph([
      cls('p', 'Base', { references: [reference('p.Base', 'link', 'Target')] }),
      cls('p', 'Start', { superTypes: ['p.Base'] }),
      cls('p', 'Named', { attributes: [attribute('p.Named', 'name', 'EString')] }),
      cls('p', 'Target', { superTypes: ['p.Named'] }),
    ], 'p');
    const start: ElementRef = { side: 'source', kind: 'class', qualifiedName: 'p.Start', name: 'Start' };
    expect(pathCandidates(g, [start], 'source').map(c => c.ref.qualifiedName)).toEqual(['p.Start.link.name']);
  });

  const problem = (combined: number[], sources: string[], targets: string[]) => ({
    n: sources.length, m: targets.length, matrices: { combined: Float32Array.from(combined) },
    sources: sources.map(qualifiedName => ({ ref: { qualifiedName } })), targets: targets.map(qualifiedName => ({ ref: { qualifiedName } })),
  }) as unknown as MatchingProblem;

  it('picks the best pairs at or above τ, each element once', () => {
    const picks = pickPaths(problem([0.6, 0.5, 0.55, 0.2], ['a.x', 'a.y'], ['b.p', 'b.q']), 0.3);
    expect(picks).toEqual([{ source: 0, target: 0 }]);
    expect(pickPaths(problem([0.2, 0.1], ['a.x'], ['b.p', 'b.q']), 0.25)).toEqual([]);
  });

  it('breaks ties by qualified name, so the result is deterministic', () => {
    expect(pickPaths(problem([0.5, 0.5], ['a.x'], ['b.q', 'b.p']), 0.3)).toEqual([{ source: 0, target: 1 }]);
  });
});
