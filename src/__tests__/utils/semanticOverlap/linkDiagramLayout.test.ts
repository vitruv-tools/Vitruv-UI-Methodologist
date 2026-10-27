import { buildLinkDiagram, nodeIdFor } from '../../../utils/semanticOverlap/linkDiagramLayout';
import { correspondenceFor, sampleResult } from '../../components/semanticOverlap/sampleResult';

const result = sampleResult();
const options = { minScore: 0, selectedId: null, collapsedUnmatched: false, columnGap: 400, rowHeight: 50 };

describe('buildLinkDiagram', () => {
  it('puts source classes left and target classes right, read-only', () => {
    const { nodes } = buildLinkDiagram(result, options);
    const source = nodes.filter(n => n.data.side === 'source');
    const target = nodes.filter(n => n.data.side === 'target');
    expect(source.every(n => n.position.x === 0)).toBe(true);
    expect(target.every(n => n.position.x === 400)).toBe(true);
    expect(nodes.every(n => n.draggable === false && n.connectable === false)).toBe(true);
    expect(source.map(n => n.position.y)).toEqual([0, 50, 100]);
  });

  it('orders matched targets by the barycentre of their sources and puts unmatched last', () => {
    const { nodes } = buildLinkDiagram(result, options);
    const sourceOrder = nodes.filter(n => n.data.side === 'source').map(n => n.data.label);
    const targetOrder = nodes.filter(n => n.data.side === 'target').map(n => n.data.label);
    expect(targetOrder[targetOrder.length - 1]).toBe('Association');
    expect(nodes.find(n => n.data.label === 'Association')!.data.unmatched).toBe(true);
    const classIndex = sourceOrder.indexOf('EClass');
    const referenceIndex = sourceOrder.indexOf('EReference');
    expect(targetOrder.indexOf('Class') < targetOrder.indexOf('Property')).toBe(classIndex < referenceIndex);
  });

  it('creates one edge per source/target pair of every visible correspondence', () => {
    const { edges } = buildLinkDiagram(result, options);
    const property = correspondenceFor(result, 'EAttribute');
    const toProperty = edges.filter(e => e.target === nodeIdFor('target', 'uml.Property'));
    expect(toProperty.map(e => e.source).sort()).toEqual(['s:ecore.EAttribute', 's:ecore.EReference']);
    expect(toProperty.every(e => e.data!.correspondenceId === property.id && e.data!.score === property.score)).toBe(true);
  });

  it('hides correspondences below the threshold and omits collapsed unmatched classes', () => {
    const lowest = Math.min(...result.correspondences.map(c => c.score));
    const { edges, nodes } = buildLinkDiagram(result, { ...options, minScore: lowest + 0.0001, collapsedUnmatched: true });
    expect(edges.length).toBeLessThan(buildLinkDiagram(result, options).edges.length);
    expect(nodes.every(n => !n.data.unmatched)).toBe(true);
  });

  it('marks the selected correspondence on edges and nodes', () => {
    const selected = correspondenceFor(result, 'EClass');
    const { edges, nodes } = buildLinkDiagram(result, { ...options, selectedId: selected.id });
    expect(edges.filter(e => e.selected).map(e => e.data!.correspondenceId)).toEqual([selected.id]);
    expect(nodes.filter(n => n.data.selected).map(n => n.data.label).sort()).toEqual(['Class', 'EClass']);
  });
});
