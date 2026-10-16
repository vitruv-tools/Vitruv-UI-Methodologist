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

const RULE_SETS_CLEARED_KEY = 'vitruv_rule_sets_cleared_v1';

/**
 * Whether the user deleted all rule sets of this project in this browser. The predefined rule sets
 * are then not offered again, so deleting them sticks.
 */
export function hasClearedRuleSets(vsumId: string): boolean {
  try {
    return localStorage.getItem(`${RULE_SETS_CLEARED_KEY}_${vsumId}`) === '1';
  } catch {
    return false;
  }
}

export function markRuleSetsCleared(vsumId: string): void {
  try {
    localStorage.setItem(`${RULE_SETS_CLEARED_KEY}_${vsumId}`, '1');
  } catch {
    // Ignore quota / private-mode failures; the predefined rule sets may then be offered again.
  }
}
