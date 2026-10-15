/**
 * Checks for content downloaded from an .ecore URL before it is uploaded.
 *
 * File viewers, login and error pages usually answer with status 200, so a
 * successful download does not prove that the URL pointed at the raw file.
 */

const WEB_PAGE_PROBLEM =
  'The URL returned a web page, not the .ecore file itself. Use a link to the raw file '
  + '(for example on raw.githubusercontent.com), or download the file and upload it.';

const HTML_CONTENT_TYPE = /\b(?:text\/html|application\/xhtml\+xml)\b/i;
const HTML_ROOT = /^<(?:!doctype\s+html|html|head|body)\b/i;
const ROOT_ELEMENT = /^<([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)/;

/** Root elements an .ecore file can have: one package, or several wrapped in XMI. */
const ECORE_ROOT_ELEMENTS = new Set(['EPackage', 'XMI']);

/** Skips the XML declaration, processing instructions, comments and a non-HTML doctype. */
function skipXmlPrologue(text: string): string {
  let rest = text.trimStart();
  for (;;) {
    let terminator: string | null = null;
    if (rest.startsWith('<?')) terminator = '?>';
    else if (rest.startsWith('<!--')) terminator = '-->';
    else if (/^<!doctype\s/i.test(rest) && !HTML_ROOT.test(rest)) terminator = '>';
    if (terminator === null) return rest;

    const end = rest.indexOf(terminator);
    if (end < 0) return rest;
    rest = rest.slice(end + terminator.length).trimStart();
  }
}

/**
 * Returns why downloaded content cannot be an .ecore file, or `null` if it looks like one.
 *
 * @param content the downloaded content as text
 * @param contentType the Content-Type the server sent, if known
 */
export function findEcoreDownloadProblem(
  content: string,
  contentType?: string | null,
): string | null {
  if (contentType && HTML_CONTENT_TYPE.test(contentType)) return WEB_PAGE_PROBLEM;

  const text = content.replace(/^﻿/, '').trim();
  if (!text) return 'The URL returned an empty file instead of an .ecore file.';

  const body = skipXmlPrologue(text);
  if (HTML_ROOT.test(body)) return WEB_PAGE_PROBLEM;

  const rootName = ROOT_ELEMENT.exec(body)?.[1];
  if (!rootName) return 'The URL did not return an .ecore file: the content is not XML.';

  const localName = rootName.slice(rootName.indexOf(':') + 1);
  if (!ECORE_ROOT_ELEMENTS.has(localName)) {
    return `The URL did not return an .ecore file: expected an EPackage, but the file starts with <${rootName}>.`;
  }
  return null;
}

/** Reads a downloaded file as text (Blob.text() is missing in older browsers and jsdom). */
export function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the downloaded file.'));
    reader.readAsText(blob);
  });
}
