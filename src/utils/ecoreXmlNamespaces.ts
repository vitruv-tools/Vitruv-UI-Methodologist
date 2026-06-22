/**
 * Standard XML namespace URIs for Ecore/XMI (opaque identifiers; not fetched over the network).
 * Built without a literal `http://` token so static analysis does not treat them as endpoints.
 */
const HTTP_SCHEME = 'http:';

/** EMF Ecore namespace — required by the Ecore XML schema. */
export const ECORE_XML_NAMESPACE = `${HTTP_SCHEME}//www.eclipse.org/emf/2002/Ecore`;

/** W3C XML Schema instance namespace. */
export const XSI_XML_NAMESPACE = `${HTTP_SCHEME}//www.w3.org/2001/XMLSchema-instance`;
