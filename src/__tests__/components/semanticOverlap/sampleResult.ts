import { createWordNetSource } from '../../../utils/semanticOverlap/lexical/wordNetSource';
import { runOverlapAnalysis } from '../../../utils/semanticOverlap/runOverlapAnalysis';
import { resolveSettings } from '../../../utils/semanticOverlap/settings';
import type { OverlapResult } from '../../../utils/semanticOverlap/types';
import table from '../../../assets/wordnet/oewn-2025-synonyms.json';
import { ecoreExcerpt, umlExcerpt } from '../../utils/semanticOverlap/fixtures';
import { runImprovedAnalysis } from '../../../utils/semanticOverlap/improved/runImprovedAnalysis';
import { improvementsOf, resolveImprovedSettings } from '../../../utils/semanticOverlap/improved/settings';
import { assembly, shop } from '../../utils/semanticOverlap/improved/typeObject/typeObjectFixtures';
import { describeAll } from '../../../utils/semanticOverlap/improved/embeddings/describe';
import { fakeTable } from '../../utils/semanticOverlap/improved/embeddings/fakeEmbeddingSource';

/** Deterministic Fig. 1 result: EClass↔Class, {EAttribute, EReference}↔Property, Association unmatched. */
export function sampleResult(seed = 42): OverlapResult {
  return runOverlapAnalysis(
    { source: ecoreExcerpt(), target: umlExcerpt(), settings: resolveSettings({ seed }) },
    { lexical: createWordNetSource(table), now: () => 0, createId: () => `result-${seed}` },
  );
}

export const correspondenceFor = (result: OverlapResult, sourceName: string) =>
  result.correspondences.find(c => c.sources.some(s => s.name === sourceName))!;

/**
 * Deterministic improved result with the type-object pattern (synthetic Assembly → Shop): same-concept
 * correspondences, two `Bolt/Nut ↔ ProductKind` instance correspondences with definition and value
 * children, the detected pattern and kind counts.
 */
export function sampleImprovedResult(seed = 42): OverlapResult {
  return runImprovedAnalysis(
    { source: assembly(), target: shop(), settings: resolveImprovedSettings({ seed, improvements: improvementsOf(['type-object']) }, 'fast') },
    { lexical: createWordNetSource(table), now: () => 0, createId: () => `improved-${seed}` },
  );
}

/** Deterministic improved Fig. 1 result with the embedding measure (fake vectors). */
export function sampleEmbeddingResult(seed = 42): OverlapResult {
  const [source, target] = [ecoreExcerpt(), umlExcerpt()];
  return runImprovedAnalysis(
    { source, target, settings: resolveImprovedSettings({ seed, improvements: improvementsOf(['embeddings']) }, 'fast') },
    {
      lexical: createWordNetSource(table), now: () => 0, createId: () => `embedding-${seed}`,
      embeddings: fakeTable(describeAll(source, target).map(d => d.text)),
    },
  );
}

/**
 * Fig. 1 result rewritten to contain each 0.3 kind once: a split `EClass ↔ Class, Association` with
 * a path child `EClass.abstract ↔ Class.ownedAttributes.isDerived`, a merge `EAttribute, EReference ↔
 * Property` and a conditional `EReference ↔ Association` (iD = true).
 */
export function sampleKindsResult(): OverlapResult {
  const base = sampleResult();
  const ref = (side: 'source' | 'target', qualifiedName: string, extra: object = {}) =>
    ({ side, kind: 'class' as const, qualifiedName, name: qualifiedName.split('.').pop()!, ...extra });
  const scores = (value: number) => ({ structural: value, syntactic: value });
  const path = {
    id: 'c-1-f-1', level: 'feature' as const, kind: 'path' as const, score: 0.6, scores: scores(0.6),
    sources: [ref('source', 'ecore.EClass.abstract', { kind: 'attribute', containingClass: 'ecore.EClass' })],
    targets: [ref('target', 'uml.Class.ownedAttributes.isDerived', {
      kind: 'attribute', name: 'ownedAttributes.isDerived', containingClass: 'uml.Class', path: ['ownedAttributes', 'isDerived'],
    })],
  };
  return {
    ...base,
    approach: { id: 'improved', version: '0.3' },
    correspondences: [
      { id: 'c-1', level: 'class', kind: 'split', score: 0.8, scores: scores(0.8), sources: [ref('source', 'ecore.EClass')],
        targets: [ref('target', 'uml.Association'), ref('target', 'uml.Class')], children: [path] },
      { id: 'c-2', level: 'class', kind: 'merge', score: 0.7, scores: scores(0.7),
        sources: [ref('source', 'ecore.EAttribute'), ref('source', 'ecore.EReference')], targets: [ref('target', 'uml.Property')], children: [] },
      { id: 'c-3', level: 'class', kind: 'conditional', fixed: true, score: 0.9, scores: { ...scores(0.3), conditional: 0.9 },
        condition: { attribute: 'ecore.EReference.containment', value: 'true' },
        sources: [ref('source', 'ecore.EReference')], targets: [ref('target', 'uml.Association')], children: [] },
    ],
    unmatched: { source: [], target: [] },
    summary: { ...base.summary, kindCounts: { same: 0, instance: 0, path: 1, split: 1, merge: 1, conditional: 1 } },
  };
}

/**
 * Fig. 1 result with three alternatives: lexical (only the first correspondence), balanced (the
 * result's own correspondences, the default) and structural (only the last one).
 */
export function sampleAlternativesResult(): OverlapResult {
  const base = sampleResult();
  const all = base.correspondences;
  const alternative = (label: string, correspondences: typeof all, isDefault = false) => {
    const used = new Set(correspondences.flatMap(c => [...c.sources, ...c.targets]).map(r => r.qualifiedName));
    const unmatched = {
      source: base.classMatrix.rows.filter(qn => !used.has(qn)).map(qn => ({ side: 'source' as const, kind: 'class' as const, qualifiedName: qn, name: qn.split('.').pop()! })),
      target: base.classMatrix.columns.filter(qn => !used.has(qn)).map(qn => ({ side: 'target' as const, kind: 'class' as const, qualifiedName: qn, name: qn.split('.').pop()! })),
    };
    return {
      label, isDefault, objectives: { lexical: isDefault ? 0.5 : 0.6, structural: 0.4 }, correspondences, unmatched,
      summary: { matchedSourceClasses: 3 - unmatched.source.length, matchedTargetClasses: 3 - unmatched.target.length, overlapPercent: 0 },
    };
  };
  const balanced = alternative('balanced', all, true);
  return {
    ...base,
    approach: { id: 'improved', version: '0.3' },
    unmatched: balanced.unmatched,
    alternatives: [alternative('lexical', all.slice(0, 1)), balanced, alternative('structural', all.slice(-1))],
  };
}
