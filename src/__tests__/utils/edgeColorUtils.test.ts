import {
  EDGE_COLORS,
  getEdgeColor,
  resetColorRegistry,
  getColorRegistry,
  setEdgeColor,
  removeEdgeColor,
  getColorStats,
} from '../../utils/edgeColorUtils';

beforeEach(() => {
  resetColorRegistry();
});

describe('EDGE_COLORS', () => {
  it('should contain 25 colors', () => {
    expect(EDGE_COLORS).toHaveLength(25);
  });

  it('should contain only valid hex color strings', () => {
    EDGE_COLORS.forEach(color => {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it('should contain only unique colors', () => {
    const unique = new Set(EDGE_COLORS);
    expect(unique.size).toBe(EDGE_COLORS.length);
  });
});

describe('getEdgeColor', () => {
  it('should return a valid hex color', () => {
    const color = getEdgeColor('node-1', 'node-2');
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('should return the same color for the same node pair', () => {
    const first = getEdgeColor('node-1', 'node-2');
    const second = getEdgeColor('node-1', 'node-2');
    expect(first).toBe(second);
  });

  it('should return the same color regardless of direction', () => {
    const forward = getEdgeColor('node-1', 'node-2');
    const backward = getEdgeColor('node-2', 'node-1');
    expect(forward).toBe(backward);
  });

  it('should assign different colors to different node pairs', () => {
    const color1 = getEdgeColor('node-1', 'node-2');
    const color2 = getEdgeColor('node-3', 'node-4');
    expect(color1).not.toBe(color2);
  });

  it('should assign colors sequentially from EDGE_COLORS', () => {
    const color1 = getEdgeColor('a', 'b');
    const color2 = getEdgeColor('c', 'd');
    expect(color1).toBe(EDGE_COLORS[0]);
    expect(color2).toBe(EDGE_COLORS[1]);
  });

  it('should cycle through colors when all 25 are used', () => {
    // Use up all 25 colors
    for (let i = 0; i < 25; i++) {
      getEdgeColor(`node-${i}a`, `node-${i}b`);
    }
    // The 26th pair should cycle back to the first color
    const cycledColor = getEdgeColor('node-26a', 'node-26b');
    expect(cycledColor).toBe(EDGE_COLORS[0]);
  });

  it('should return first color from palette for first assignment', () => {
    const color = getEdgeColor('node-1', 'node-2');
    expect(color).toBe(EDGE_COLORS[0]);
  });
});

describe('resetColorRegistry', () => {
  it('should clear all color assignments', () => {
    getEdgeColor('node-1', 'node-2');
    getEdgeColor('node-3', 'node-4');
    resetColorRegistry();
    expect(getColorRegistry().size).toBe(0);
  });

  it('should reset color index so next assignment starts from first color', () => {
    getEdgeColor('node-1', 'node-2');
    getEdgeColor('node-3', 'node-4');
    resetColorRegistry();
    const color = getEdgeColor('node-5', 'node-6');
    expect(color).toBe(EDGE_COLORS[0]);
  });
});

describe('getColorRegistry', () => {
  it('should return empty map initially', () => {
    expect(getColorRegistry().size).toBe(0);
  });

  it('should return a copy, not the original registry', () => {
    getEdgeColor('node-1', 'node-2');
    const registry = getColorRegistry();
    registry.clear();
    // Original should be unaffected
    expect(getColorRegistry().size).toBe(1);
  });

  it('should contain assigned color entries', () => {
    const color = getEdgeColor('node-1', 'node-2');
    const registry = getColorRegistry();
    expect(registry.size).toBe(1);
    const value = Array.from(registry.values())[0];
    expect(value).toBe(color);
  });

  it('should use normalized key format', () => {
    getEdgeColor('node-b', 'node-a');
    const registry = getColorRegistry();
    // node-a < node-b alphabetically, so key should be node-a|node-b
    expect(registry.has('node-a|node-b')).toBe(true);
  });
});

describe('setEdgeColor', () => {
  it('should manually assign a color to a node pair', () => {
    setEdgeColor('node-1', 'node-2', '#FF0000');
    expect(getEdgeColor('node-1', 'node-2')).toBe('#FF0000');
  });

  it('should override an existing color assignment', () => {
    getEdgeColor('node-1', 'node-2');
    setEdgeColor('node-1', 'node-2', '#00FF00');
    expect(getEdgeColor('node-1', 'node-2')).toBe('#00FF00');
  });

  it('should be direction-independent', () => {
    setEdgeColor('node-1', 'node-2', '#0000FF');
    expect(getEdgeColor('node-2', 'node-1')).toBe('#0000FF');
  });
});

describe('removeEdgeColor', () => {
  it('should remove color assignment for a node pair', () => {
    getEdgeColor('node-1', 'node-2');
    removeEdgeColor('node-1', 'node-2');
    expect(getColorRegistry().size).toBe(0);
  });

  it('should cause next getEdgeColor call to assign a new color', () => {
    const original = getEdgeColor('node-1', 'node-2');
    removeEdgeColor('node-1', 'node-2');
    // After removal, next assignment gets next index color (not necessarily same)
    const reassigned = getEdgeColor('node-1', 'node-2');
    // Both should be valid colors from the palette
    expect(EDGE_COLORS).toContain(reassigned);
    // And a new entry should exist in registry
    expect(getColorRegistry().size).toBe(1);
  });

  it('should be direction-independent', () => {
    getEdgeColor('node-1', 'node-2');
    removeEdgeColor('node-2', 'node-1');
    expect(getColorRegistry().size).toBe(0);
  });

  it('should not throw when removing non-existent pair', () => {
    expect(() => removeEdgeColor('nonexistent-1', 'nonexistent-2')).not.toThrow();
  });
});

describe('getColorStats', () => {
  it('should return zero stats initially', () => {
    const stats = getColorStats();
    expect(stats.totalAssignments).toBe(0);
    expect(stats.nextColorIndex).toBe(0);
    expect(stats.availableColors).toBe(25);
  });

  it('should reflect correct total assignments', () => {
    getEdgeColor('node-1', 'node-2');
    getEdgeColor('node-3', 'node-4');
    expect(getColorStats().totalAssignments).toBe(2);
  });

  it('should reflect correct next color index', () => {
    getEdgeColor('node-1', 'node-2');
    getEdgeColor('node-3', 'node-4');
    expect(getColorStats().nextColorIndex).toBe(2);
  });

  it('should wrap next color index after cycling through all colors', () => {
    for (let i = 0; i < 25; i++) {
      getEdgeColor(`node-${i}a`, `node-${i}b`);
    }
    expect(getColorStats().nextColorIndex).toBe(0);
  });

  it('should always report 25 available colors', () => {
    getEdgeColor('node-1', 'node-2');
    expect(getColorStats().availableColors).toBe(25);
  });
});