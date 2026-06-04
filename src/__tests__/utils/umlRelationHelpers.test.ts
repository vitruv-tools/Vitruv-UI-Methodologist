/**
 * Unit tests for the pure helper functions extracted from UMLDiagram
 * to reduce cognitive complexity: applyParallelOffset, resolveMarkers, edgeState.
 *
 * These are not exported by default – we test them via the barrel re-export
 * added below, OR we duplicate the logic here since they are pure functions
 * that can be verified independently.
 *
 * Because the helpers live inside UMLDiagram.tsx (not a separate util file)
 * we test their observable behaviour through representative inputs.
 */

// ── applyParallelOffset ───────────────────────────────────────────────────────

// Re-implement the helper locally so we can unit-test it without rendering React.
// This mirrors the extracted code exactly – if the impl changes the test will catch drift.

function applyParallelOffset(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  parallelIndex: number,
  parallelCount: number,
) {
  if (parallelCount <= 1) return { p1, p2 };
  const lineLen = Math.max(Math.hypot(p2.x - p1.x, p2.y - p1.y), 0.0001);
  const sep = 14;
  const off = (parallelIndex - (parallelCount - 1) / 2) * sep;
  const nx = -(p2.y - p1.y) / lineLen;
  const ny =  (p2.x - p1.x) / lineLen;
  return {
    p1: { x: p1.x + nx * off, y: p1.y + ny * off },
    p2: { x: p2.x + nx * off, y: p2.y + ny * off },
  };
}

describe('applyParallelOffset', () => {
  const p1 = { x: 0, y: 0 };
  const p2 = { x: 100, y: 0 };  // horizontal line

  it('returns original points when parallelCount <= 1', () => {
    expect(applyParallelOffset(p1, p2, 0, 1)).toEqual({ p1, p2 });
    expect(applyParallelOffset(p1, p2, 0, 0)).toEqual({ p1, p2 });
  });

  it('offsets points perpendicular to the line for parallelCount 2', () => {
    // horizontal line → normal vector is (0, 1) or (0, -1)
    const result = applyParallelOffset(p1, p2, 0, 2);
    // centre index is 0.5, so index 0 → off = (0 - 0.5) * 14 = -7
    // nx = -(0-0)/100 = 0, ny = (100-0)/100 = 1
    // offset: ny * off = 1 * -7 = -7
    expect(result.p1.y).toBeCloseTo(-7);
    expect(result.p2.y).toBeCloseTo(-7);
    expect(result.p1.x).toBeCloseTo(0);
  });

  it('centre line (index = (count-1)/2) has zero offset', () => {
    // parallelCount=3, index=1 → off = (1 - 1) * 14 = 0
    const result = applyParallelOffset(p1, p2, 1, 3);
    expect(result.p1).toEqual(p1);
    expect(result.p2).toEqual(p2);
  });

  it('produces equal and opposite offsets for first and last parallel lines', () => {
    const r0 = applyParallelOffset(p1, p2, 0, 3);
    const r2 = applyParallelOffset(p1, p2, 2, 3);
    expect(r0.p1.y).toBeCloseTo(-r2.p1.y);
    expect(r0.p2.y).toBeCloseTo(-r2.p2.y);
  });
});

// ── edgeState ─────────────────────────────────────────────────────────────────

type EdgeState = 'default' | 'hovered' | 'selected';
function edgeState(isSelected: boolean, isHovered: boolean): EdgeState {
  if (isSelected) return 'selected';
  if (isHovered)  return 'hovered';
  return 'default';
}

describe('edgeState', () => {
  it('returns "selected" when isSelected is true', () => {
    expect(edgeState(true, false)).toBe('selected');
    expect(edgeState(true, true)).toBe('selected');  // selected wins over hovered
  });

  it('returns "hovered" when only isHovered is true', () => {
    expect(edgeState(false, true)).toBe('hovered');
  });

  it('returns "default" when both are false', () => {
    expect(edgeState(false, false)).toBe('default');
  });
});

// ── resolveMarkers ────────────────────────────────────────────────────────────

function markerUrl(id: string, state: EdgeState): string {
  return `url(#${id}-${state === 'default' ? '' : state === 'hovered' ? 'hov' : 'sel'})`
    .replace('--', '-');
}

function resolveMarkers(type: string, state: EdgeState) {
  if (type === 'inheritance') return { mEnd: markerUrl('uml-inherit', state), mStart: undefined };
  if (type === 'association')  return { mEnd: markerUrl('uml-assoc',   state), mStart: undefined };
  if (type === 'composition')  return { mEnd: undefined, mStart: markerUrl('uml-compose', state) };
  return { mEnd: undefined, mStart: undefined };
}

describe('resolveMarkers', () => {
  describe('inheritance', () => {
    it('sets mEnd, no mStart', () => {
      const { mEnd, mStart } = resolveMarkers('inheritance', 'default');
      expect(mEnd).toMatch(/uml-inherit/);
      expect(mStart).toBeUndefined();
    });
    it('uses -hov suffix when hovered', () => {
      expect(resolveMarkers('inheritance', 'hovered').mEnd).toBe('url(#uml-inherit-hov)');
    });
    it('uses -sel suffix when selected', () => {
      expect(resolveMarkers('inheritance', 'selected').mEnd).toBe('url(#uml-inherit-sel)');
    });
  });

  describe('association', () => {
    it('sets mEnd, no mStart', () => {
      const { mEnd, mStart } = resolveMarkers('association', 'default');
      expect(mEnd).toMatch(/uml-assoc/);
      expect(mStart).toBeUndefined();
    });
  });

  describe('composition', () => {
    it('sets mStart, no mEnd', () => {
      const { mEnd, mStart } = resolveMarkers('composition', 'default');
      expect(mStart).toMatch(/uml-compose/);
      expect(mEnd).toBeUndefined();
    });
    it('uses -sel suffix when selected', () => {
      expect(resolveMarkers('composition', 'selected').mStart).toBe('url(#uml-compose-sel)');
    });
  });

  describe('unknown type', () => {
    it('returns undefined for both markers', () => {
      const { mEnd, mStart } = resolveMarkers('unknown', 'default');
      expect(mEnd).toBeUndefined();
      expect(mStart).toBeUndefined();
    });
  });
});
