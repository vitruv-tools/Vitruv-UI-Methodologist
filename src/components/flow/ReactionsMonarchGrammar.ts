import type { languages } from 'monaco-editor';
import * as monaco from 'monaco-editor';

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

export const reactionsTheme: monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: '569CD6' },           // Blau für Keywords
    { token: 'delimiter.bracket', foreground: 'DA70D6' }, // Pink für {}[]()
    { token: 'delimiter', foreground: 'DA70D6' },         // Pink für ,;:
    { token: 'operator', foreground: 'D16969' },          // Rot für ==, !=, &&, etc.
  ],
  colors: {}
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