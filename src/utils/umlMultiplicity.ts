/** Parsed Ecore lower/upper bounds from a UML multiplicity string. */
export interface ParsedMultiplicity {
  lower: string;
  upper: string;
}

/** Parse UML multiplicity text (`1`, `0..*`, `[1..5]`) into Ecore bounds. */
export function parseMultiplicity(raw?: string | null): ParsedMultiplicity {
  const text = (raw ?? '').trim().replace(/^\[/, '').replace(/\]$/, '').trim();
  if (!text) return { lower: '0', upper: '1' };

  if (text.includes('..')) {
    const [lo, hi] = text.split('..').map(s => s.trim());
    const upper = hi === '*' ? '-1' : hi || '1';
    return { lower: lo || '0', upper };
  }

  return { lower: text, upper: text };
}

/** Format Ecore bounds as UML multiplicity (without brackets). */
export function formatMultiplicity(lower: string, upper: string): string {
  const normUpper = upper === '-1' ? '*' : upper;
  if (lower === normUpper) return lower;
  return `${lower}..${normUpper}`;
}

/** Format nullable Ecore lower/upper bounds as UML cardinality (e.g. `1`, `0..*`). */
export function formatEcoreMultiplicity(
  lower: string | null,
  upper: string | null,
): string | undefined {
  const normalizeUpper = (u: string | null) => {
    if (u === null) return undefined;
    if (u === '*' || u === '-1') return '*';
    return u;
  };
  const normLower = lower ?? undefined;
  const normUpper = normalizeUpper(upper);
  if (normLower === undefined && normUpper === undefined) return undefined;
  const lo = normLower ?? '1';
  const hi = normUpper ?? '1';
  return lo === hi ? lo : `${lo}..${hi}`;
}

/** Common UML cardinalities for association / composition ends. */
export const UML_RELATIONSHIP_MULTIPLICITY_OPTIONS = [
  '',
  '1',
  '0..1',
  '0..*',
  '1..*',
  '*',
] as const;

export const UML_RELATIONSHIP_MULTIPLICITY_LABELS: Record<string, string> = {
  '': '(none)',
  '1': '1 — exactly one',
  '0..1': '0..1 — optional',
  '0..*': '0..* — zero or more',
  '1..*': '1..* — one or more',
  '*': '* — many',
};

/** Strip optional brackets from multiplicity text shown in the UI. */
export function normalizeMultiplicityDisplay(value?: string | null): string {
  return (value ?? '').trim().replace(/^\[|\]$/g, '').trim();
}

/** Standard options plus the current value when it is a custom cardinality. */
export function relationshipMultiplicitySelectOptions(current?: string | null): string[] {
  const normalized = normalizeMultiplicityDisplay(current);
  const standard = [...UML_RELATIONSHIP_MULTIPLICITY_OPTIONS];
  if (!normalized || standard.includes(normalized as typeof standard[number])) {
    return standard;
  }
  return [normalized, ...standard];
}
