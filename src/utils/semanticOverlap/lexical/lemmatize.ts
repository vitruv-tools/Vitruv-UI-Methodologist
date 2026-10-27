/** WordNet "morphy"-style detachment rules: suffix → replacements, tried in order. */
const DETACHMENT_RULES: ReadonlyArray<[string, readonly string[]]> = [
  ['ies', ['y']],
  ['ses', ['s']],
  ['xes', ['x']],
  ['zes', ['z']],
  ['ches', ['ch']],
  ['shes', ['sh']],
  ['ing', ['', 'e']],
  ['ed', ['', 'e']],
  ['est', ['']],
  ['er', ['']],
  ['s', ['']],
];

/**
 * Reduces an inflected token (e.g. `attributes`) to a known base word (`attribute`). A candidate is
 * accepted only if `isWord` knows it; otherwise the token is returned unchanged.
 */
export function lemmatize(token: string, isWord: (word: string) => boolean): string {
  if (isWord(token)) return token;
  for (const [suffix, replacements] of DETACHMENT_RULES) {
    if (!token.endsWith(suffix) || token.length <= suffix.length + 1) continue;
    const stem = token.slice(0, -suffix.length);
    for (const replacement of replacements) {
      const candidate = stem + replacement;
      if (isWord(candidate)) return candidate;
    }
  }
  return token;
}
