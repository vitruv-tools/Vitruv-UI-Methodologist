import type { editor, languages } from 'monaco-editor';
import { reactionsMonarch } from './ReactionsMonarchGrammar';

/**
 * Keywords of NeoJoin.xtext. Multi-word forms (`conforms to`, `group by`) are two tokens.
 * Xbase expression keywords come from the reactions grammar, which NeoJoin embeds.
 */
const NEOJOIN_KEYWORDS = [
  'abstract', 'as', 'by', 'changeable', 'conforms', 'containment', 'create',
  'derived', 'EList', 'export', 'extends', 'from', 'group', 'id', 'import',
  'inner', 'join', 'left', 'on', 'ordered', 'param', 'root', 'strict', 'to',
  'transient', 'unique', 'unsettable', 'using', 'volatile', 'where', 'with',
];

const NEOJOIN_OPERATORS = [':=', '=>', '->', '..'];

export const neoJoinMonarch: languages.IMonarchLanguage = {
  ...reactionsMonarch,
  tokenPostfix: '.neojoin',
  keywords: [...new Set([...(reactionsMonarch.keywords as string[]), ...NEOJOIN_KEYWORDS])].sort((a, b) =>
    a.localeCompare(b),
  ),
  operators: [...new Set([...(reactionsMonarch.operators as string[]), ...NEOJOIN_OPERATORS])],
};

function neoJoinTokenRules(colors: {
  keyword: string;
  delimiter: string;
  operator: string;
  comment: string;
  string: string;
}): editor.ITokenThemeRule[] {
  return [
    { token: 'keyword.neojoin', foreground: colors.keyword },
    { token: 'delimiter.bracket.neojoin', foreground: colors.delimiter },
    { token: 'delimiter.neojoin', foreground: colors.delimiter },
    { token: 'operator.neojoin', foreground: colors.operator },
    { token: 'comment.neojoin', foreground: colors.comment, fontStyle: 'italic' },
    { token: 'string.neojoin', foreground: colors.string },
  ];
}

export const neoJoinLightTokenRules = neoJoinTokenRules({
  keyword: '0451A5',
  delimiter: 'AF00DB',
  operator: 'A31515',
  comment: '008000',
  string: 'A31515',
});

export const neoJoinDarkTokenRules = neoJoinTokenRules({
  keyword: '569CD6',
  delimiter: 'DA70D6',
  operator: 'D16969',
  comment: '6A9955',
  string: 'CE9178',
});

export const neoJoinLanguageConfig: languages.LanguageConfiguration = {
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/'],
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
};
