import {
  ECORE_XML_NAMESPACE,
  NEW_META_MODEL_NS_URI_BASE,
  XSI_XML_NAMESPACE,
} from './ecoreXmlNamespaces';

/** Package name used when the meta model name has no letters or digits to build one from. */
const FALLBACK_PACKAGE_NAME = 'model';

/**
 * Derive an EPackage name from a meta model name.
 *
 * EMF code generation turns the package name into a Java package, so the result only contains
 * lowercase ASCII letters and digits and never starts with a digit. Accents are dropped rather
 * than the whole letter: "Família Tree" becomes "familiatree".
 */
export function toEPackageName(metaModelName: string): string {
  const withoutAccents = metaModelName.normalize('NFD').replaceAll(/\p{M}/gu, '');
  const name = withoutAccents.replaceAll(/[^A-Za-z0-9]/g, '').toLowerCase();
  if (!name) return FALLBACK_PACKAGE_NAME;
  return /^\d/.test(name) ? `_${name}` : name;
}

/**
 * Ecore XML for a meta model created from scratch: a single EPackage without classifiers.
 * The package name doubles as nsPrefix and as the last segment of the nsURI.
 */
export function createEmptyEcore(metaModelName: string): string {
  const packageName = toEPackageName(metaModelName);
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<ecore:EPackage xmlns:xsi="${XSI_XML_NAMESPACE}" xmlns:ecore="${ECORE_XML_NAMESPACE}"` +
    ` name="${packageName}" nsURI="${NEW_META_MODEL_NS_URI_BASE}${packageName}"` +
    ` nsPrefix="${packageName}"/>\n`
  );
}

/** The empty Ecore as a file for the upload endpoint, named after its package. */
export function createEmptyEcoreFile(metaModelName: string): File {
  return new File(
    [createEmptyEcore(metaModelName)],
    `${toEPackageName(metaModelName)}.ecore`,
    { type: 'application/xml' },
  );
}
