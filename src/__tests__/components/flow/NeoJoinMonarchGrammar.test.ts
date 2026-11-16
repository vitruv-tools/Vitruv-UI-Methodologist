import { neoJoinLanguageConfig, neoJoinMonarch } from '../../../components/flow/NeoJoinMonarchGrammar';

const keywords = neoJoinMonarch.keywords as string[];

describe('neoJoinMonarch', () => {
  it('highlights NeoJoin query keywords from NeoJoin.xtext', () => {
    for (const keyword of [
      'export', 'import', 'from', 'join', 'using', 'where', 'group', 'by',
      'create', 'conforms', 'strict', 'abstract', 'param', 'inner', 'left',
    ]) {
      expect(keywords).toContain(keyword);
    }
  });

  it('includes Xbase expression keywords', () => {
    for (const keyword of ['if', 'else', 'for', 'while', 'val', 'var', 'new', 'null', 'return', 'instanceof']) {
      expect(keywords).toContain(keyword);
    }
  });

  it('uses a NeoJoin token suffix so its colors stay separate from Reactions and OCL', () => {
    expect(neoJoinMonarch.tokenPostfix).toBe('.neojoin');
  });

  it('knows the calculate operator used in feature definitions', () => {
    expect(neoJoinMonarch.operators).toContain(':=');
  });
});

describe('neoJoinLanguageConfig', () => {
  it('uses Xbase comments and brackets', () => {
    expect(neoJoinLanguageConfig.comments?.lineComment).toBe('//');
    expect(neoJoinLanguageConfig.comments?.blockComment).toEqual(['/*', '*/']);
    expect(neoJoinLanguageConfig.brackets).toEqual(expect.arrayContaining([['{', '}']]));
  });
});
