/** Shared DOM helpers for reading Ecore XML. */

export function parseEcoreDocument(ecoreContent: string): Document | null {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(ecoreContent, 'text/xml');
  if (xmlDoc.getElementsByTagName('parsererror').length > 0) return null;
  return xmlDoc;
}

export function getElementType(el: Element): string {
  return el.getAttribute('xsi:type') || el.getAttribute('type') || '';
}

function isEClassElement(el: Element): boolean {
  const type = getElementType(el);
  return type.includes('EClass') || (!type && el.querySelectorAll('eStructuralFeatures').length > 0);
}

export function collectClassElements(xmlDoc: Document): Element[] {
  return Array.from(xmlDoc.querySelectorAll('eClassifiers')).filter(isEClassElement);
}
