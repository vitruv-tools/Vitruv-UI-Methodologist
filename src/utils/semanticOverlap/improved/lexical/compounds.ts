const MIN_PART = 3;

/**
 * Splits a token that is no dictionary word into 2–3 dictionary words of at least 3 letters
 * (`brakesystem` → `brake`, `system`). Fewer parts win, then the longest first part. Returns the
 * token unchanged when it is a word itself or cannot be split.
 */
export function splitCompound(token: string, isWord: (word: string) => boolean): string[] {
  if (isWord(token) || token.length < 2 * MIN_PART) return [token];
  for (let i = token.length - MIN_PART; i >= MIN_PART; i--) {
    if (isWord(token.slice(0, i)) && isWord(token.slice(i))) return [token.slice(0, i), token.slice(i)];
  }
  for (let i = token.length - 2 * MIN_PART; i >= MIN_PART; i--) {
    if (!isWord(token.slice(0, i))) continue;
    const rest = token.slice(i);
    for (let j = rest.length - MIN_PART; j >= MIN_PART; j--) {
      if (isWord(rest.slice(0, j)) && isWord(rest.slice(j))) return [token.slice(0, i), rest.slice(0, j), rest.slice(j)];
    }
  }
  return [token];
}
