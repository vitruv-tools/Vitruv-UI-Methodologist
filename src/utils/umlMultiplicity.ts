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
