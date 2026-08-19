import type { Edge } from 'reactflow';
import {
  applyPerpendicularOffset,
  EOBJECT_ATTR_ROW_HEIGHT,
  EOBJECT_HEADER_HEIGHT,
  getBorderPoint,
  indexFineReactionParallels,
  layoutFineReactionChord,
  parseReactionHandle,
  reactionRowRect,
} from '../../utils/reactionEdgeGeometry';

const sourceNode = {
  x: 0,
  y: 0,
  width: 200,
  attributes: [{ name: 'id' }, { name: 'name' }],
};

describe('parseReactionHandle', () => {
  it('treats a class-level handle as the whole class', () => {
    expect(parseReactionHandle('reaction-source-http://pcm#Component'))
      .toEqual({ kind: 'class', eObjectId: 'http://pcm#Component' });
  });

  it('extracts the attribute name from a feature handle', () => {
    expect(parseReactionHandle('reaction-target-http://pcm#Component.name'))
      .toEqual({
        kind: 'attribute',
        eObjectId: 'http://pcm#Component',
        attributeName: 'name',
      });
  });
});

describe('reactionRowRect', () => {
  it('uses the header row for class-level handles', () => {
    const rect = reactionRowRect(sourceNode, 'reaction-source-http://pcm#Component');
    expect(rect).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: EOBJECT_HEADER_HEIGHT,
    });
  });

  it('uses the matching attribute row, not the whole class box', () => {
    const rect = reactionRowRect(sourceNode, 'reaction-source-http://pcm#Component.name');
    expect(rect.y).toBe(EOBJECT_HEADER_HEIGHT + EOBJECT_ATTR_ROW_HEIGHT);
    expect(rect.height).toBe(EOBJECT_ATTR_ROW_HEIGHT);
    expect(rect.y + rect.height).toBeLessThan(EOBJECT_HEADER_HEIGHT + 2 * EOBJECT_ATTR_ROW_HEIGHT + 1);
  });
});

describe('layoutFineReactionChord', () => {
  const left = { x: 0, y: 0, width: 200, attributes: [{ name: 'name' }] };
  const rightA = { x: 400, y: 0, width: 200, attributes: [{ name: 'name' }] };
  const rightB = { x: 400, y: 200, width: 200, attributes: [{ name: 'name' }] };

  it('hits different header border points for two different targets', () => {
    const classHandle = 'reaction-source-http://a#A';
    const toA = layoutFineReactionChord({
      source: left,
      target: rightA,
      sourceHandle: classHandle,
      targetHandle: 'reaction-target-http://b#B',
    });
    const toB = layoutFineReactionChord({
      source: left,
      target: rightB,
      sourceHandle: classHandle,
      targetHandle: 'reaction-target-http://c#C',
    });

    expect(toA.p1.y).not.toBeCloseTo(toB.p1.y, 5);
    expect(toA.p1.x).toBe(200);
    expect(toB.p1.y).toBeGreaterThan(toA.p1.y);
  });

  it('attaches attribute edges to the attribute row, not the header', () => {
    const chord = layoutFineReactionChord({
      source: left,
      target: rightA,
      sourceHandle: 'reaction-source-http://a#A.name',
      targetHandle: 'reaction-target-http://b#B',
    });
    const headerBottom = EOBJECT_HEADER_HEIGHT;
    expect(chord.p1.y).toBeGreaterThanOrEqual(headerBottom);
    expect(chord.p1.y).toBeLessThanOrEqual(headerBottom + EOBJECT_ATTR_ROW_HEIGHT);
  });

  it('pins attribute endpoints to the reaction handle dots', () => {
    const fromAttr = layoutFineReactionChord({
      source: left,
      target: rightA,
      sourceHandle: 'reaction-source-http://a#A.name',
      targetHandle: 'reaction-target-http://b#B',
    });
    expect(fromAttr.p1).toEqual({
      x: 200,
      y: EOBJECT_HEADER_HEIGHT + EOBJECT_ATTR_ROW_HEIGHT / 2,
    });

    const toAttr = layoutFineReactionChord({
      source: left,
      target: rightA,
      sourceHandle: 'reaction-source-http://a#A',
      targetHandle: 'reaction-target-http://b#B.name',
    });
    expect(toAttr.p2).toEqual({
      x: 400,
      y: EOBJECT_HEADER_HEIGHT + EOBJECT_ATTR_ROW_HEIGHT / 2,
    });
  });

  it('places the arrow tip on the target endpoint, not an inset of the line', () => {
    const chord = layoutFineReactionChord({
      source: left,
      target: rightA,
      sourceHandle: 'reaction-source-http://a#A.name',
      targetHandle: 'reaction-target-http://b#B.name',
    });
    expect(chord.p2.x).toBe(400);
    expect(chord.drawP2.x).toBeLessThan(chord.p2.x);
    expect(chord.p2.x - chord.drawP2.x).toBeCloseTo(10, 5);
  });

  it('offsets two reactions that share the same handle pair', () => {
    const first = layoutFineReactionChord({
      source: left,
      target: rightA,
      sourceHandle: 'reaction-source-http://a#A',
      targetHandle: 'reaction-target-http://b#B',
      parallelIndex: 0,
      parallelCount: 2,
    });
    const second = layoutFineReactionChord({
      source: left,
      target: rightA,
      sourceHandle: 'reaction-source-http://a#A',
      targetHandle: 'reaction-target-http://b#B',
      parallelIndex: 1,
      parallelCount: 2,
    });
    expect(first.p1.y).not.toBeCloseTo(second.p1.y, 5);
  });
});

describe('applyPerpendicularOffset', () => {
  it('leaves a single edge unmoved', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 10, y: 0 };
    expect(applyPerpendicularOffset(p1, p2, 0, 1)).toEqual({ p1, p2 });
  });
});

describe('getBorderPoint', () => {
  it('returns the right edge when aiming right from the center', () => {
    expect(getBorderPoint(100, 50, 200, 100, 400, 50)).toEqual({ x: 200, y: 50 });
  });
});

describe('indexFineReactionParallels', () => {
  const handle = 'reaction-source-http://a#A';
  const targetHandle = 'reaction-target-http://b#B';
  const fine = (id: string): Edge => ({
    id,
    source: 'n1',
    target: 'n2',
    sourceHandle: handle,
    targetHandle,
    type: 'fine-granular-reaction',
  } as Edge);

  it('assigns parallelCount 2 when two fine edges share the same handles', () => {
    const map = indexFineReactionParallels([fine('e2'), fine('e1')]);
    expect(map.get('e1')).toEqual({ index: 0, total: 2 });
    expect(map.get('e2')).toEqual({ index: 1, total: 2 });
  });

  it('ignores coarse reaction edges', () => {
    const coarse = {
      id: 'c1',
      source: 'n1',
      target: 'n2',
      type: 'reactions',
    } as Edge;
    const map = indexFineReactionParallels([fine('e1'), coarse]);
    expect(map.get('e1')).toEqual({ index: 0, total: 1 });
    expect(map.has('c1')).toBe(false);
  });

  it('keeps distinct handle pairs in separate groups', () => {
    const other: Edge = {
      ...fine('e3'),
      targetHandle: 'reaction-target-http://b#B.name',
    };
    const map = indexFineReactionParallels([fine('e1'), other]);
    expect(map.get('e1')?.total).toBe(1);
    expect(map.get('e3')?.total).toBe(1);
  });
});

describe('layoutFineReactionChord containment', () => {
  it('keeps the source attachment on the class header row', () => {
    const chord = layoutFineReactionChord({
      source: sourceNode,
      target: { x: 400, y: 40, width: 200 },
      sourceHandle: 'reaction-source-http://pcm#Component',
      targetHandle: 'reaction-target-http://p#Person',
    });
    expect(chord.p1.y).toBeGreaterThanOrEqual(0);
    expect(chord.p1.y).toBeLessThanOrEqual(EOBJECT_HEADER_HEIGHT);
  });
});
