/** Cryptographically strong suffix for non-security-critical unique filenames. */
export function randomUniqueSuffix(): string {
  const webCrypto = globalThis === undefined
    ? undefined
    : (globalThis as { crypto?: Crypto }).crypto;

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
