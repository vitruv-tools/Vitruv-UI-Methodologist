/** Cryptographically strong suffix for non-security-critical unique filenames. */
export function randomUniqueSuffix(): string {
  const webCrypto = typeof globalThis !== 'undefined'
    ? (globalThis as { crypto?: Crypto }).crypto
    : undefined;

  if (webCrypto?.randomUUID) {
    return webCrypto.randomUUID();
  }
  if (webCrypto?.getRandomValues) {
    const array = new Uint32Array(2);
    webCrypto.getRandomValues(array);
    return Array.from(array, n => n.toString(36)).join('');
  }
  return `${Date.now()}-${performance.now()}`;
}
