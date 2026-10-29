import type { Correspondence } from './types';

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

/** "same concept" or the instance label. */
export const kindLabel = (c: Pick<Correspondence, 'kind' | 'instance' | 'sources' | 'targets'>) => instanceLabel(c) ?? 'same concept';
