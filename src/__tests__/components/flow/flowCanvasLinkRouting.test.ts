import { describe, expect, it, beforeEach } from 'vitest';
import type { Edge, Node } from 'reactflow';
import {
  endsAreOrthogonal,
  routeAllReactionEdges,
  type SavedRoute,
} from '../../../components/flow/flowCanvasAStarRouter';
import { settleReactionRoutes } from '../../../components/flow/flowCanvasRouteSettle';
import {
  cleanRoute,
  moveSegment,
  prepareSegmentDrag,
} from '../../../components/flow/flowCanvasLinkEditing';
import {
  collectVsumRoutes,
  loadVsumRoutes,
  saveVsumRoutes,
  vsumRouteKeys,
} from '../../../utils/vsumRouteStorage';

function box(id: string, x: number, y: number, metaModelId: number): Node {
  return {
    id,
    type: 'ecoreFile',
    position: { x, y },
    width: 200,
    height: 160,
    data: { metaModelId, fileName: `${id}.ecore` },
  };
}

function link(id: string, source: string, target: string): Edge {
  return { id, source, target, type: 'reactions', data: {} };
}

const nodes = [box('a', 0, 0, 1), box('b', 600, 40, 2), box('c', 0, 400, 3)];

describe('reaction link routing', () => {
  it('leaves and enters boxes perpendicular to their side', () => {
    const edges = [link('e1', 'a', 'b'), link('e2', 'b', 'c'), link('e3', 'c', 'a')];
    const routes = routeAllReactionEdges(nodes, edges);
    expect(routes.size).toBe(3);
    for (const route of routes.values()) {
      expect(endsAreOrthogonal(route.points, route.sourceHandle, route.targetHandle)).toBe(true);
      for (let i = 0; i < route.points.length - 1; i++) {
        const a = route.points[i];
        const b = route.points[i + 1];
        expect(Math.abs(a.x - b.x) < 0.5 || Math.abs(a.y - b.y) < 0.5).toBe(true);
      }
    }
  });

  it('keeps ends of links sharing a box side apart', () => {
    const edges = [link('e1', 'a', 'b'), link('e2', 'a', 'b'), link('e3', 'b', 'a')];
    const routes = routeAllReactionEdges(nodes, edges);
    const starts = ['e1', 'e2'].map(id => routes.get(id)!.points[0]);
    expect(Math.abs(starts[0].y - starts[1].y)).toBeGreaterThan(10);
    const aEnds = [routes.get('e1')!.points[0], routes.get('e2')!.points[0], routes.get('e3')!.points.at(-1)!];
    const ys = aEnds.map(p => p.y);
    expect(new Set(ys.map(y => Math.round(y))).size).toBe(3);
  });

  it('reuses a valid saved route instead of recomputing it', () => {
    const [first] = [...routeAllReactionEdges(nodes, [link('e1', 'a', 'b')]).values()];
    const saved: SavedRoute = {
      ...first,
      points: [first.points[0], ...first.points.slice(1)],
    };
    const edge = { ...link('e1', 'a', 'b'), data: { savedRoute: saved } };
    const routes = routeAllReactionEdges(nodes, [edge]);
    expect(routes.get('e1')!.points).toEqual(saved.points);
  });

  it('settles routes once, restores them from storage, and recomputes after a box moves', () => {
    const edges = [link('e1', 'a', 'b')];
    const settled = settleReactionRoutes(nodes, edges, {});
    expect(settled).not.toBe(edges);
    const route = settled[0].data.savedRoute as SavedRoute;
    expect(route.points.length).toBeGreaterThan(1);
    expect(settleReactionRoutes(nodes, settled, {})).toBe(settled);

    const restored = settleReactionRoutes(nodes, edges, collectVsumRoutes(nodes, settled));
    expect(restored[0].data.savedRoute).toEqual(route);

    const moved = nodes.map(n => (n.id === 'b' ? { ...n, position: { x: 700, y: 300 } } : n));
    const after = settleReactionRoutes(moved, settled, {});
    expect(after[0].data.savedRoute).not.toEqual(route);
  });
});

describe('vsumRouteStorage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips routes per project', () => {
    const settled = settleReactionRoutes(nodes, [link('e1', 'a', 'b')], {});
    const routes = collectVsumRoutes(nodes, settled);
    saveVsumRoutes(5, routes);
    expect(loadVsumRoutes(5)).toEqual(routes);
    expect(loadVsumRoutes(6)).toEqual({});
  });
});

describe('link editing', () => {
  const route = [
    { x: 200, y: 80 },
    { x: 224, y: 80 },
    { x: 224, y: 300 },
    { x: 500, y: 300 },
    { x: 500, y: 100 },
    { x: 476, y: 100 },
    { x: 476, y: 100 },
  ];

  it('slides a segment sideways without skewing neighbours', () => {
    const prepared = prepareSegmentDrag(cleanRoute(route), 2)!;
    expect(prepared).not.toBeNull();
    const moved = moveSegment(prepared, 340);
    for (let i = 0; i < moved.length - 1; i++) {
      const a = moved[i];
      const b = moved[i + 1];
      expect(Math.abs(a.x - b.x) < 0.5 || Math.abs(a.y - b.y) < 0.5).toBe(true);
    }
    expect(moved[0]).toEqual({ x: 200, y: 80 });
  });

  it('refuses to move a bare stub and clamps stubs from collapsing into the box', () => {
    const lroute = [{ x: 200, y: 80 }, { x: 224, y: 80 }, { x: 224, y: 300 }, { x: 400, y: 300 }];
    expect(prepareSegmentDrag(lroute, 0)).toBeNull();
    const prepared = prepareSegmentDrag(lroute, 1)!;
    const moved = moveSegment(prepared, 190);
    expect(moved[1].x).toBeGreaterThanOrEqual(200 + 14);
  });

  it('splits a long straight link so its middle can be dragged away from the line', () => {
    const straight = [{ x: 0, y: 50 }, { x: 400, y: 50 }];
    const prepared = prepareSegmentDrag(straight, 0)!;
    expect(prepared).not.toBeNull();
    const moved = cleanRoute(moveSegment(prepared, 120));
    expect(moved[0]).toEqual({ x: 0, y: 50 });
    expect(moved.at(-1)).toEqual({ x: 400, y: 50 });
    expect(moved[1].y).toBe(50);
    expect(moved.length).toBeGreaterThan(2);
  });
});

describe('route tidying', () => {
  it('removes a hook where a run overshoots and steps back', async () => {
    const { tidyRoute } = await import('../../../components/flow/flowCanvasAStarRouter');
    const hooked = [
      { x: 150, y: 125 },
      { x: 150, y: 149 },
      { x: 150, y: 570 },
      { x: 147, y: 570 },
      { x: 147, y: 550 },
      { x: 1070, y: 550 },
      { x: 1094, y: 550 },
    ];
    expect(tidyRoute(hooked)).toEqual([
      { x: 150, y: 125 },
      { x: 150, y: 550 },
      { x: 1094, y: 550 },
    ]);
  });

  it('slides a micro-jog onto the neighbouring run', async () => {
    const { tidyRoute } = await import('../../../components/flow/flowCanvasAStarRouter');
    const jogged = [
      { x: 100, y: 0 },
      { x: 100, y: 40 },
      { x: 103, y: 40 },
      { x: 103, y: 200 },
      { x: 400, y: 200 },
    ];
    expect(tidyRoute(jogged)).toEqual([
      { x: 100, y: 0 },
      { x: 100, y: 200 },
      { x: 400, y: 200 },
    ]);
  });
});

describe('fine-granular link routing', () => {
  const cls = (id: string, x: number, y: number): Node => ({
    id,
    type: 'eobject',
    position: { x, y },
    width: 180,
    height: 40,
    data: { attributes: [] },
  });
  const fine = (id: string, source: string, target: string): Edge => ({
    id,
    source,
    target,
    type: 'fine-granular-reaction',
    data: {},
  });

  it('spreads ends that arrive on the same class side and avoids huge detours', () => {
    const fineNodes = [cls('c1', 0, 0), cls('c2', 300, 0), cls('root', 150, 400)];
    const routes = routeAllReactionEdges(fineNodes, [fine('f1', 'c1', 'root'), fine('f2', 'c2', 'root')]);
    const r1 = routes.get('f1')!;
    const r2 = routes.get('f2')!;
    expect(r1.targetHandle).toBe(r2.targetHandle);
    const end1 = r1.points.at(-1)!;
    const end2 = r2.points.at(-1)!;
    expect(Math.hypot(end1.x - end2.x, end1.y - end2.y)).toBeGreaterThan(20);
    for (const r of [r1, r2]) {
      expect(endsAreOrthogonal(r.points, r.sourceHandle, r.targetHandle)).toBe(true);
      const length = r.points.slice(1).reduce(
        (sum, p, i) => sum + Math.abs(p.x - r.points[i].x) + Math.abs(p.y - r.points[i].y),
        0,
      );
      expect(length).toBeLessThan(900);
    }
  });
});

describe('routing while dragging', () => {
  it('reuses untouched routes and re-attaches moved links with orthogonal ends', async () => {
    const { routeReactionEdgesWhileDragging } = await import('../../../components/flow/flowCanvasAStarRouter');
    const edges = [link('e1', 'a', 'b'), link('e2', 'a', 'c')];
    const full = routeAllReactionEdges(nodes, edges);
    const moved = nodes.map(n => (n.id === 'b' ? { ...n, position: { x: 700, y: 300 } } : n));
    const quick = routeReactionEdgesWhileDragging(moved, edges, full);
    expect(quick.get('e2')).toBe(full.get('e2'));
    const r1 = quick.get('e1')!;
    expect(r1).not.toBe(full.get('e1'));
    expect(endsAreOrthogonal(r1.points, r1.sourceHandle, r1.targetHandle)).toBe(true);
  });
});

describe('cramped layouts', () => {
  it('goes vertical instead of squeezing between boxes that are nearly side by side', async () => {
    const { facingSides } = await import('../../../components/flow/flowCanvasAStarRouter');
    const upper = { x: 938, y: 298, width: 122, height: 130 };
    const lower = { x: 804, y: 865, width: 122, height: 130 };
    expect(facingSides(lower, upper)).toEqual({ source: 'top', target: 'bottom' });
  });

  it('fits two arrowheads on a short side without overlapping', () => {
    const small: Node = { id: 'root', type: 'eobject', position: { x: 600, y: 300 }, width: 150, height: 30, data: {} };
    const left = (id: string, y: number): Node => ({
      id,
      type: 'eobject',
      position: { x: 0, y },
      width: 150,
      height: 30,
      data: {},
    });
    const routes = routeAllReactionEdges(
      [small, left('p', 250), left('q', 330)],
      [
        { id: 'f1', source: 'p', target: 'root', type: 'fine-granular-reaction', data: {} },
        { id: 'f2', source: 'q', target: 'root', type: 'fine-granular-reaction', data: {} },
      ],
    );
    const ends = ['f1', 'f2'].map(id => routes.get(id)!.points.at(-1)!);
    expect(Math.abs(ends[0].y - ends[1].y)).toBeGreaterThanOrEqual(14);
  });

  it('drops a stored route whose first or last run is too short for an arrowhead', () => {
    const squeezed = {
      sourceHandle: 'right' as const,
      targetHandle: 'left' as const,
      points: [{ x: 118, y: 63 }, { x: 123, y: 63 }, { x: 123, y: 400 }, { x: 129, y: 400 }],
    };
    const near = [box('a', 0, 0, 1), box('b', 129, 337, 2)].map(n => ({ ...n, width: 118, height: 126 }));
    const edges = [link('e1', 'a', 'b')];
    const key = [...vsumRouteKeys(near, edges).values()][0];
    const settled = settleReactionRoutes(near, edges, { [key]: squeezed });
    const route = settled[0].data.savedRoute as SavedRoute;
    expect(route.points).not.toEqual(squeezed.points);
  });
});
