export interface ReactionBlockMetrics {
  name: string;
  linesOfCode: number;
}

export interface ReactionFileMetrics {
  reactionCount: number;
  routineCount: number;
  correspondenceTypeCount: number;
  /** Distinct correspondence types, keyed by the actual (unordered) type pair. */
  correspondenceTypeKeys: string[];
  linesOfCode: number;
  reactions: ReactionBlockMetrics[];
}

const EMPTY: ReactionFileMetrics = {
  reactionCount: 0,
  routineCount: 0,
  correspondenceTypeCount: 0,
  correspondenceTypeKeys: [],
  linesOfCode: 0,
  reactions: [],
};

/** Index just past the string literal that opens at `start`; an unterminated one ends at its line. */
function endOfStringLiteral(code: string, start: number): number {
  const quote = code[start];
  let i = start + 1;
  while (i < code.length && code[i] !== quote && code[i] !== '\n') {
    i += code[i] === '\\' ? 2 : 1;
  }
  return Math.min(i + 1, code.length);
}

/** Index of the line break that ends the `//` comment at `start` (or the end of the text). */
function endOfLineComment(code: string, start: number): number {
  const end = code.indexOf('\n', start);
  return end === -1 ? code.length : end;
}

/** Index just past the block comment that opens at `start`. */
function endOfBlockComment(code: string, start: number): number {
  const end = code.indexOf('*/', start + 2);
  return end === -1 ? code.length : end + 2;
}

/** Removes `//` and block comments, leaving string literals (e.g. `"http://uri"`) untouched. */
function stripComments(code: string): string {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const pair = code.slice(i, i + 2);
    let end = i + 1;
    let keep = true;
    if (code[i] === '"' || code[i] === "'") end = endOfStringLiteral(code, i);
    else if (pair === '//') [end, keep] = [endOfLineComment(code, i), false];
    else if (pair === '/*') [end, keep] = [endOfBlockComment(code, i), false];
    if (keep) out += code.slice(i, end);
    i = end;
  }
  return out;
}

function countNonEmptyLines(text: string): number {
  return text.split(/\r?\n/).filter(line => line.trim().length > 0).length;
}

function extractBraceBlock(source: string, openIndex: number): { body: string; end: number } | null {
  if (openIndex < 0 || openIndex >= source.length || source[openIndex] !== '{') return null;
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return { body: source.slice(openIndex + 1, i), end: i + 1 };
      }
    }
  }
  return null;
}

function collectNamedBlocks(code: string, keyword: 'reaction' | 'routine'): ReactionBlockMetrics[] {
  const blocks: ReactionBlockMetrics[] = [];
  const re = new RegExp(String.raw`\b${keyword}(?:\s+([A-Za-z_]\w*))?\s*\{`, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(code)) !== null) {
    const name = match[1] ?? `${keyword} ${blocks.length + 1}`;
    const braceIndex = match.index + match[0].length - 1;
    const block = extractBraceBlock(code, braceIndex);
    const body = block?.body ?? '';
    blocks.push({ name, linesOfCode: Math.max(1, countNonEmptyLines(body)) });
    if (block) re.lastIndex = Math.max(re.lastIndex, block.end);
  }
  return blocks;
}

const TYPE_TOKEN = String.raw`[A-Za-z_]\w*(?:::[A-Za-z_]\w*)+|[A-Z]\w*`;

/** Maps variable names to the (qualified) type they are bound to in the file. */
function collectVariableTypes(code: string): Map<string, string> {
  const vars = new Map<string, string>();
  let match: RegExpExecArray | null;
  // after element Pkg::Type created/inserted/... (binds newValue / affectedEObject-like names)
  const afterElement = new RegExp(String.raw`\bafter\s+element\s+(${TYPE_TOKEN})\s+(?:created|deleted|inserted|removed|replaced)`, 'g');
  while ((match = afterElement.exec(code)) !== null) {
    vars.set('newValue', match[1]);
    vars.set('affectedEObject', match[1]);
  }
  // val x = new Pkg::Type / val x = create Pkg::Type / val x = retrieve [optional|many] Pkg::Type corresponding to ...
  const valNew = new RegExp(String.raw`\b(?:val|var)\s+([A-Za-z_]\w*)\s*=\s*(?:new\s+|create\s+)(${TYPE_TOKEN})`, 'g');
  while ((match = valNew.exec(code)) !== null) vars.set(match[1], match[2]);
  const valRetrieve = new RegExp(
    String.raw`\b(?:val|var)\s+([A-Za-z_]\w*)\s*=\s*retrieve(?:\s+(?:optional|many))?\s+(${TYPE_TOKEN})\b`,
    'g',
  );
  while ((match = valRetrieve.exec(code)) !== null) vars.set(match[1], match[2]);
  // typed routine parameters: routine name(Pkg::Type x, ...)
  const params = new RegExp(String.raw`\b(${TYPE_TOKEN})\s+([a-z_]\w*)\s*[,)]`, 'g');
  while ((match = params.exec(code)) !== null) if (!vars.has(match[2])) vars.set(match[2], match[1]);
  return vars;
}

function simpleTypeName(type: string): string {
  return type.split('::').pop() || type;
}

/**
 * Returns the distinct correspondence types declared in a reactions file, identified by
 * the (unordered) pair of actual element types rather than by variable names.
 */
export function collectCorrespondenceTypeKeys(code: string): string[] {
  const types = new Set<string>();
  const vars = collectVariableTypes(code);
  const resolve = (token: string): string | null => {
    const clean = token.replace(/[,;)(]/g, '');
    if (clean.includes('::') || /^[A-Z]/.test(clean)) return simpleTypeName(clean);
    const t = vars.get(clean);
    return t ? simpleTypeName(t) : null;
  };
  const pair = (a: string | null, b: string | null) => {
    if (!a || !b) return;
    types.add([a, b].sort((x, y) => x.localeCompare(y)).join('<->'));
  };
  let match: RegExpExecArray | null;
  const between = /add\s+correspondence\s+between\s+(\S+)\s+and\s+(\S+)/g;
  while ((match = between.exec(code)) !== null) pair(resolve(match[1]), resolve(match[2]));
  const retrieveRe = new RegExp(
    String.raw`retrieve(?:\s+(?:optional|many))?\s+(${TYPE_TOKEN})\s+corresponding\s+to\s+([A-Za-z_]\w*)`,
    'g',
  );
  while ((match = retrieveRe.exec(code)) !== null) pair(resolve(match[1]), resolve(match[2]));
  return [...types];
}

/** A metamodel class referenced as `qualifier::ClassName` in a reactions file. */
export interface ReactionClassReference {
  /** What precedes the class: an import alias (`Families`) or a package path (`a::b`). */
  qualifier: string;
  className: string;
}

/** What a reactions file declares about the metamodels it works with. */
export interface ReactionClassReferences {
  /** `import "uri" as Alias` declarations, keyed by alias. */
  aliases: Map<string, string>;
  /** Alias after `in reaction to changes in`, if any. */
  sourceAlias: string | null;
  /** Alias after `execute actions in`, if any. */
  targetAlias: string | null;
  references: ReactionClassReference[];
}

/** Blanks out string literals so words inside them are never read as code. */
function stripStringLiterals(code: string): string {
  return code.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
}

/** Drops Java and metamodel import lines (the latter are read before this runs). */
function stripImportLines(code: string): string {
  return code.replace(/^[ \t]*import\b[^\n]*$/gm, '');
}

/**
 * Finds the metamodel classes a reactions file refers to.
 *
 * Only `qualifier::ClassName` tokens in code count. Imports, string literals, comments and
 * unqualified words (Java/Xtend types like `String`, reaction names, …) are ignored, because
 * a reactions file can only name a metamodel class through its import alias.
 */
export function extractReactionClassReferences(code: string | null | undefined): ReactionClassReferences {
  const result: ReactionClassReferences = {
    aliases: new Map(),
    sourceAlias: null,
    targetAlias: null,
    references: [],
  };
  if (!code?.trim()) return result;

  const uncommented = stripComments(code);
  for (const match of uncommented.matchAll(/^[ \t]*import\s+"([^"\n]+)"\s+as\s+([A-Za-z_]\w*)/gm)) {
    result.aliases.set(match[2], match[1].trim());
  }
  result.sourceAlias = /\bin\s+reaction\s+to\s+changes\s+in\s+([A-Za-z_]\w*)/.exec(uncommented)?.[1] ?? null;
  result.targetAlias = /\bexecute\s+actions\s+in\s+([A-Za-z_]\w*)/.exec(uncommented)?.[1] ?? null;

  const body = stripStringLiterals(stripImportLines(uncommented));
  const seen = new Set<string>();
  for (const match of body.matchAll(/\b((?:[A-Za-z_]\w*::)+)([A-Za-z_]\w*)\b/g)) {
    const qualifier = match[1].slice(0, -2);
    const key = `${qualifier}::${match[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.references.push({ qualifier, className: match[2] });
  }
  return result;
}

export function parseReactionFileMetrics(code: string | null | undefined): ReactionFileMetrics {
  if (!code?.trim()) return { ...EMPTY };

  const stripped = stripComments(code);
  const reactions = collectNamedBlocks(stripped, 'reaction');
  const routines = collectNamedBlocks(stripped, 'routine');
  const typeKeys = collectCorrespondenceTypeKeys(stripped);

  return {
    reactionCount: reactions.length,
    routineCount: routines.length,
    correspondenceTypeCount: typeKeys.length,
    correspondenceTypeKeys: typeKeys,
    linesOfCode: countNonEmptyLines(stripped),
    reactions,
  };
}

export interface OclConstraint {
  name: string;
  /** Short name of the context class. */
  contextClass: string;
  /** Package qualifier written before the context class (`library` in `library::Book`), or `''`. */
  contextQualifier: string;
}

export function parseOclConstraints(oclContent: string | null | undefined): OclConstraint[] {
  if (!oclContent?.trim()) return [];
  const constraints: OclConstraint[] = [];
  let contextClass = '';
  let contextQualifier = '';
  for (const line of oclContent.split(/\r?\n/)) {
    const contextMatch = /^\s*context\s+([\w:]+)/i.exec(line);
    if (contextMatch) {
      const qualified = contextMatch[1];
      const parts = qualified.split('::').filter(Boolean);
      contextClass = parts.pop() || qualified;
      contextQualifier = parts.join('::');
    }
    const invMatch = /\binv\s+(\w+)\s*:/.exec(line);
    if (invMatch) {
      constraints.push({ name: invMatch[1], contextClass, contextQualifier });
    }
  }
  return constraints;
}

export function extractOclMentionedNames(oclContent: string | null | undefined): string[] {
  if (!oclContent?.trim()) return [];
  const names = new Set<string>();
  for (const constraint of parseOclConstraints(oclContent)) {
    if (constraint.contextClass) names.add(constraint.contextClass);
  }
  for (const match of oclContent.matchAll(/::([A-Za-z_]\w*)/g)) {
    names.add(match[1]);
  }
  for (const match of oclContent.matchAll(/\bself\.([A-Za-z_]\w*)/g)) {
    names.add(match[1]);
  }
  return [...names];
}

export function countOclConstraints(oclContent: string | null | undefined): number {
  return parseOclConstraints(oclContent).length;
}
