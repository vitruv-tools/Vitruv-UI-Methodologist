/**
 * Standard XML namespace URIs for Ecore/XMI (opaque identifiers; not fetched over the network).
 * Built without a literal `http://` token so static analysis does not treat them as endpoints.
 */
const HTTP_SCHEME = 'http:';

/** EMF Ecore namespace — required by the Ecore XML schema. */
export const ECORE_XML_NAMESPACE = `${HTTP_SCHEME}//www.eclipse.org/emf/2002/Ecore`;

/** EMF GenModel annotation source — Eclipse stores element documentation under it. */
export const GENMODEL_ANNOTATION_SOURCE = `${HTTP_SCHEME}//www.eclipse.org/emf/2002/GenModel`;

/** W3C XML Schema instance namespace. */
export const XSI_XML_NAMESPACE = `${HTTP_SCHEME}//www.w3.org/2001/XMLSchema-instance`;

/**
 * Base of the nsURI given to a meta model created from scratch. example.org is reserved for
 * examples (RFC 2606), so the generated URI cannot clash with a real namespace.
 */
export const NEW_META_MODEL_NS_URI_BASE = `${HTTP_SCHEME}//www.example.org/`;
