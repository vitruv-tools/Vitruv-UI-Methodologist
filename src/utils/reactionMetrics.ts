export interface ReactionBlockMetrics {
  name: string;
  linesOfCode: number;
}

export interface ReactionFileMetrics {
  reactionCount: number;
  routineCount: number;
  correspondenceTypeCount: number;
  linesOfCode: number;
  reactions: ReactionBlockMetrics[];
}

const EMPTY: ReactionFileMetrics = {
  reactionCount: 0,
  routineCount: 0,
  correspondenceTypeCount: 0,
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
  const re = new RegExp(`\\b${keyword}(?:\\s+([A-Za-z_]\\w*))?\\s*\\{`, 'g');
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

function collectCorrespondenceTypes(code: string): number {
  const types = new Set<string>();
  const between = /add\s+correspondence\s+between\s+(\S+)\s+and\s+(\S+)/gi;
  let match: RegExpExecArray | null;
  while ((match = between.exec(code)) !== null) {
    types.add(`${match[1]}::${match[2]}`);
  }
  const corresponding = /corresponding\s+to\s+(\S+)/gi;
  while ((match = corresponding.exec(code)) !== null) {
    types.add(`corresponding:${match[1]}`);
  }
  return types.size;
}

export function parseReactionFileMetrics(code: string | null | undefined): ReactionFileMetrics {
  if (!code?.trim()) return { ...EMPTY };

  const stripped = stripComments(code);
  const reactions = collectNamedBlocks(stripped, 'reaction');
  const routines = collectNamedBlocks(stripped, 'routine');
  const parsedTypes = collectCorrespondenceTypes(stripped);

  return {
    reactionCount: reactions.length,
    routineCount: routines.length,
    correspondenceTypeCount: parsedTypes,
    linesOfCode: countNonEmptyLines(stripped),
    reactions,
  };
}

export function countOclConstraints(oclContent: string | null | undefined): number {
  if (!oclContent?.trim()) return 0;
  return [...oclContent.matchAll(/\binv\s+\w+\s*:/g)].length;
}
