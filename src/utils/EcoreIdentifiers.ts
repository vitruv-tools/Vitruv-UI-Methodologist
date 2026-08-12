/**
 * Ecore identifier helpers.
 *
 * Extracted from the old branch's UMLFromEcoreTS.ts — only the identity
 * / separator utilities needed by the Low Code reaction wiring.
 * Does NOT replace develop's ecoreToUml.ts / umlGenerator.ts.
 */

/** Separator between package segments in an EObject FQ id. */
export const PACKAGE_SEPARATOR = '/';

/** Separator between the model nsURI and the EObject path. */
export const FRAGMENT_SEPARATOR = '#';

/** Separator between the class name and feature name in a FQ feature id. */
export const FEATURE_SEPARATOR = '.';

/**
 * Build a fully-qualified EObject id from a model nsURI and a class name.
 *
 * Example: `buildEObjectId("http://example.org/model", "Person")` →
 *          `"http://example.org/model#Person"`
 */
export function buildEObjectId(modelNsUri: string, className: string): string {
  return `${modelNsUri}${FRAGMENT_SEPARATOR}${className}`;
}

/**
 * Build a fully-qualified EObject feature id.
 *
 * Example: `buildEObjectFeatureId("http://example.org/model", "Person", "name")` →
 *          `"http://example.org/model#Person.name"`
 */
export function buildEObjectFeatureId(
  modelNsUri: string,
  className: string,
  featureName: string,
): string {
  return `${modelNsUri}${FRAGMENT_SEPARATOR}${className}${FEATURE_SEPARATOR}${featureName}`;
}

/**
 * Parse a FQ EObject id into model and element parts.
 *
 * Returns `null` if the id does not contain a fragment separator.
 */
export function parseEObjectId(fqId: string): {
  modelNsUri: string;
  elementPath: string;
} | null {
  const idx = fqId.indexOf(FRAGMENT_SEPARATOR);
  if (idx < 0) return null;
  return {
    modelNsUri: fqId.substring(0, idx),
    elementPath: fqId.substring(idx + 1),
  };
}

/**
 * Extract the model nsURI from a FQ EObject id.
 * Returns the full string if no fragment separator is found.
 */
export function extractModelFromEObjectId(fqId: string): string {
  const idx = fqId.indexOf(FRAGMENT_SEPARATOR);
  return idx >= 0 ? fqId.substring(0, idx) : fqId;
}

/**
 * Extract the element path (class or class.feature) from a FQ EObject id.
 * Returns the full string if no fragment separator is found.
 */
export function extractElementFromEObjectId(fqId: string): string {
  const idx = fqId.indexOf(FRAGMENT_SEPARATOR);
  return idx >= 0 ? fqId.substring(idx + 1) : fqId;
}

/**
 * Extract the class name from an element path (strips feature suffix if present).
 */
export function extractClassFromElementPath(elementPath: string): string {
  const dotIdx = elementPath.indexOf(FEATURE_SEPARATOR);
  return dotIdx >= 0 ? elementPath.substring(0, dotIdx) : elementPath;
}

/**
 * Derive a short alias from a model nsURI.
 *
 * Example: `"http://example.org/myModel"` → `"myModel"`
 */
export function deriveModelAlias(modelNsUri: string): string {
  const cleaned = modelNsUri.replace(/\/+$/, '');
  const lastSlash = cleaned.lastIndexOf('/');
  return lastSlash >= 0 ? cleaned.substring(lastSlash + 1) : cleaned;
}

/**
 * Derive a short alias from a FQ EObject id.
 *
 * Example: `"http://example.org/model#Person.name"` → `"name"`
 *          `"http://example.org/model#Person"` → `"Person"`
 */
export function deriveElementAlias(fqId: string): string {
  const element = extractElementFromEObjectId(fqId);
  const dotIdx = element.lastIndexOf(FEATURE_SEPARATOR);
  return dotIdx >= 0 ? element.substring(dotIdx + 1) : element;
}

/**
 * Resolve a handle id to the underlying EObject FQ id.
 *
 * Handle ids follow the convention: `reaction-{source|target}-{eObjectFqId}`
 * Returns `null` if the handle id does not match the convention.
 */
export function getProperEObjectIdFromHandle(handleId: string): string | null {
  const prefix = 'reaction-';
  if (!handleId.startsWith(prefix)) return null;
  const rest = handleId.substring(prefix.length);
  const dashIdx = rest.indexOf('-');
  if (dashIdx < 0) return null;
  return rest.substring(dashIdx + 1);
}

/**
 * Extract the nsURI from raw ecore XML content.
 *
 * Lightweight regex extraction — does not parse full XML.
 */
export function extractNsUriFromEcore(ecoreContent: string): string | null {
  const match = ecoreContent.match(/nsURI="([^"]+)"/);
  return match ? match[1] : null;
}
