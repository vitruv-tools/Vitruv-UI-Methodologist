import { tokenize } from '../../../../utils/semanticOverlap/lexical/tokenize';

describe('tokenize', () => {
  it.each([
    ['ownedAttribute', ['owned', 'attribute']],
    ['isAbstract', ['abstract']],
    ['EClass', ['class']],
    ['eOpposite', ['opposite']],
    ['XMLResource', ['xml', 'resource']],
    ['HTTP2Server', ['http', 'server']],
    ['member_end', ['member', 'end']],
    ['package-name.part', ['package', 'name', 'part']],
    ['iD', []],
  ])('splits %s', (name, tokens) => {
    expect(tokenize(name)).toEqual(tokens);
  });
});
