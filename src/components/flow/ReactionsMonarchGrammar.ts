import type { editor, languages } from 'monaco-editor';

export const reactionsMonarch: languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.reactions',

  keywords: [
    'absence', 'actions', 'after', 'and', 'anychange', 'as', 'asserted', 'at',
    'attribute', 'call', 'case', 'catch', 'changes', 'check', 'corresponding',
    'create', 'created', 'default', 'deleted', 'do', 'element', 'else',
    'execute', 'extends', 'extension', 'false', 'finally', 'for', 'from',
    'if', 'import', 'in', 'inserted', 'instanceof', 'many', 'match', 'names',
    'new', 'null', 'of', 'optional', 'plain', 'qualified', 'reaction',
    'reactions', 'removed', 'replaced', 'require', 'retrieve', 'return',
    'root', 'routine', 'routines', 'static', 'super', 'switch', 'synchronized',
    'tagged', 'throw', 'to', 'true', 'try', 'typeof', 'update', 'using',
    'val', 'var', 'while', 'with'
  ],

  operators: [
    '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
    '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
    '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=',
    '%=', '<<=', '>>=', '>>>='
  ],

  symbols: /[=><!~?:&|+\-/*^%]+/,

  escapes: /\\(?:[abfnrtv"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

  tokenizer: {
    root: [
      [/[a-zA-Z_]\w*/, {
        cases: {
          '@keywords': 'keyword',
          '@default': 'identifier'
        }
      }],

      { include: '@whitespace' },

      [/[{}()[\]]/, 'delimiter.bracket'],
      [/[<>](?!@symbols)/, 'delimiter.bracket'],
      [/@symbols/, {
        cases: {
          '@operators': 'operator',
          '@default': ''
        }
      }],

      [/\d*\.\d+([eE][+-]?\d+)?/, 'number.float'],
      [/0[xX][0-9a-fA-F]+/, 'number.hex'],
      [/\d+/, 'number'],

      [/[;,.]/, 'delimiter'],

      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],

      [/'[^\\']'/, 'string'],
      [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
      [/'/, 'string.invalid']
    ],

    comment: [
      [/[^/*]+/, 'comment'],
      [/\/\*/, 'comment', '@push'],
      [/\*\//, 'comment', '@pop'],
      [/[/*]/, 'comment']
    ],

    string: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
    ],

    whitespace: [
      [/[ \t\r\n]+/, 'white'],
      [/\/\*/, 'comment', '@comment'],
      [/\/\/.*$/, 'comment'],
    ],
  },
};

// Suffix matches the monarch tokenPostfix so these colors do not override OCL tokens.
function reactionTokenRules(colors: {
  keyword: string;
  delimiter: string;
  operator: string;
  comment: string;
  string: string;
}): editor.ITokenThemeRule[] {
  return [
    { token: 'keyword.reactions', foreground: colors.keyword },
    { token: 'delimiter.bracket.reactions', foreground: colors.delimiter },
    { token: 'delimiter.reactions', foreground: colors.delimiter },
    { token: 'operator.reactions', foreground: colors.operator },
    { token: 'comment.reactions', foreground: colors.comment, fontStyle: 'italic' },
    { token: 'string.reactions', foreground: colors.string },
  ];
}

export const reactionsLightTokenRules = reactionTokenRules({
  keyword: '0451A5',
  delimiter: 'AF00DB',
  operator: 'A31515',
  comment: '008000',
  string: 'A31515',
});

export const reactionsDarkTokenRules = reactionTokenRules({
  keyword: '569CD6',
  delimiter: 'DA70D6',
  operator: 'D16969',
  comment: '6A9955',
  string: 'CE9178',
});

export const reactionsTheme: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: reactionsDarkTokenRules,
  colors: {
    'editor.background': '#0f172a',
    'editor.foreground': '#f1f5f9',
  },
};

export const reactionsThemeLight: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: reactionsLightTokenRules,
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#0f172a',
  },
};

export const reactionsLanguageConfig: languages.LanguageConfiguration = {
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/']
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')']
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" }
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" }
  ]
};