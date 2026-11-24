import type { languages } from 'monaco-editor';
import { vitruvOCLMonarch } from '../../../components/constraints/VitruvOCLMonarchGrammar';
import { neoJoinMonarch } from '../../../components/flow/NeoJoinMonarchGrammar';
import { reactionsMonarch } from '../../../components/flow/ReactionsMonarchGrammar';

/**
 * The `@name` references in a grammar's rules that Monaco cannot fill in. When Monaco compiles a
 * grammar it replaces each `@name` in a rule's pattern with the grammar's `name` string or regex,
 * and throws when there is none; that error takes the whole page down. A literal `@` is written
 * `@@`. (Tests replace `monaco-editor` with a stub, so this repeats Monaco's rule from
 * `monarchCompile.js` instead of calling it.)
 */
function unresolvedReferences(grammar: languages.IMonarchLanguage): string[] {
  const attributes = grammar as unknown as Record<string, unknown>;
  const problems: string[] = [];
  for (const [state, rules] of Object.entries(grammar.tokenizer)) {
    for (const rule of rules) {
      const pattern = Array.isArray(rule) ? rule[0] : (rule as { regex?: unknown }).regex;
      const source = pattern instanceof RegExp ? pattern.source : pattern;
      if (typeof source !== 'string') continue;
      for (const [, name] of source.replaceAll('@@', '').matchAll(/@(\w+)/g)) {
        const value = attributes[name];
        if (typeof value !== 'string' && !(value instanceof RegExp)) {
          problems.push(`${state}: /${source}/ uses @${name}`);
        }
      }
    }
  }
  return problems;
}

const grammars: Array<[string, languages.IMonarchLanguage]> = [
  ['VitruvOCL', vitruvOCLMonarch],
  ['NeoJoin', neoJoinMonarch],
  ['Reactions', reactionsMonarch],
];

describe('Monaco grammars', () => {
  it.each(grammars)('%s only refers to patterns it defines, so Monaco can load it', (_name, grammar) => {
    expect(unresolvedReferences(grammar)).toEqual([]);
  });

  it('finds a reference Monaco cannot fill in', () => {
    const broken = { tokenizer: { root: [[/@severity/, 'annotation'], [/@@ok/, 'annotation']] } };
    expect(unresolvedReferences(broken as unknown as languages.IMonarchLanguage)).toEqual([
      'root: /@severity/ uses @severity',
    ]);
  });
});
