import { findEcoreDownloadProblem, readBlobAsText } from '../../utils/ecoreDownload';

const ECORE = '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<ecore:EPackage xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" name="m"/>';

describe('findEcoreDownloadProblem', () => {
  it.each([
    ['a package with an XML declaration', ECORE],
    ['a package without a declaration', '<ecore:EPackage name="m"/>'],
    ['a byte order mark and leading whitespace', `﻿  \n${ECORE}`],
    ['comments before the root', '<?xml version="1.0"?>\n<!-- generated -->\n<ecore:EPackage name="m"/>'],
    ['several packages wrapped in XMI', '<?xml version="1.0"?><xmi:XMI xmi:version="2.0"><ecore:EPackage/></xmi:XMI>'],
  ])('accepts %s', (_label, content) => {
    expect(findEcoreDownloadProblem(content, 'text/plain')).toBeNull();
  });

  it('accepts a package whatever non-HTML content type the server sends', () => {
    expect(findEcoreDownloadProblem(ECORE, null)).toBeNull();
    expect(findEcoreDownloadProblem(ECORE, 'application/xml')).toBeNull();
    expect(findEcoreDownloadProblem(ECORE, 'application/octet-stream')).toBeNull();
  });

  it.each([
    ['text/html; charset=utf-8'],
    ['application/xhtml+xml'],
  ])('rejects a %s response as a web page', (contentType) => {
    expect(findEcoreDownloadProblem(ECORE, contentType)).toMatch(/returned a web page/);
  });

  it.each([
    ['a doctype', '<!DOCTYPE html>\n<html><body>File viewer</body></html>'],
    ['an html element', '<html lang="en"><head><title>Sign in</title></head></html>'],
    ['a comment before the page', '<!-- cache -->\n<!doctype HTML><html></html>'],
    ['an XML declaration before the page', '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"></html>'],
    ['a bare body', '<body>Not found</body>'],
  ])('recognizes an HTML page that starts with %s, whatever the content type', (_label, content) => {
    expect(findEcoreDownloadProblem(content, 'text/plain')).toMatch(/returned a web page/);
  });

  it('rejects an empty download', () => {
    expect(findEcoreDownloadProblem('  \n ', 'text/plain')).toMatch(/empty file/);
  });

  it('rejects content that is not XML', () => {
    expect(findEcoreDownloadProblem('{"error":"not found"}', 'application/json'))
      .toMatch(/not XML/);
  });

  it('rejects XML whose root is not a package, naming the root', () => {
    expect(findEcoreDownloadProblem('<?xml version="1.0"?><Error><Code>NoSuchKey</Code></Error>', 'application/xml'))
      .toBe('The URL did not return an .ecore file: expected an EPackage, but the file starts with <Error>.');
  });

  it('does not loop on an unterminated comment', () => {
    expect(findEcoreDownloadProblem('<!-- never closed', 'text/plain')).toMatch(/not XML/);
  });
});

describe('readBlobAsText', () => {
  it('reads the text of a blob', async () => {
    await expect(readBlobAsText(new Blob([ECORE]))).resolves.toBe(ECORE);
  });
});
