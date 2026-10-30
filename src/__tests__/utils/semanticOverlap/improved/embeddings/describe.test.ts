import { describeAll, describeClass, describeFeature, describePath } from '../../../../../utils/semanticOverlap/improved/embeddings/describe';
import { attribute, cls, graph, reference } from '../graphBuilders';

const brake = graph([
  cls('b', 'Brakesystem', { references: [reference('b.Brakesystem', 'components', 'BrakeComponent', { upper: -1, containment: true })] }),
  cls('b', 'BrakeComponent', { isAbstract: true }),
  cls('b', 'BrakeDisk', {
    superTypes: ['b.BrakeComponent'],
    attributes: [attribute('b.BrakeDisk', 'thicknessInMM', 'EInt'), attribute('b.BrakeDisk', 'diameterInMM', 'EInt')],
    references: [reference('b.BrakeDisk', 'caliper', 'BrakeCaliper')],
  }),
  cls('b', 'BrakeCaliper'),
]);

describe('element descriptions', () => {
  it('describes a class with abstractness, container, supertypes, attributes and references', () => {
    expect(describeClass(brake.classes[2], brake)).toBe(
      'class brake disk. concrete. kind of brake component. attributes: diameter in mm (integer), thickness in mm (integer). references: caliper (brake caliper).');
    expect(describeClass(brake.classes[1], brake)).toBe('class brake component. abstract. part of brakesystem.');
  });

  it('describes attributes, references and paths', () => {
    expect(describeFeature(brake.classes[2].attributes[1])).toBe('attribute diameter in mm of brake disk, integer');
    expect(describeFeature(brake.classes[0].references[0])).toBe('reference components of brakesystem, many brake component, containment');
    expect(describeFeature(reference('g.Edge', 'source', 'Node', { lower: 1 }))).toBe('reference source of edge, one node');
    expect(describePath(reference('g.Node', 'incoming', 'Edge', { upper: -1 }), reference('g.Edge', 'source', 'Node')))
      .toBe('path incoming source of node, edge then node');
  });

  it('cuts lists after 8 entries, sorted by name', () => {
    const names = ['k', 'j', 'i', 'h', 'g', 'f', 'e', 'd', 'c', 'b'].map(c => `${c}${c}`);
    const wide = cls('w', 'Wide', { attributes: names.map(n => attribute('w.Wide', n, 'EString')) });
    expect(describeClass(wide, graph([wide]))).toBe(
      'class wide. concrete. attributes: bb (text), cc (text), dd (text), ee (text), ff (text), gg (text), hh (text), ii (text).');
  });

  it('describes inherited features once, at the declaring class', () => {
    const texts = describeAll(brake, graph([], 'empty')).map(d => d.text);
    expect(texts.filter(t => t.startsWith('attribute diameter in mm'))).toEqual(['attribute diameter in mm of brake disk, integer']);
  });

  it('returns distinct texts in a stable order: classes, then features; source before target', () => {
    const twin = graph([cls('o', 'BrakeCaliper'), cls('o', 'Other')], 'other');
    const descriptions = describeAll(brake, twin);
    expect(descriptions.map(d => d.level)).toEqual([...Array(5).fill('class'), ...Array(4).fill('feature')]);
    // `BrakeCaliper` exists on both sides with the same text: embedded once.
    expect(descriptions.filter(d => d.text === 'class brake caliper. concrete.')).toHaveLength(1);
    expect(new Set(descriptions.map(d => d.text)).size).toBe(descriptions.length);
    expect(describeAll(brake, twin)).toEqual(descriptions);
  });

  it('adds path descriptions only when asked', () => {
    const tree = graph([cls('t', 'Node', { attributes: [attribute('t.Node', 'name', 'EString')], references: [reference('t.Node', 'next', 'Node')] })], 't');
    expect(describeAll(tree, graph([], 'e')).some(d => d.text.startsWith('path'))).toBe(false);
    expect(describeAll(tree, graph([], 'e'), { paths: true }).filter(d => d.text.startsWith('path')).map(d => d.text))
      .toEqual(['path next name of node, node then text', 'path next next of node, node then node']);
  });
});
