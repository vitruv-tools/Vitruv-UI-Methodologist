import * as monaco from 'monaco-editor';

export const vitruvOCLLanguageId = 'vitruvocl';

function popState(pattern: RegExp, token: string): monaco.languages.IMonarchLanguageRule[] {
  return [[/\s+/, ''], [pattern, token, '@pop'], [/./, { token: '', next: '@pop' }]];
}

export const vitruvOCLMonarch: monaco.languages.IMonarchLanguage = {
  keywords: ['if', 'then', 'else', 'endif', 'let', 'in', 'and', 'or', 'not', 'implies', 'xor'],
  typeKeywords: [
    'Integer', 'Real', 'String', 'Boolean', 'UnlimitedNatural',
    'OclAny', 'OclVoid', 'Set', 'Sequence', 'Bag', 'OrderedSet', 'Collection',
    'Optional', 'Singleton',
  ],
  constants: ['self', 'result', 'true', 'false', 'null', 'invalid', 'OclUndefined'],
  iterators: [
    'select', 'reject', 'collect', 'collectNested', 'forAll', 'exists',
    'any', 'one', 'isUnique', 'sortedBy', 'iterate',
  ],
  oclOps: [
    'isEmpty', 'notEmpty', 'includes', 'excludes', 'includesAll', 'excludesAll',
    'sum', 'count', 'min', 'max', 'first', 'last', 'at', 'union', 'intersection',
    'append', 'prepend', 'insertAt', 'subSequence', 'flatten',
    'asSet', 'asOrderedSet', 'asSequence', 'asBag', 'reverse',
    'size', 'concat', 'substring', 'indexOf', 'toUpperCase', 'toLowerCase',
    'toInteger', 'toReal', 'trim', 'matches', 'tokenize',
    'allInstances', 'oclIsKindOf', 'oclIsTypeOf', 'oclAsType', 'oclIsNew',
    'oclIsUndefined', 'oclIsInvalid',
    'abs', 'floor', 'ceiling', 'round', 'sqrt', 'log', 'exp', 'mod', 'div',
  ],
  tokenizer: {
    root: [
      // Comments
      [/--[^\r\n]*/, 'comment'],
      [/\/\*/, { token: 'comment.block', next: '@blockComment' }],

      // Annotations
      [/[@]severity/, { token: 'annotation', next: '@severityValue' }],
      [/[@]message\b/, 'annotation'],

      // Structural keywords
      [/\b(package|endpackage)\b/, 'keyword.package'],
      [/\b(context)\b/, { token: 'keyword.context', next: '@contextType' }],
      [/\b(inv|pre|post|body|def)\b/, { token: 'keyword.inv', next: '@invName' }],

      // Keywords
      [/\b(if|then|else|endif)\b/, 'keyword.control'],
      [/\b(let)\b/, { token: 'keyword.let', next: '@letVar' }],
      [/\b(in)\b/, 'keyword.let'],
      [/\b(and|or|not|implies|xor)\b/, 'keyword.operator.logical'],

      // Constants
      [/\b(self|result)\b/, 'variable.predefined'],
      [/\b(true|false)\b/, 'constant.boolean'],
      [/\b(null|invalid|OclUndefined)\b/, 'constant.null'],

      // Iterators
      [/\b(select|reject|collect|collectNested|forAll|exists|any|one|isUnique|sortedBy|iterate)\b/, 'support.function.iterator'],

      // Type keywords
      [/\b(Integer|Real|String|Boolean|UnlimitedNatural|OclAny|OclVoid)\b/, 'type.primitive'],
      [/\b(Set|Sequence|Bag|OrderedSet|Collection|Optional|Singleton)\b/, 'type.collection'],

      // OCL operations (split to keep regex complexity below threshold)
      [/\b(isEmpty|notEmpty|includes|excludes|includesAll|excludesAll|sum|count|min|max|first|last|at|union|intersection|size)\b/, 'support.function.ocl'],
      [/\b(append|prepend|insertAt|subSequence|flatten|asSet|asOrderedSet|asSequence|asBag|reverse|concat|substring|indexOf|toUpperCase|toLowerCase|toInteger|toReal|trim|matches|tokenize)\b/, 'support.function.ocl'],
      [/\b(allInstances|oclIsKindOf|oclIsTypeOf|oclAsType|oclIsNew|oclIsUndefined|oclIsInvalid|abs|floor|ceiling|round|sqrt|log|exp|mod|div)\b/, 'support.function.ocl'],

      // Strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/"/, { token: 'string.quote', next: '@dstring' }],
      [/'([^'\\]|\\.)*$/, 'string.invalid'],
      [/'/, { token: 'string.quote', next: '@sstring' }],

      // Numbers
      [/\b\d+\.\d+([eE][+-]?\d+)?[fF]?\b/, 'number.float'],
      [/\b\d+\b/, 'number'],

      // Operators
      [/\.\./, 'operator.range'],
      [/\.(?!\.)/, 'operator.navigation'],
      [/::/, 'operator.typecast'],
      [/<>|!=|<=|>=|<|>|=/, 'operator.comparison'],
      [/[+\-*/]/, 'operator.arithmetic'],
      [/~/, 'operator.correspondence'],
      [/\|/, 'operator.pipe'],
      [/:/, 'operator.colon'],

      // Multiplicity
      [/[¡!¿?]/, 'multiplicity'],

      // Punctuation
      [/[()[\]{}]/, 'delimiter'],
    ],

    contextType: [
      [/\s+/, ''],
      [/[A-Za-z_]\w*(?:::[A-Za-z_]\w*)?/, 'type.class', '@pop'],
      [/./, { token: '', next: '@pop' }],
    ],
    invName:       popState(/[A-Za-z_]\w*/, 'entity.name.label'),
    letVar:        popState(/[A-Za-z_]\w*/, 'variable.let'),
    severityValue: popState(/[A-Z]+/, 'annotation.value'),

    dstring: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, { token: 'string.quote', next: '@pop' }],
    ],

    sstring: [
      [/[^\\']+/, 'string'],
      [/\\./, 'string.escape'],
      [/'/, { token: 'string.quote', next: '@pop' }],
    ],

    blockComment: [
      [/[^*/]+/, 'comment.block'],
      [/\*\//, { token: 'comment.block', next: '@pop' }],
      [/[*/]/, 'comment.block'],
    ],
  },
};

type OclTokenPaint = readonly [token: string, light: string, dark: string, fontStyle?: string];

const OCL_TOKEN_PAINTS: readonly OclTokenPaint[] = [
  ['comment', '6a9955', '6A9955', 'italic'],
  ['comment.block', '6a9955', '6A9955', 'italic'],
  ['annotation', '795e26', 'DCDCAA', 'bold'],
  ['annotation.value', 'a31515', 'CE9178'],
  ['keyword.package', 'af00db', 'C586C0'],
  ['keyword.context', '0000ff', '569CD6', 'bold'],
  ['keyword.inv', '267f99', '4EC9B0', 'bold'],
  ['keyword.control', 'af00db', 'C586C0'],
  ['keyword.let', 'af00db', 'C586C0'],
  ['keyword.operator.logical', '0000ff', '569CD6'],
  ['variable.predefined', '001080', '9CDCFE', 'bold'],
  ['variable.let', '001080', '9CDCFE'],
  ['constant.boolean', '0000ff', '569CD6'],
  ['constant.null', '808080', 'B0B0B0'],
  ['support.function.iterator', '795e26', 'DCDCAA'],
  ['support.function.ocl', '795e26', 'DCDCAA'],
  ['type.primitive', '267f99', '4EC9B0'],
  ['type.collection', '267f99', '4EC9B0'],
  ['type.class', '267f99', '4EC9B0', 'bold'],
  ['entity.name.label', '795e26', 'DCDCAA', 'bold'],
  ['string', 'a31515', 'CE9178'],
  ['string.quote', 'a31515', 'CE9178'],
  ['string.escape', 'ee0000', 'D7BA7D'],
  ['string.invalid', 'cd3131', 'F48771'],
  ['number', '098658', 'B5CEA8'],
  ['number.float', '098658', 'B5CEA8'],
  ['operator.range', '000000', 'D4D4D4'],
  ['operator.navigation', '000000', 'D4D4D4'],
  ['operator.typecast', '000000', 'D4D4D4'],
  ['operator.comparison', '000000', 'D4D4D4'],
  ['operator.arithmetic', '000000', 'D4D4D4'],
  ['operator.correspondence', 'af00db', 'C586C0', 'bold'],
  ['operator.pipe', '000000', 'D4D4D4'],
  ['operator.colon', '000000', 'D4D4D4'],
  ['multiplicity', 'af00db', 'C586C0'],
  ['delimiter', '000000', 'D4D4D4'],
];

function oclTheme(
  mode: 'light' | 'dark',
  base: 'vs' | 'vs-dark',
  background: string,
): monaco.editor.IStandaloneThemeData {
  return {
    base,
    inherit: true,
    rules: OCL_TOKEN_PAINTS.map(([token, light, dark, fontStyle]) => ({
      token,
      foreground: mode === 'dark' ? dark : light,
      ...(fontStyle ? { fontStyle } : {}),
    })),
    colors: { 'editor.background': background },
  };
}

export const vitruvOCLTheme = oclTheme('light', 'vs', '#ffffff');
export const vitruvOCLThemeDark = oclTheme('dark', 'vs-dark', '#0f172a');

export const vitruvOCLLanguageConfig: monaco.languages.LanguageConfiguration = {
  comments: { lineComment: '--', blockComment: ['/*', '*/'] },
  brackets: [['(', ')'], ['{', '}'], ['[', ']']],
  autoClosingPairs: [
    { open: '(', close: ')' },
    { open: '[', close: ']' },
    { open: '"', close: '"', notIn: ['string'] },
    { open: "'", close: "'", notIn: ['string'] },
  ],
  surroundingPairs: [
    { open: '(', close: ')' },
    { open: '[', close: ']' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
};

export function registerVitruvOCLLanguage() {
  if (monaco.languages.getLanguages().some((l) => l.id === vitruvOCLLanguageId)) return;

  monaco.languages.register({ id: vitruvOCLLanguageId, extensions: ['.ocl'], aliases: ['VitruvOCL'] });
  monaco.languages.setMonarchTokensProvider(vitruvOCLLanguageId, vitruvOCLMonarch);
  monaco.languages.setLanguageConfiguration(vitruvOCLLanguageId, vitruvOCLLanguageConfig);
  monaco.editor.defineTheme('vitruvocl-light', vitruvOCLTheme);
  monaco.editor.defineTheme('vitruvocl-dark', vitruvOCLThemeDark);
}
