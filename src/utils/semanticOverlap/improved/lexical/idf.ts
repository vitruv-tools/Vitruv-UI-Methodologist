/** Number of documents (elements) each token occurs in; a token counts once per document. */
export function documentFrequencies(documents: readonly (readonly string[])[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const document of documents) {
    for (const token of new Set(document)) df.set(token, (df.get(token) ?? 0) + 1);
  }
  return df;
}

/**
 * Inverse document frequency `ln((N + 1) / (df + 1)) + 1`, normalised so that the rarest token
 * weighs 1: tokens shared by many elements (`name`, `type`, `value`) weigh less than distinctive ones.
 */
export function idfWeights(df: ReadonlyMap<string, number>, documentCount: number): Map<string, number> {
  const raw = new Map([...df].map(([token, count]) => [token, Math.log((documentCount + 1) / (count + 1)) + 1]));
  const max = Math.max(0, ...raw.values());
  return new Map([...raw].map(([token, weight]) => [token, max === 0 ? 1 : weight / max]));
}
