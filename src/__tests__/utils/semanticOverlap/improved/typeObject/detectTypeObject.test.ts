import {
  detectPattern, detectTypeObject, findCounterpart, type FixedCorrespondence,
} from '../../../../../utils/semanticOverlap/improved/typeObject/detectTypeObject';
import { ecoreExcerpt, umlExcerpt } from '../../fixtures';
import { assembly, shop, shopWithNumericValues, smallAssembly } from './typeObjectFixtures';

const pair = (c: FixedCorrespondence) =>
  `${c.sources.map(s => s.qualifiedName).join()} -> ${c.targets.map(t => t.qualifiedName).join()} #${c.kind}${c.instance ? `/${c.instance.role}@${c.instance.side}` : ''}`;

describe('type-object pattern detection', () => {
  it('finds item, type, definition, value, container and the data-type subclasses', () => {
    const pattern = detectPattern(shop())!;
    expect(pattern.item.name).toBe('Product');
    expect(pattern.type.name).toBe('ProductKind');
    expect(pattern.definition.name).toBe('Feature');
    expect(pattern.value.name).toBe('FeatureValue');
    expect(pattern.container?.name).toBe('Shop');
    expect(Object.fromEntries(Object.entries(pattern.definitionsByCategory).map(([k, v]) => [k, v!.name])))
      .toEqual({ text: 'TextFeature', number: 'NumberFeature' });
    expect(Object.fromEntries(Object.entries(pattern.valuesByCategory).map(([k, v]) => [k, v!.name])))
      .toEqual({ text: 'TextFeatureValue', number: 'NumberFeatureValue' });
    expect(pattern.typedSubclasses).toBe(true);
  });

  it('needs the value → definition reference (rule 4)', () => {
    expect(detectPattern(shop(false))).toBeNull();
  });

  it('finds no pattern in the Ecore and UML excerpts', () => {
    expect(detectPattern(ecoreExcerpt())).toBeNull();
    expect(detectPattern(umlExcerpt())).toBeNull();
  });

  it('finds the counterpart: a contained base class with enough concrete subclasses', () => {
    const counterpart = findCounterpart(assembly(), 2)!;
    expect(counterpart.base.name).toBe('Part');
    expect(counterpart.subclasses.map(c => c.name)).toEqual(['Bolt', 'Nut']);
    expect(counterpart.container?.name).toBe('Assembly');
    expect(findCounterpart(smallAssembly(), 2)).toBeNull();
    expect(findCounterpart(assembly(), 3)).toBeNull();
  });

  it('fixes container, base, subclass and attribute correspondences', () => {
    const match = detectTypeObject(assembly(), shop(), 2)!;
    expect(match.classFixed.map(pair)).toEqual([
      'asm.Assembly -> shop.Shop #same',
      'asm.Part -> shop.Product #same',
      'asm.Bolt -> shop.ProductKind #instance/type@target',
      'asm.Nut -> shop.ProductKind #instance/type@target',
    ]);
    // Identifier attributes (id) are no parameters; inherited ones are listed under the declaring class.
    expect(match.featureFixed.get('asm.Bolt')!.map(pair)).toEqual([
      'asm.Bolt.length -> shop.NumberFeature #instance/definition@target',
      'asm.Bolt.length -> shop.NumberFeatureValue #instance/value@target',
      'asm.Part.label -> shop.TextFeature #instance/definition@target',
      'asm.Part.label -> shop.TextFeatureValue #instance/value@target',
    ]);
    expect(match.pattern).toMatchObject({ side: 'target', item: 'shop.Product', confidence: 1,
      counterpart: { base: 'asm.Part', subclasses: ['asm.Bolt', 'asm.Nut'], container: 'asm.Assembly' } });
    expect(match.covered.target.has('shop.NumberFeatureValue')).toBe(true);
    expect(match.covered.source.has('asm.Nut')).toBe(true);
  });

  it('leaves attributes without a matching data-type subclass unmatched and lowers the confidence', () => {
    const match = detectTypeObject(assembly(1, true), shop(), 2)!;
    expect(match.featureFixed.get('asm.Bolt')!.some(c => c.sources[0].name === 'produced')).toBe(false);
    // 3 of 4 distinct attributes (label, length, size, produced) have a matching subclass.
    expect(match.pattern.confidence).toBeCloseTo(0.75);
  });

  it('mirrors the correspondences when the pattern is on the source side', () => {
    const match = detectTypeObject(shop(true, 1), assembly(2), 2)!;
    expect(match.pattern.side).toBe('source');
    expect(match.classFixed.map(pair)).toContain('shop.ProductKind -> asm.Bolt #instance/type@source');
    expect(match.featureFixed.get('asm.Bolt')!.map(pair)).toContain('shop.NumberFeature -> asm.Bolt.length #instance/definition@source');
  });

  it('proposes nothing when the pattern is on both sides or on neither', () => {
    expect(detectTypeObject(shop(true, 1), shop(true, 2), 2)).toBeNull();
    expect(detectTypeObject(assembly(1), assembly(2), 2)).toBeNull();
    expect(detectTypeObject(ecoreExcerpt(), umlExcerpt(), 2)).toBeNull();
  });

  it('maps whole numbers to integer and decimal numbers to decimal value classes', () => {
    const match = detectTypeObject(assembly(1, false, true), shopWithNumericValues(), 2)!;
    expect(match.pattern.valuesByCategory).toEqual({
      decimal: 'shop.DoubleFeatureValue', integer: 'shop.IntegerFeatureValue', text: 'shop.StringFeatureValue',
    });
    const values = (sub: string) => match.featureFixed.get(sub)!.filter(c => c.instance?.role === 'value').map(pair);
    expect(values('asm.Bolt')).toContain('asm.Bolt.length -> shop.IntegerFeatureValue #instance/value@target');
    expect(values('asm.Nut')).toEqual(expect.arrayContaining([
      'asm.Nut.size -> shop.IntegerFeatureValue #instance/value@target',
      'asm.Nut.weight -> shop.DoubleFeatureValue #instance/value@target',
    ]));
    // Without data-type subclasses of the definition, every attribute is an instance of it.
    expect(match.featureFixed.get('asm.Nut')!.filter(c => c.instance?.role === 'definition').map(pair))
      .toContain('asm.Nut.weight -> shop.Feature #instance/definition@target');
    expect(match.pattern.confidence).toBeCloseTo(0.8);
  });

  it('falls back to a general number class when there is no integer or decimal one', () => {
    const match = detectTypeObject(assembly(1, false, true), shop(), 2)!;
    expect(match.featureFixed.get('asm.Nut')!.map(pair)).toEqual(expect.arrayContaining([
      'asm.Nut.size -> shop.NumberFeature #instance/definition@target',
      'asm.Nut.weight -> shop.NumberFeature #instance/definition@target',
    ]));
  });
});

