const STORAGE_KEY = 'vitruv_ocl_metrics_v1';

export function oclStorageKey(vsumId: string): string {
  return `${STORAGE_KEY}_${vsumId}`;
}

export function readStoredOcl(vsumId: string): string {
  try {
    return localStorage.getItem(oclStorageKey(vsumId)) ?? '';
  } catch {
    return '';
  }
}

export function writeStoredOcl(vsumId: string, oclContent: string): void {
  try {
    localStorage.setItem(oclStorageKey(vsumId), oclContent);
  } catch {
    // Ignore quota / private-mode failures; metrics will show empty OCL.
  }
}
