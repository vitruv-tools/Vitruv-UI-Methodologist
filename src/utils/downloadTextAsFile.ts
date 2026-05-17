/**
 * Triggers a browser download for text content (e.g. .ecore / .genmodel XML).
 */
export function downloadTextAsFile(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
