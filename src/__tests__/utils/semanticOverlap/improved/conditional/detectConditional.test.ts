import { detectConditional } from '../../../../../utils/semanticOverlap/improved/conditional/detectConditional';
import type { ClassNode, MetamodelGraph } from '../../../../../utils/semanticOverlap/types';
import { attribute, cls, graph } from '../graphBuilders';

const enumAttribute = (owner: string, name: string, type: string) => attribute(owner, name, type, { typeCategory: 'enum' });
const brakes = (subclasses: string[] = ['DiscBrake', 'DrumBrake'], extra: ClassNode[] = []) => graph([
  cls('t', 'Brake', { isAbstract: true }), ...subclasses.map(name => cls('t', name, { superTypes: ['t.Brake'] })), ...extra,
], 't', 2);
const withEnum = (literals: string[], attrs = [enumAttribute('s.Brake', 'kind', 'BrakeKind')]): MetamodelGraph =>
  graph([cls('s', 'Brake', { attributes: attrs })], 's', 1, [{ name: 'BrakeKind', qualifiedName: 's.BrakeKind', literals }]);

describe('conditional correspondences', () => {
  it('maps each enumeration literal to the subclass it names (Brake.kind = DISC ↔ DiscBrake)', () => {
    const match = detectConditional(withEnum(['DISC', 'DRUM']), brakes())!;
    expect(match.classFixed.map(c => [c.sources[0].qualifiedName, c.targets[0].qualifiedName, c.kind, c.condition])).toEqual([
      ['s.Brake', 't.DiscBrake', 'conditional', { attribute: 's.Brake.kind', value: 'DISC' }],
      ['s.Brake', 't.DrumBrake', 'conditional', { attribute: 's.Brake.kind', value: 'DRUM' }],
    ]);
    expect(match.classFixed.every(c => c.confidence === 1)).toBe(true);
  });

  it('needs two matched literals and at least half of all literals', () => {
    expect(detectConditional(withEnum(['DISC', 'OTHER']), brakes())).toBeNull();
    expect(detectConditional(withEnum(['DISC', 'DRUM', 'A1', 'B2', 'C3']), brakes())).toBeNull();
    expect(detectConditional(withEnum(['DISC', 'DRUM', 'OTHER']), brakes())!.classFixed[0].confidence).toBeCloseTo(2 / 3);
  });

  it('maps a boolean to the subclass it names and false to the only other concrete subclass', () => {
    const source = graph([cls('s', 'Brake', { attributes: [attribute('s.Brake', 'isDisc', 'EBoolean')] })], 's');
    expect(detectConditional(source, brakes())!.classFixed.map(c => [c.targets[0].name, c.condition.value])).toEqual([
      ['DiscBrake', 'true'], ['DrumBrake', 'false'],
    ]);
  });

  it('proposes nothing without an enumeration or boolean attribute', () => {
    const source = graph([cls('s', 'Brake', { attributes: [attribute('s.Brake', 'kind', 'EString')] })], 's');
    expect(detectConditional(source, brakes())).toBeNull();
  });

  it('prefers the side with more matches and, on a tie, the source side', () => {
    const targetEnum = graph([cls('t', 'Item', { attributes: [enumAttribute('t.Item', 'type', 'ItemType')] })], 't', 2,
      [{ name: 'ItemType', qualifiedName: 't.ItemType', literals: ['A', 'B'] }]);
    const sourceSubclasses = graph([cls('s', 'Thing'), cls('s', 'Disc', { superTypes: ['s.Thing'] }), cls('s', 'Drum', { superTypes: ['s.Thing'] })], 's');
    const reversed = detectConditional(sourceSubclasses, graph([cls('t', 'Brake', { attributes: [enumAttribute('t.Brake', 'kind', 'K')] })], 't', 2,
      [{ name: 'K', qualifiedName: 't.K', literals: ['DISC', 'DRUM'] }]))!;
    expect(reversed.classFixed[0]).toMatchObject({ sources: [{ name: 'Disc' }], targets: [{ name: 'Brake' }], condition: { attribute: 't.Brake.kind' } });
    expect(reversed.covered.source).toEqual(new Set(['s.Disc', 's.Drum']));
    expect(detectConditional(withEnum(['DISC', 'DRUM']), targetEnum)).toBeNull();
  });

  it('covers the matched subclasses and leaves the class itself free', () => {
    const match = detectConditional(withEnum(['DISC', 'DRUM']), brakes())!;
    expect(match.covered).toEqual({ source: new Set(), target: new Set(['t.DiscBrake', 't.DrumBrake']) });
  });
});
