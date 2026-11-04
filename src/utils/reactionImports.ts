/** The generated class holding the project's utility methods, which every reaction can call. */
export const UTILITY_CLASS_IMPORT = 'tools.vitruv.methodologisttemplate.consistency.utils.Utility';

const UTILITY_PACKAGE = UTILITY_CLASS_IMPORT.slice(0, UTILITY_CLASS_IMPORT.lastIndexOf('.'));
const IMPORT_LINE = `import ${UTILITY_CLASS_IMPORT}`;

/** A Java import of a reaction file, e.g. `import static a.b.C.*;`. */
interface JavaImport {
  isStatic: boolean;
  name: string;
}

/** Where the header of a reaction file ends and which Java imports it has. */
interface HeaderScan {
  /** Index of the last Java import line in the header, or -1. */
  lastJavaImport: number;
  /** Index of the first line after the Java imports (a metamodel import, `reactions:`, …), or -1. */
  headerEnd: number;
  hasUtilityImport: boolean;
}

function isNameCharacter(c: string): boolean {
  return /[\w$.*]/.test(c);
}

/** Parses a Java import line, or returns `null` if the line is something else. */
function parseJavaImport(line: string): JavaImport | null {
  if (!line.startsWith('import ')) return null;
  let rest = line.slice('import '.length).trim();
  if (rest.endsWith(';')) rest = rest.slice(0, -1).trimEnd();
  const isStatic = rest.startsWith('static ');
  if (isStatic) rest = rest.slice('static '.length).trim();
  if (!rest || ![...rest].every(isNameCharacter)) return null;
  return { isStatic, name: rest };
}

function importsUtilityClass({ isStatic, name }: JavaImport): boolean {
  if (isStatic) return name === `${UTILITY_CLASS_IMPORT}.*` || name.startsWith(`${UTILITY_CLASS_IMPORT}.`);
  return name === UTILITY_CLASS_IMPORT || name === `${UTILITY_PACKAGE}.*`;
}

/** The code of a line outside block comments, and whether a block comment is still open after it. */
function codeOf(line: string, inBlockComment: boolean): { code: string; inBlockComment: boolean } {
  let rest = line;
  let open = inBlockComment;
  let code = '';
  while (rest) {
    if (open) {
      const end = rest.indexOf('*/');
      if (end === -1) return { code: code.trim(), inBlockComment: true };
      rest = rest.slice(end + 2);
      open = false;
    } else {
      const lineComment = rest.indexOf('//');
      const blockComment = rest.indexOf('/*');
      if (blockComment === -1 || (lineComment !== -1 && lineComment < blockComment)) {
        code += lineComment === -1 ? rest : rest.slice(0, lineComment);
        break;
      }
      code += rest.slice(0, blockComment);
      rest = rest.slice(blockComment + 2);
      open = true;
    }
  }
  return { code: code.trim(), inBlockComment: open };
}

function scanHeader(lines: string[]): HeaderScan {
  const scan: HeaderScan = { lastJavaImport: -1, headerEnd: -1, hasUtilityImport: false };
  let inBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    const line = codeOf(lines[i], inBlockComment);
    inBlockComment = line.inBlockComment;
    if (!line.code) continue;
    const javaImport = parseJavaImport(line.code);
    if (!javaImport) {
      scan.headerEnd = i;
      return scan;
    }
    scan.lastJavaImport = i;
    scan.hasUtilityImport ||= importsUtilityClass(javaImport);
  }
  return scan;
}

/** Whether the reaction file imports the utility class, directly, by wildcard or statically. */
export function hasUtilityImport(code: string): boolean {
  return scanHeader(code.split(/\r?\n/)).hasUtilityImport;
}

/**
 * Adds the import of the utility class to a reaction file that lacks it: after its Java imports,
 * or before its first metamodel import or `reactions:` segment, followed by a blank line.
 *
 * @returns the code with the import, or `code` itself if it already imports the utility class
 */
export function ensureUtilityImport(code: string): string {
  const eol = code.includes('\r\n') ? '\r\n' : '\n';
  const lines = code.split(/\r?\n/);
  const scan = scanHeader(lines);
  if (scan.hasUtilityImport) return code;
  if (scan.lastJavaImport >= 0) {
    lines.splice(scan.lastJavaImport + 1, 0, IMPORT_LINE);
  } else if (scan.headerEnd >= 0) {
    lines.splice(scan.headerEnd, 0, IMPORT_LINE, '');
  } else if (code.trim()) {
    lines.splice(0, 0, IMPORT_LINE, '');
  } else {
    return code;
  }
  return lines.join(eol);
}
