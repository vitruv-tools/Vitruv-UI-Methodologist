import {
  flattenSignatures, multiplicitySimilarity, signatureListSimilarity, signatureSimilarity, structureTypesMatrix, type Signature,
} from '../../../../../utils/semanticOverlap/improved/measures/structureTypes';
import { attribute, cls, graph, reference } from '../graphBuilders';

const sig = (typeKey: Signature['typeKey'], multiplicity: Signature['multiplicity'] = 'one', hop = 0, name = 'x'): Signature =>
  ({ typeKey, multiplicity, hop, name });
const noClasses = () => 0;

// a.Root -> a.Mid -> a.Leaf -> a.Root (cycle); Mid inherits from Base.
const chain = graph([
  cls('a', 'Root', { attributes: [attribute('a.Root', 'name', 'EString')], references: [reference('a.Root', 'mid', 'Mid')] }),
  cls('a', 'Base', { attributes: [attribute('a.Base', 'size', 'EInt')] }),
  cls('a', 'Mid', { superTypes: ['a.Base'], references: [reference('a.Mid', 'leaves', 'Leaf', { upper: -1, ordered: false })] }),
  cls('a', 'Leaf', { attributes: [attribute('a.Leaf', 'weight', 'EDouble')], references: [reference('a.Leaf', 'back', 'Root')] }),
], 'a');

describe('data-structure similarity', () => {
  it('flattens own, inherited, hop-1 and hop-2 features and stops on cycles', () => {
    const signatures = flattenSignatures(chain, 'a.Root', 48);
    expect(signatures.map(s => [s.name, s.hop, s.typeKey, s.multiplicity])).toEqual([
      ['mid', 0, 'class:a.Mid', 'one'], ['name', 0, 'text', 'one'],
      ['leaves', 1, 'class:a.Leaf', 'set'], ['size', 1, 'integer', 'one'],
      ['back', 2, 'class:a.Root', 'one'], ['weight', 2, 'decimal', 'one'],
    ]);
    expect(flattenSignatures(chain, 'a.Root', 3)).toHaveLength(3);
  });

  it('compares types: equal 1, numbers 0.8, data type vs class 0, classes by their first-pass similarity', () => {
    expect(signatureSimilarity(sig('text'), sig('text'), noClasses)).toBe(1);
    expect(signatureSimilarity(sig('integer'), sig('decimal'), noClasses)).toBe(0.8);
    expect(signatureSimilarity(sig('number'), sig('integer'), noClasses)).toBe(0.8);
    expect(signatureSimilarity(sig('text'), sig('boolean'), noClasses)).toBe(0);
    expect(signatureSimilarity(sig('text'), sig('class:b.X'), () => 1)).toBe(0);
    expect(signatureSimilarity(sig('class:a.A'), sig('class:b.X'), (s, t) => (s === 'a.A' && t === 'b.X' ? 0.6 : 0))).toBe(0.6);
  });

  it('compares multiplicities as in Fang (2022, Table 4.3)', () => {
    expect(multiplicitySimilarity('seq', 'seq')).toBe(1);
    expect(multiplicitySimilarity('set', 'seq')).toBe(0.8);
    expect(multiplicitySimilarity('one', 'set')).toBe(0.5);
    expect(signatureSimilarity(sig('text', 'one'), sig('text', 'seq'), noClasses)).toBe(0.5);
  });

  it('scores two renamed classes with identical feature types as highly similar', () => {
    const left = graph([cls('l', 'Brake', {
      attributes: [attribute('l.Brake', 'diameter', 'EInt'), attribute('l.Brake', 'label', 'EString'), attribute('l.Brake', 'active', 'EBoolean')],
    })], 'l');
    const right = graph([cls('r', 'Decelerator', {
      attributes: [attribute('r.Decelerator', 'size', 'EInt'), attribute('r.Decelerator', 'title', 'EString'), attribute('r.Decelerator', 'enabled', 'EBoolean')],
    })], 'r', 2);
    expect(structureTypesMatrix(left, right, new Float32Array([0]), 48)[0]).toBeGreaterThanOrEqual(0.9);
  });

  it('weights hops by 1/(1+hop) and normalises by the larger total weight', () => {
    const value = signatureListSimilarity([sig('text', 'one', 0), sig('integer', 'one', 1)], [sig('text', 'one', 0)], noClasses);
    expect(value).toBeCloseTo(1 / 1.5);
  });

  it('is not applicable without signatures', () => {
    expect(signatureListSimilarity([], [sig('text')], noClasses)).toBeNaN();
    const empty = graph([cls('e', 'Empty')], 'e');
    expect(structureTypesMatrix(empty, chain, new Float32Array(4), 48)[0]).toBeNaN();
  });
});
