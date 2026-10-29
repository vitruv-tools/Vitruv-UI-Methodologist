/** Common abbreviations in metamodel names and the words they stand for (kept small on purpose). */
export const ABBREVIATIONS: Readonly<Record<string, readonly string[]>> = {
  bom: ['bill', 'material'],
  abs: ['antilock', 'brake', 'system'],
  oem: ['original', 'equipment', 'manufacturer'],
  id: ['identifier'],
  mm: ['millimetre'],
  qty: ['quantity'],
  desc: ['description'],
  num: ['number'],
  no: ['number'],
  def: ['definition'],
  val: ['value'],
  attr: ['attribute'],
  ref: ['reference'],
};

/** Expansion of an abbreviation, or an empty list. */
export const expandAbbreviation = (token: string): readonly string[] => ABBREVIATIONS[token] ?? [];

/** Words of a name split at case, digit and separator boundaries, lower-cased, stop words kept. */
export function rawWords(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_\-.\d]+/)
    .filter(Boolean)
    .map(word => word.toLowerCase());
}

/** The name as an acronym (`BOM` → `bom`) if it is written in capitals only, else undefined. */
export function acronymOf(name: string): string | undefined {
  return /^[A-Z]{2,6}$/.test(name) ? name.toLowerCase() : undefined;
}

/**
 * Initials a matching acronym may have: of all words, and of the words without short function
 * words (`BillOfMaterials` → `bom`, `bm`).
 */
export function initialsOf(words: readonly string[]): string[] {
  const all = words.map(w => w[0]).join('');
  const content = words.filter(w => w.length > 2).map(w => w[0]).join('');
  return [...new Set([all, content].filter(initials => initials.length >= 2))];
}

/** True if the acronym equals the initials of the words (`BOM` ↔ `bill`, `of`, `materials`). */
export const acronymMatches = (acronym: string, words: readonly string[]) =>
  initialsOf(words).includes(acronym.toLowerCase());
