/**
 * Trigger a browser file download from a Blob.
 * Revokes the object URL after a short delay so the download can start reliably.
 */
export function downloadBlobAsFile(blob: Blob, filename: string): void {
  const url = globalThis.URL.createObjectURL(blob);
  const link = globalThis.document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  globalThis.document.body.appendChild(link);
  link.click();
  globalThis.setTimeout(() => {
    link.remove();
    globalThis.URL.revokeObjectURL(url);
  }, 1000);
}

/** Trigger a browser download for text content (e.g. .ecore / .genmodel). */
export function downloadTextAsFile(
  content: string,
  filename: string,
  mimeType = 'text/plain;charset=utf-8',
): void {
  downloadBlobAsFile(new Blob([content], { type: mimeType }), filename);
}
