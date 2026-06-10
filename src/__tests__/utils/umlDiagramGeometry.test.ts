import {
  bridgedLinePathD,
  computeLineBridges,
  optimizeMultiplicityBadges,
  segmentIntersection,
  type MultiplicityBadge,
} from '../../utils/umlDiagramGeometry';

function mkBadge(overrides: Partial<MultiplicityBadge> & Pick<MultiplicityBadge, 'key' | 'relId' | 'end' | 'anchorClassId' | 'text'>): MultiplicityBadge {
  return {
    x: 100,
    y: 200,
    nx: 0,
    ny: 1,
    anchorX: 140,
    anchorY: 200,
    lineUx: -1,
    lineUy: 0,
    ...overrides,
  };
}

describe('umlDiagramGeometry', () => {
  it('detects intersection between crossing segments', () => {
    const hit = segmentIntersection(
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    );
    expect(hit).not.toBeNull();
    expect(hit?.x).toBeCloseTo(50, 0);
    expect(hit?.y).toBeCloseTo(50, 0);
  });

  it('builds bridge path with quadratic arc at crossing', () => {
    const path = bridgedLinePathD(
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      [{ t: 0.5, bulgeSign: 1 }],
    );
    expect(path).toContain('Q');
    expect(path).not.toBe('M 0 50 L 100 50');
  });

  it('uses a larger gap for bridge jumps', () => {
    const path = bridgedLinePathD(
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      [{ t: 0.5, bulgeSign: 1 }],
    );
    expect(path).toContain('L 40 50');
    expect(path).toContain('60 50');
  });

  it('assigns bridges to the lower-index segment only', () => {
    const bridges = computeLineBridges([
      { id: 'a', drawP1: { x: 0, y: 50 }, drawP2: { x: 100, y: 50 } },
      { id: 'b', drawP1: { x: 50, y: 0 }, drawP2: { x: 50, y: 100 } },
    ]);
    expect(bridges.get('a')?.length).toBe(1);
    expect(bridges.get('b')).toBeUndefined();
  });

  it('keeps all duplicate cardinality badges and separates them along their own lines', () => {
    const badges: MultiplicityBadge[] = [
      mkBadge({ key: 'r1-tgt', relId: 'r1', end: 'end', anchorClassId: 'System', text: '1', anchorY: 180, y: 180 }),
      mkBadge({ key: 'r2-tgt', relId: 'r2', end: 'end', anchorClassId: 'System', text: '1', anchorY: 200, y: 200 }),
      mkBadge({ key: 'r3-tgt', relId: 'r3', end: 'end', anchorClassId: 'System', text: '1', anchorY: 210, y: 210 }),
    ];
    const optimized = optimizeMultiplicityBadges(badges);
    expect(optimized).toHaveLength(3);
    expect(optimized.map(b => b.text)).toEqual(['1', '1', '1']);
    const xs = optimized.map(b => b.x);
    expect(new Set(xs).size).toBe(3);
    optimized.forEach(b => {
      expect(b.x).toBeLessThan(b.anchorX);
    });
  });

  it('spreads different cardinality values without removing any badge', () => {
    const badges: MultiplicityBadge[] = [
      mkBadge({ key: 'r1-tgt', relId: 'r1', end: 'end', anchorClassId: 'Box', text: '1', anchorY: 200, y: 200 }),
      mkBadge({ key: 'r2-tgt', relId: 'r2', end: 'end', anchorClassId: 'Box', text: '0..*', anchorY: 205, y: 205 }),
    ];
    const optimized = optimizeMultiplicityBadges(badges);
    expect(optimized).toHaveLength(2);
    expect(Math.hypot(optimized[1].x - optimized[0].x, optimized[1].y - optimized[0].y)).toBeGreaterThanOrEqual(38);
  });

  it('leaves a single badge unchanged', () => {
    const badges: MultiplicityBadge[] = [
      mkBadge({ key: 'r1-tgt', relId: 'r1', end: 'end', anchorClassId: 'Box', text: '1' }),
    ];
    const optimized = optimizeMultiplicityBadges(badges);
    expect(optimized).toEqual(badges);
  });
});
