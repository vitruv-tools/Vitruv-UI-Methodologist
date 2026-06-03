import {
  applyUmlDiagramLayout,
  assignParallelRelMeta,
  computeUmlFocusRect,
} from '../../utils/umlClassLayout';

describe('umlClassLayout', () => {
  it('assigns parallel indices for edges between the same pair', () => {
    const rels = assignParallelRelMeta([
      { id: 'b', sourceId: 'A', targetId: 'B' },
      { id: 'a', sourceId: 'A', targetId: 'B' },
    ]);
    expect(rels[0].parallelCount).toBe(2);
    expect(rels[1].parallelCount).toBe(2);
    expect(rels.find(r => r.id === 'a')?.parallelIndex).toBe(0);
    expect(rels.find(r => r.id === 'b')?.parallelIndex).toBe(1);
  });

  it('lays out inheritance as a vertical hierarchy', () => {
    const classes = [
      { id: 'Parent', x: 0, y: 0 },
      { id: 'Child', x: 0, y: 0 },
    ];
    applyUmlDiagramLayout(classes, [
      { sourceId: 'Child', targetId: 'Parent', type: 'inheritance' },
    ]);
    expect(classes.find(c => c.id === 'Parent')!.y).toBeLessThan(classes.find(c => c.id === 'Child')!.y);
  });

  it('lays out association graph with hub near center', () => {
    const classes = [
      { id: 'Hub', x: 0, y: 0 },
      { id: 'A', x: 0, y: 0 },
      { id: 'B', x: 0, y: 0 },
    ];
    applyUmlDiagramLayout(classes, [
      { sourceId: 'A', targetId: 'Hub', type: 'association' },
      { sourceId: 'B', targetId: 'Hub', type: 'association' },
    ]);
    const hub = classes.find(c => c.id === 'Hub')!;
    const nodeA = classes.find(c => c.id === 'A')!;
    const nodeB = classes.find(c => c.id === 'B')!;
    const distA = Math.hypot(nodeA.x - hub.x, nodeA.y - hub.y);
    const distB = Math.hypot(nodeB.x - hub.x, nodeB.y - hub.y);
    expect(distA).toBeLessThan(600);
    expect(distB).toBeLessThan(600);
  });

  it('computeUmlFocusRect centers on the dense cluster, not distant outliers', () => {
    const classes = [
      { id: 'A', x: 100, y: 100 },
      { id: 'B', x: 300, y: 100 },
      { id: 'C', x: 200, y: 250 },
      { id: 'D', x: 120, y: 220 },
      { id: 'E', x: 280, y: 180 },
      { id: 'Outlier', x: 5000, y: 5000 },
    ];
    const rect = computeUmlFocusRect(classes);
    expect(rect.maxX).toBeLessThan(800);
    expect(rect.minX).toBeGreaterThan(0);
    expect(rect.minY).toBeGreaterThan(0);
  });

  it('separates overlapping boxes after layout', () => {
    const classes = [
      { id: 'A', x: 0, y: 0 },
      { id: 'B', x: 0, y: 0 },
      { id: 'C', x: 0, y: 0 },
    ];
    applyUmlDiagramLayout(classes, [
      { sourceId: 'A', targetId: 'B', type: 'association' },
      { sourceId: 'B', targetId: 'C', type: 'association' },
    ]);
    const dist = Math.hypot(classes[1].x - classes[0].x, classes[1].y - classes[0].y);
    expect(dist).toBeGreaterThan(50);
  });
});
