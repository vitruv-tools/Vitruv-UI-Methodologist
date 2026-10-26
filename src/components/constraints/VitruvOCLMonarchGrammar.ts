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

const DARK_OCL_FOREGROUND: Record<string, string> = {
  comment: '6A9955',
  'comment.block': '6A9955',
  annotation: 'DCDCAA',
  'annotation.value': 'CE9178',
  'keyword.package': 'C586C0',
  'keyword.context': '569CD6',
  'keyword.inv': '4EC9B0',
  'keyword.control': 'C586C0',
  'keyword.let': 'C586C0',
  'keyword.operator.logical': '569CD6',
  'variable.predefined': '9CDCFE',
  'variable.let': '9CDCFE',
  'constant.boolean': '569CD6',
  'constant.null': 'B0B0B0',
  'support.function.iterator': 'DCDCAA',
  'support.function.ocl': 'DCDCAA',
  'type.primitive': '4EC9B0',
  'type.collection': '4EC9B0',
  'type.class': '4EC9B0',
  'entity.name.label': 'DCDCAA',
  string: 'CE9178',
  'string.quote': 'CE9178',
  'string.escape': 'D7BA7D',
  'string.invalid': 'F48771',
  number: 'B5CEA8',
  'number.float': 'B5CEA8',
  'operator.range': 'D4D4D4',
  'operator.navigation': 'D4D4D4',
  'operator.typecast': 'D4D4D4',
  'operator.comparison': 'D4D4D4',
  'operator.arithmetic': 'D4D4D4',
  'operator.correspondence': 'C586C0',
  'operator.pipe': 'D4D4D4',
  'operator.colon': 'D4D4D4',
  multiplicity: 'C586C0',
  delimiter: 'D4D4D4',
};

export const vitruvOCLTheme: monaco.editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
    { token: 'comment.block', foreground: '6a9955', fontStyle: 'italic' },
    { token: 'annotation', foreground: '795e26', fontStyle: 'bold' },
    { token: 'annotation.value', foreground: 'a31515' },
    { token: 'keyword.package', foreground: 'af00db' },
    { token: 'keyword.context', foreground: '0000ff', fontStyle: 'bold' },
    { token: 'keyword.inv', foreground: '267f99', fontStyle: 'bold' },
    { token: 'keyword.control', foreground: 'af00db' },
    { token: 'keyword.let', foreground: 'af00db' },
    { token: 'keyword.operator.logical', foreground: '0000ff' },
    { token: 'variable.predefined', foreground: '001080', fontStyle: 'bold' },
    { token: 'variable.let', foreground: '001080' },
    { token: 'constant.boolean', foreground: '0000ff' },
    { token: 'constant.null', foreground: '808080' },
    { token: 'support.function.iterator', foreground: '795e26' },
    { token: 'support.function.ocl', foreground: '795e26' },
    { token: 'type.primitive', foreground: '267f99' },
    { token: 'type.collection', foreground: '267f99' },
    { token: 'type.class', foreground: '267f99', fontStyle: 'bold' },
    { token: 'entity.name.label', foreground: '795e26', fontStyle: 'bold' },
    { token: 'string', foreground: 'a31515' },
    { token: 'string.quote', foreground: 'a31515' },
    { token: 'string.escape', foreground: 'ee0000' },
    { token: 'string.invalid', foreground: 'cd3131' },
    { token: 'number', foreground: '098658' },
    { token: 'number.float', foreground: '098658' },
    { token: 'operator.range', foreground: '000000' },
    { token: 'operator.navigation', foreground: '000000' },
    { token: 'operator.typecast', foreground: '000000' },
    { token: 'operator.comparison', foreground: '000000' },
    { token: 'operator.arithmetic', foreground: '000000' },
    { token: 'operator.correspondence', foreground: 'af00db', fontStyle: 'bold' },
    { token: 'operator.pipe', foreground: '000000' },
    { token: 'operator.colon', foreground: '000000' },
    { token: 'multiplicity', foreground: 'af00db' },
    { token: 'delimiter', foreground: '000000' },
  ],
  colors: {
    'editor.background': '#ffffff',
  },
};

export const vitruvOCLThemeDark: monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: vitruvOCLTheme.rules.map((rule) => ({
    ...rule,
    foreground: DARK_OCL_FOREGROUND[rule.token] ?? rule.foreground,
  })),
  colors: {
    'editor.background': '#0f172a',
  },
};

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
