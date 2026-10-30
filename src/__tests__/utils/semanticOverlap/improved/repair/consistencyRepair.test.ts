import { coverage, repairClassCorrespondences, repairFeatureCorrespondences } from '../../../../../utils/semanticOverlap/improved/repair/consistencyRepair';
import type { Correspondence } from '../../../../../utils/semanticOverlap/types';
import { attribute, cls, corr, graph, reference } from '../graphBuilders';

describe('consistency repair', () => {
  describe('subclass rule (classes)', () => {
    const source = graph([cls('a', 'Vehicle'), cls('a', 'Car', { superTypes: ['a.Vehicle'] })], 'a');
    const target = graph([cls('b', 'Auto'), cls('b', 'Fahrzeug'), cls('b', 'Pkw', { superTypes: ['b.Fahrzeug'] })], 'b', 2);

    it('removes the lower-scored party of a subclass mapped outside its superclass counterpart, and records it', () => {
      const vehicle = corr('c-1', ['a.Vehicle'], ['b.Auto'], 0.8);
      const car = corr('c-2', ['a.Car'], ['b.Pkw'], 0.5);
      const { correspondences, repairs } = repairClassCorrespondences([vehicle, car], source, target);
      expect(correspondences).toEqual([vehicle]);
      expect(repairs).toEqual([{
        rule: 'subclass', removed: { level: 'class', sources: ['a.Car'], targets: ['b.Pkw'], score: 0.5 },
        kept: { level: 'class', sources: ['a.Vehicle'], targets: ['b.Auto'], score: 0.8 }, reason: expect.stringContaining('Car is a subclass of Vehicle'),
      }]);
      expect(repairClassCorrespondences(correspondences, source, target).repairs).toEqual([]);
    });

    it('accepts a subclass mapped to the counterpart or one of its subclasses', () => {
      const ok = [corr('c-1', ['a.Vehicle'], ['b.Fahrzeug'], 0.8), corr('c-2', ['a.Car'], ['b.Pkw'], 0.5)];
      expect(repairClassCorrespondences(ok, source, target).repairs).toEqual([]);
    });

    it('never removes a fixed correspondence; the other party goes', () => {
      const vehicle = corr('c-1', ['a.Vehicle'], ['b.Auto'], 0.2);
      const car = corr('c-2', ['a.Car'], ['b.Pkw'], 1, { fixed: true });
      expect(repairClassCorrespondences([vehicle, car], source, target).correspondences).toEqual([car]);
    });

    it('removes only the involved member of a group', () => {
      const vehicle = corr('c-1', ['a.Vehicle'], ['b.Auto'], 0.8);
      const group = corr('c-2', ['a.Car'], ['b.Auto', 'b.Pkw'], 0.5);
      const { correspondences } = repairClassCorrespondences([vehicle, group], source, target);
      expect(correspondences).toHaveLength(2);
    });
  });

  describe('feature rules', () => {
    const source = graph([
      cls('a', 'Shop', { references: [reference('a.Shop', 'items', 'Item', { upper: -1, containment: true }), reference('a.Shop', 'owner', 'Person')] }),
      cls('a', 'Item', { references: [reference('a.Item', 'shop', 'Shop', { opposite: 'a.Shop.items' })] }),
      cls('a', 'Person'),
    ], 'a');
    source.classes[0].references[0].opposite = 'a.Item.shop';
    const target = graph([
      cls('b', 'Store', { references: [reference('b.Store', 'products', 'Product', { upper: -1, containment: true, opposite: 'b.Product.store' }),
        reference('b.Store', 'links', 'Product', { upper: -1 })] }),
      cls('b', 'Product', { references: [reference('b.Product', 'store', 'Store', { opposite: 'b.Store.products' }), reference('b.Product', 'other', 'Store', { opposite: 'b.Store.links' })] }),
    ], 'b', 2);
    const feature = (id: string, s: string, t: string, score: number, extra: Partial<Correspondence> = {}) =>
      corr(id, [s], [t], score, extra, 'reference');
    const classes = (children: Correspondence[], more: Correspondence[] = []) => [
      corr('c-1', ['a.Shop'], ['b.Store'], 0.9, { children }), corr('c-2', ['a.Item'], ['b.Product'], 0.8, { children: [] }), ...more,
    ];
    const repairedChildren = (result: { correspondences: Correspondence[] }) => result.correspondences.flatMap(c => c.children ?? []).map(c => c.id);

    it('containment: removes a containment mapped to a non-containment', () => {
      const result = repairFeatureCorrespondences(classes([feature('f-1', 'a.Shop.items', 'b.Store.links', 0.4)]), source, target);
      expect(repairedChildren(result)).toEqual([]);
      expect(result.repairs.map(r => r.rule)).toContain('containment');
    });

    it('reference-ends: removes a reference whose type classes do not correspond', () => {
      // Person (type of owner) and Product (type of links) are in no class correspondence.
      const result = repairFeatureCorrespondences(classes([feature('f-1', 'a.Shop.owner', 'b.Store.links', 0.4)]), source, target);
      expect(result.repairs.map(r => r.rule)).toEqual(['reference-ends']);
      expect(repairedChildren(result)).toEqual([]);
      expect(result.repairs[0].kept.sources).toEqual(['a.Shop']);
    });

    it('opposite: removes the lower-scored of r ↔ r′ and opp(r) ↔ x when x is not opp(r′)', () => {
      const items = feature('f-1', 'a.Shop.items', 'b.Store.products', 0.9);
      const shop = feature('f-2', 'a.Item.shop', 'b.Product.other', 0.3);
      const result = repairFeatureCorrespondences([
        corr('c-1', ['a.Shop'], ['b.Store'], 0.9, { children: [items] }), corr('c-2', ['a.Item'], ['b.Product'], 0.8, { children: [shop] }),
      ], source, target);
      expect(repairedChildren(result)).toEqual(['f-1']);
      expect(result.repairs.find(r => r.rule === 'opposite')).toMatchObject({ removed: { sources: ['a.Item.shop'] }, kept: { sources: ['a.Shop.items'] } });
    });

    it('keeps consistent feature correspondences and leaves none of the contradictions', () => {
      const items = feature('f-1', 'a.Shop.items', 'b.Store.products', 0.9);
      const shop = feature('f-2', 'a.Item.shop', 'b.Product.store', 0.7);
      const result = repairFeatureCorrespondences([
        corr('c-1', ['a.Shop'], ['b.Store'], 0.9, { children: [items] }), corr('c-2', ['a.Item'], ['b.Product'], 0.8, { children: [shop] }),
      ], source, target);
      expect(result.repairs).toEqual([]);
      expect(repairedChildren(result)).toEqual(['f-1', 'f-2']);
    });

    it('never removes a fixed feature correspondence', () => {
      const result = repairFeatureCorrespondences(classes([feature('f-1', 'a.Shop.items', 'b.Store.links', 0.4, { fixed: true })]), source, target);
      expect(repairedChildren(result)).toEqual(['f-1']);
    });
  });

  it('computes the share of matched classes and features per side', () => {
    const source = graph([cls('a', 'A', { attributes: [attribute('a.A', 'x', 'EInt'), attribute('a.A', 'y', 'EInt')] }), cls('a', 'B')], 'a');
    const target = graph([cls('b', 'X', { attributes: [attribute('b.X', 'z', 'EInt')] })], 'b', 2);
    const result = [corr('c-1', ['a.A'], ['b.X'], 1, { children: [corr('f-1', ['a.A.x'], ['b.X.z'], 1, {}, 'attribute')] })];
    expect(coverage(result, source, target)).toEqual({ source: { classes: 0.5, features: 0.5 }, target: { classes: 1, features: 1 } });
  });
});
