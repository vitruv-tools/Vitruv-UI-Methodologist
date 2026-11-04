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

function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
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
    types.add([a, b].sort().join('<->'));
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

/** Class or type names mentioned in a reactions file (qualified ::Type and PascalCase tokens). */
export function extractMentionedClassNames(code: string | null | undefined): string[] {
  if (!code?.trim()) return [];
  const stripped = stripComments(code);
  const names = new Set<string>();
  for (const match of stripped.matchAll(/::([A-Za-z_]\w*)/g)) {
    names.add(match[1]);
  }
  for (const match of stripped.matchAll(/\b([A-Z]\w*)\b/g)) {
    names.add(match[1]);
  }
  return [...names];
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

export function parseOclConstraints(oclContent: string | null | undefined): { name: string; contextClass: string }[] {
  if (!oclContent?.trim()) return [];
  const constraints: { name: string; contextClass: string }[] = [];
  let contextClass = '';
  for (const line of oclContent.split(/\r?\n/)) {
    const contextMatch = /^\s*context\s+([\w:]+)/i.exec(line);
    if (contextMatch) {
      const qualified = contextMatch[1];
      contextClass = qualified.split('::').pop() || qualified;
    }
    const invMatch = /\binv\s+(\w+)\s*:/.exec(line);
    if (invMatch) {
      constraints.push({ name: invMatch[1], contextClass });
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
