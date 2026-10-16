import type { Edge, Node } from 'reactflow';
import {
  applyAStarReactionHandles,
  ecoreFileRect,
  facingSides,
  nodeWorldRect,
  pickSideFromPoint,
  polylineHitsRects,
  routeAllReactionEdges,
  routeOrthogonalAStar,
  routeToCursorAStar,
} from '../../../components/flow/flowCanvasAStarRouter';
import {
  EOBJECT_ATTR_ROW_HEIGHT,
  EOBJECT_HEADER_HEIGHT,
} from '../../../utils/reactionEdgeGeometry';

const box = (x: number, y: number, width = 118, height = 126) => ({ x, y, width, height });
const ecore = (id: string, x: number, y: number): Node =>
  ({ id, type: 'ecoreFile', position: { x, y }, data: {} } as Node);
const reaction = (id: string, source: string, target: string): Edge =>
  ({ id, source, target, type: 'reactions' } as Edge);

describe('facingSides', () => {
  it('attaches to the top of a box that sits below and to the left', () => {
    const upperRight = box(200, 0);
    const lowerLeft = box(0, 200);
    expect(facingSides(upperRight, lowerLeft)).toEqual({
      source: 'bottom',
      target: 'top',
    });
    const route = routeOrthogonalAStar({ source: upperRight, target: lowerLeft });
    expect(route.targetHandle).toBe('top');
    expect(route.sourceHandle).toBe('bottom');
    const last = route.points[route.points.length - 1];
    const first = route.points[0];
    expect(last.y).toBe(200);
    expect(last.x).toBeCloseTo(0 + 118 / 2, 0);
    expect(first.y).toBe(126);
    expect(first.x).toBeCloseTo(200 + 118 / 2, 0);
    const beforeLast = route.points[route.points.length - 2];
    expect(Math.abs(beforeLast.x - last.x)).toBeLessThan(1);
    expect(last.y).toBeGreaterThan(beforeLast.y);
    expect(beforeLast.y).toBeCloseTo((first.y + last.y) / 2, 0);
  });
});

describe('pickSideFromPoint', () => {
  const model = box(100, 100);

  it('picks the side the cursor is approaching', () => {
    expect(pickSideFromPoint(model, { x: 40, y: 160 })).toBe('left');
    expect(pickSideFromPoint(model, { x: 280, y: 160 })).toBe('right');
    expect(pickSideFromPoint(model, { x: 160, y: 40 })).toBe('top');
    expect(pickSideFromPoint(model, { x: 160, y: 280 })).toBe('bottom');
  });
});

describe('routeOrthogonalAStar', () => {
  it('never routes through a model box sitting between the endpoints', () => {
    const source = box(0, 0);
    const target = box(400, 0);
    const obstacle = box(170, -20, 80, 180);
    const route = routeOrthogonalAStar({
      source,
      target,
      obstacles: [obstacle],
    });
    expect(polylineHitsRects(route.points, [obstacle])).toBe(false);
    expect(route.points.length).toBeGreaterThan(2);
  });

  it('picks a target side that matches the approaching cursor', () => {
    const route = routeOrthogonalAStar({
      source: box(0, 80),
      target: box(300, 200),
      lockSourceHandle: 'right',
      cursor: { x: 360, y: 140 },
    });
    expect(route.sourceHandle).toBe('right');
    expect(route.targetHandle).toBe('top');
  });

  it('stays orthogonal and avoids extra elbows in open space', () => {
    const route = routeOrthogonalAStar({
      source: box(0, 0),
      target: box(280, 220),
    });
    for (let i = 0; i < route.points.length - 1; i++) {
      const a = route.points[i];
      const b = route.points[i + 1];
      const axisAligned = Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 1;
      expect(axisAligned).toBe(true);
    }
    expect(route.points.length).toBeLessThanOrEqual(4);
    const first = route.points[0];
    const last = route.points[route.points.length - 1];
    const midX = (first.x + last.x) / 2;
    const midY = (first.y + last.y) / 2;
    const breaksMidway = route.points.some(p => (
      Math.abs(p.x - midX) < 2 || Math.abs(p.y - midY) < 2
    ));
    expect(breaksMidway).toBe(true);
  });

  it('starts on the source box and ends on the target box', () => {
    const source = box(0, 0);
    const target = box(280, 220);
    const route = routeOrthogonalAStar({ source, target });
    const first = route.points[0];
    const last = route.points[route.points.length - 1];
    const onBorder = (p: { x: number; y: number }, r: { x: number; y: number; width: number; height: number }) => {
      const onX = Math.abs(p.x - r.x) < 1.5 || Math.abs(p.x - (r.x + r.width)) < 1.5;
      const onY = Math.abs(p.y - r.y) < 1.5 || Math.abs(p.y - (r.y + r.height)) < 1.5;
      const inX = p.x >= r.x - 1.5 && p.x <= r.x + r.width + 1.5;
      const inY = p.y >= r.y - 1.5 && p.y <= r.y + r.height + 1.5;
      return (onX && inY) || (onY && inX);
    };
    expect(onBorder(first, source)).toBe(true);
    expect(onBorder(last, target)).toBe(true);
  });

  it('detours instead of sitting on an existing connection', () => {
    const first = routeOrthogonalAStar({
      source: box(0, 0),
      target: box(300, 0),
    });
    const second = routeOrthogonalAStar({
      source: box(0, 160),
      target: box(300, 160),
      existing: [first.points],
    });
    const firstYs = new Set(first.points.map(p => Math.round(p.y / 5) * 5));
    const sharedCorridor = second.points.some(p => firstYs.has(Math.round(p.y / 5) * 5)
      && p.x > 130 && p.x < 280);
    expect(sharedCorridor).toBe(false);
  });
});

describe('routeToCursorAStar', () => {
  it('starts at the locked source side and ends at the cursor', () => {
    const points = routeToCursorAStar(box(0, 0), 'right', { x: 260, y: 90 }, []);
    expect(points[0].x).toBe(118);
    expect(points[points.length - 1]).toEqual({ x: 260, y: 90 });
  });
});

describe('routeAllReactionEdges', () => {
  it('assigns a path and handles for every reaction edge', () => {
    const routes = routeAllReactionEdges(
      [ecore('a', 0, 0), ecore('b', 300, 0)],
      [reaction('e1', 'a', 'b')],
    );
    expect(routes.get('e1')?.points.length).toBeGreaterThan(1);
    expect(routes.get('e1')?.sourceHandle).toBeDefined();
    expect(routes.get('e1')?.targetHandle).toBeDefined();
  });

  it('routes fine-granular reactions around other classes', () => {
    const cls = (id: string, x: number, y: number): Node =>
      ({ id, type: 'eobject', position: { x, y }, width: 200, height: 56, data: {} } as Node);
    const routes = routeAllReactionEdges(
      [cls('a', 0, 0), cls('wall', 220, -40), cls('b', 500, 0)],
      [{ id: 'fg', source: 'a', target: 'b', type: 'fine-granular-reaction' } as Edge],
    );
    const path = routes.get('fg')?.points ?? [];
    expect(path.length).toBeGreaterThan(1);
    expect(polylineHitsRects(path, [box(220, -40, 200, 56)])).toBe(false);
  });

  it('pins an attribute reaction to the field handle, not the class box', () => {
    const cls = (id: string, x: number): Node => ({
      id,
      type: 'eobject',
      position: { x, y: 0 },
      width: 200,
      height: EOBJECT_HEADER_HEIGHT + 2 * EOBJECT_ATTR_ROW_HEIGHT,
      data: { attributes: [{ name: 'id' }, { name: 'name' }] },
    } as Node);
    const routes = routeAllReactionEdges(
      [cls('a', 0), cls('b', 400)],
      [{
        id: 'fg',
        source: 'a',
        target: 'b',
        type: 'fine-granular-reaction',
        sourceHandle: 'reaction-source-http://a#A.name',
        targetHandle: 'reaction-target-http://b#B.name',
      } as Edge],
    );
    const path = routes.get('fg')!.points;
    const first = path[0];
    const last = path[path.length - 1];
    const attrY = EOBJECT_HEADER_HEIGHT + EOBJECT_ATTR_ROW_HEIGHT + EOBJECT_ATTR_ROW_HEIGHT / 2;
    expect(first).toEqual({ x: 200, y: attrY });
    expect(last).toEqual({ x: 400, y: attrY });
  });

  it('keeps a later edge off an earlier corridor', () => {
    const routes = routeAllReactionEdges(
      [ecore('a', 0, 0), ecore('b', 300, 0), ecore('c', 0, 180), ecore('d', 300, 180)],
      [reaction('e1', 'a', 'b'), reaction('e2', 'c', 'd')],
    );
    const first = routes.get('e1')!.points;
    const second = routes.get('e2')!.points;
    expect(polylineHitsRects(second, [box(170, -10, 40, 40)])).toBe(false);
    expect(first).not.toEqual(second);
  });
});

describe('applyAStarReactionHandles', () => {
  it('rewrites stale handles from the computed route', () => {
    const nodes = [ecore('a', 0, 0), ecore('b', 0, 400)];
    const edges = [{
      ...reaction('e1', 'a', 'b'),
      sourceHandle: 'left',
      targetHandle: 'right',
    } as Edge];
    const next = applyAStarReactionHandles(nodes, edges);
    expect(next[0].sourceHandle).toBe('bottom');
    expect(next[0].targetHandle).toBe('top');
  });

  it('ignores a stale via-point when choosing attachment sides', () => {
    const nodes = [ecore('a', 0, 0), ecore('b', 600, 0)];
    const edges = [{
      ...reaction('e1', 'a', 'b'),
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: { customControlPoint: { x: 1, y: 1 } },
    } as Edge];
    const next = applyAStarReactionHandles(nodes, edges);
    expect(next[0].sourceHandle).toBe('right');
    expect(next[0].targetHandle).toBe('left');
  });

  it('returns the same array when handles already match', () => {
    const nodes = [ecore('a', 0, 0), ecore('b', 0, 400)];
    const routed = applyAStarReactionHandles(nodes, [reaction('e1', 'a', 'b')]);
    expect(applyAStarReactionHandles(nodes, routed)).toBe(routed);
  });
});

describe('ecoreFileRect', () => {
  it('uses the ecore card size by default', () => {
    expect(ecoreFileRect(ecore('a', 8, 12))).toMatchObject({ x: 8, y: 12, width: 118, height: 126 });
  });

  it('follows position when positionAbsolute is stale after a bbox move', () => {
    const node = {
      ...ecore('a', 40, 50),
      positionAbsolute: { x: 8, y: 12 },
    } as Node;
    expect(nodeWorldRect(node)).toMatchObject({ x: 40, y: 50 });
  });
});
