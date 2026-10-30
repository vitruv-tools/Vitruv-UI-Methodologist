import type { Correspondence, CorrespondenceKind } from './types';

/** True for class ↔ instance correspondences. */
export const isInstanceCorrespondence = (c: Pick<Correspondence, 'kind'>) => c.kind === 'instance';

/**
 * Short description of a class ↔ instance correspondence, e.g. "instance of ItemType" or
 * "instance of NumberParameterDefinition (definition)"; undefined for same-concept ones.
 */
export function instanceLabel(c: Pick<Correspondence, 'kind' | 'instance' | 'sources' | 'targets'>): string | undefined {
  if (c.kind !== 'instance' || !c.instance) return undefined;
  const instantiated = (c.instance.side === 'source' ? c.sources : c.targets).map(ref => ref.name).join(', ');
  return c.instance.role === 'type' ? `instance of ${instantiated}` : `instance of ${instantiated} (${c.instance.role})`;
}

type KindFields = Pick<Correspondence, 'kind' | 'instance' | 'sources' | 'targets' | 'condition'>;

/** Names of the correspondence kinds, e.g. for filters and counts. */
export const KIND_NAMES: Record<CorrespondenceKind, string> = {
  same: 'Same concept',
  instance: 'Class ↔ instance',
  path: 'Path',
  split: 'Split',
  merge: 'Merge',
  conditional: 'Conditional',
};

/** Dash pattern of each kind's links and outlines (same-concept ones are solid). */
export const KIND_DASH: Record<CorrespondenceKind, string | undefined> = {
  same: undefined,
  instance: '6 4',
  path: '2 3',
  split: '10 3',
  merge: '10 3 2 3',
  conditional: '1 3',
};

export const kindOf = (c: Pick<Correspondence, 'kind'>): CorrespondenceKind => c.kind ?? 'same';

const simpleName = (qualifiedName: string) => qualifiedName.slice(qualifiedName.lastIndexOf('.') + 1);

/**
 * Short description of a path, split, merge or conditional correspondence: "path incoming.source",
 * "split into 2", "merge of 3", "kind = DISC"; undefined for the other kinds.
 */
export function structuralKindLabel(c: KindFields): string | undefined {
  switch (c.kind) {
    case 'path': {
      const path = [...c.sources, ...c.targets].find(ref => ref.path);
      return `path ${path?.path?.join('.') ?? ''}`.trim();
    }
    case 'split': return `split into ${c.targets.length}`;
    case 'merge': return `merge of ${c.sources.length}`;
    case 'conditional': return c.condition ? `${simpleName(c.condition.attribute)} = ${c.condition.value}` : 'conditional';
    default: return undefined;
  }
}

/** "same concept", the instance label or the label of the other kinds. */
export const kindLabel = (c: KindFields) => instanceLabel(c) ?? structuralKindLabel(c) ?? 'same concept';
