/** Stored by the backend when create omits `version`. */
export const DEFAULT_META_MODEL_VERSION = '1.0';

/**
 * Version string to show for a metamodel.
 * A missing or blank value is the backend default, `"1.0"`.
 */
export function displayMetaModelVersion(version?: string | null): string {
  const trimmed = typeof version === 'string' ? version.trim() : '';
  return trimmed || DEFAULT_META_MODEL_VERSION;
}

/** `Name (version)` when a version is present; otherwise the name alone. */
export function appendMetaModelVersion(name: string, version?: string | null): string {
  const trimmed = typeof version === 'string' ? version.trim() : '';
  return trimmed ? `${name} (${trimmed})` : name;
}
