/** Words that carry no domain meaning in metamodel element names. */
const STOP_WORDS = new Set(['of', 'the', 'a', 'to', 'is', 'has', 'get', 'set']);

/**
 * Splits an element name into lower-case vocabulary tokens (paper §3.2.1, Camel Case Splitter):
 * camelCase/PascalCase and acronym boundaries, `_`, `-`, `.`, digit runs. Single letters (e.g. the
 * Ecore `E` prefix) and stop words are dropped.
 */
export function tokenize(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .split(/[\s_\-.]+/)
    .map(token => token.toLowerCase())
    .filter(token => token.length > 1 && !/^\d+$/.test(token) && !STOP_WORDS.has(token));
}
