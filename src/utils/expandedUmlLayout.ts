import type { Edge, Node } from 'reactflow';
import {
  nodeWorldRect,
  routeOrthogonalAStar,
  routeAroundClassRects,
  segmentCrossesRect as umlSegmentHitsRect,
  type Point,
  type Rect,
} from '../components/flow/flowCanvasAStarRouter';
import { getBorderPoint } from './reactionEdgeGeometry';

export { segmentCrossesRect as umlSegmentHitsRect } from '../components/flow/flowCanvasAStarRouter';

export interface UmlEdgeLabel extends Point {
  width: number;
  height: number;
}

export interface ExpandedUmlEdgeLayout {
  points: Point[];
  midpoint: Point;
  name?: UmlEdgeLabel;
  sourceMultiplicity?: UmlEdgeLabel;
  targetMultiplicity?: UmlEdgeLabel;
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Repair overlaps from layouts saved by the old row-height calculation. */
export function repairExpandedClassOverlaps(nodes: Node[]): boolean {
  const placed: Rect[] = [];
  let changed = false;
  for (const node of nodes) {
    const rect = nodeWorldRect(node);
    if (!rect) continue;
    let hit = placed.find(other => overlaps(rect, other));
    while (hit) {
      rect.y = hit.y + hit.height + 40;
      changed = true;
      hit = placed.find(other => overlaps(rect, other));
    }
    if (node.position.y !== rect.y) node.position = { ...node.position, y: rect.y };
    placed.push(rect);
  }
  return changed;
}

function chord(a: Rect, b: Rect): Point[] {
  const ac = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const bc = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  return [
    getBorderPoint(ac.x, ac.y, a.width, a.height, bc.x, bc.y),
    getBorderPoint(bc.x, bc.y, b.width, b.height, ac.x, ac.y),
  ];
}

function segments(points: Point[]): Array<{ a: Point; b: Point; length: number }> {
  return points.slice(1).map((b, i) => ({ a: points[i], b,
    length: Math.hypot(b.x - points[i].x, b.y - points[i].y) }))
    .filter(segment => segment.length > 0.001);
}

function midpoint(points: Point[]): Point {
  const longest = segments(points).sort((a, b) => b.length - a.length)[0];
  return longest ? { x: (longest.a.x + longest.b.x) / 2, y: (longest.a.y + longest.b.y) / 2 }
    : points[0];
}

function labelBounds(label: UmlEdgeLabel): Rect {
  return { x: label.x - label.width / 2 - 3, y: label.y - label.height / 2 - 3,
    width: label.width + 6, height: label.height + 6 };
}

function placeLabel(text: string, candidates: Point[], occupied: Rect[], multiplicity = false): UmlEdgeLabel {
  const width = Math.max(24, text.length * (multiplicity ? 9 : 7) + 16);
  const height = multiplicity ? 26 : 20;
  for (const candidate of candidates) {
    const label = { ...candidate, width, height };
    const rect = labelBounds(label);
    if (occupied.some(obstacle => overlaps(rect, obstacle))) continue;
    occupied.push(rect);
    return label;
  }
  // Very dense diagrams still need a finite, collision-free label position.
  const right = Math.max(...occupied.map(rect => rect.x + rect.width), 0);
  const label = { x: right + width / 2 + 8, y: candidates[0].y, width, height };
  occupied.push(labelBounds(label));
  return label;
}

function nameCandidates(points: Point[]): Point[] {
  const candidates: Point[] = [];
  const sorted = segments(points).sort((a, b) => b.length - a.length);
  for (let lane = 1; lane <= 12; lane++) {
    for (const { a, b, length } of sorted) {
      const nx = -(b.y - a.y) / length;
      const ny = (b.x - a.x) / length;
      for (const t of [0.5, 0.3, 0.7]) {
        for (const side of [1, -1]) {
          candidates.push({ x: a.x + (b.x - a.x) * t + nx * lane * 24 * side,
            y: a.y + (b.y - a.y) * t + ny * lane * 24 * side });
        }
      }
    }
  }
  return candidates;
}

function multiplicityCandidates(points: Point[], atEnd: boolean): Point[] {
  const ordered = atEnd ? [...points].reverse() : points;
  const first = segments(ordered)[0];
  if (!first) return [ordered[0]];
  const ux = (first.b.x - first.a.x) / first.length;
  const uy = (first.b.y - first.a.y) / first.length;
  const candidates: Point[] = [];
  for (let lane = 1; lane <= 10; lane++) {
    for (const along of [30, 54, 78, 102]) {
      for (const side of [1, -1]) {
        candidates.push({ x: first.a.x + ux * along - uy * lane * 24 * side,
          y: first.a.y + uy * along + ux * lane * 24 * side });
      }
    }
  }
  return candidates;
}

/** Shared by the canvas, labels, and EReference reaction connection points. */
export function layoutExpandedUmlEdges(nodes: Node[], edges: Edge[]): Map<string, ExpandedUmlEdgeLayout> {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const classes = nodes.filter(node => node.type === 'eobject' && !node.hidden);
  const rects = new Map<string, Rect>();
  for (const node of classes) {
    const rect = nodeWorldRect(node, byId);
    if (rect) rects.set(node.id, rect);
  }
  const expanded = edges.filter(edge => edge.type === 'uml' && edge.data?.expandedIntraModel && !edge.hidden)
    .slice().sort((a, b) => a.id.localeCompare(b.id));
  const pairKey = (edge: Edge) => JSON.stringify([edge.source, edge.target].sort());
  const pairs = new Map<string, Edge[]>();
  for (const edge of expanded) {
    const key = pairKey(edge);
    pairs.set(key, [...(pairs.get(key) ?? []), edge]);
  }
  const layouts = new Map<string, ExpandedUmlEdgeLayout>();
  const placed: Point[][] = [];
  for (const edge of expanded) {
    const source = rects.get(edge.source);
    const target = rects.get(edge.target);
    if (!source || !target) continue;
    const obstacles = [...rects].filter(([id]) => id !== edge.source && id !== edge.target).map(([, rect]) => rect);
    const pair = pairs.get(pairKey(edge))!;
    const index = pair.indexOf(edge);
    let points = chord(source, target);
    if (edge.source === edge.target) {
      const lane = 60 + index * 40;
      points = [
        { x: source.x + source.width, y: source.y + source.height / 2 },
        { x: source.x + source.width + lane, y: source.y + source.height / 2 },
        { x: source.x + source.width + lane, y: source.y - lane },
        { x: source.x + source.width / 2, y: source.y - lane },
        { x: source.x + source.width / 2, y: source.y },
      ];
    } else if (pair.length > 1 || obstacles.some(rect => umlSegmentHitsRect(points[0], points[1], rect))) {
      const input = { source, target, obstacles, existing: placed,
        sourcePortT: (index + 1) / (pair.length + 1),
        targetPortT: (index + 1) / (pair.length + 1),
      };
      points = routeOrthogonalAStar(input).points;
      // Large models coarsen the routing grid. Verify the resulting segments
      // before accepting a shortcut past a narrow class or an endpoint.
      if (segments(points).some(({ a, b }) => [source, target, ...obstacles]
        .some(rect => umlSegmentHitsRect(a, b, rect)))) {
        points = routeAroundClassRects(points[0], points[points.length - 1],
          [source, target, ...obstacles]) ?? points;
      }
    }
    layouts.set(edge.id, { points, midpoint: midpoint(points) });
    placed.push(points);
  }
  const occupied = [...rects.values()];
  // Association ghosts are interactive, so keep text clear of them too.
  for (const edge of expanded) {
    const layout = layouts.get(edge.id);
    if (layout && edge.data?.relationshipType !== 'inheritance') {
      occupied.push({ x: layout.midpoint.x - 10, y: layout.midpoint.y - 10, width: 20, height: 20 });
    }
  }
  for (const edge of expanded) {
    const layout = layouts.get(edge.id);
    if (!layout) continue;
    for (const key of ['sourceMultiplicity', 'targetMultiplicity'] as const) {
      const text = edge.data?.[key];
      if (text !== undefined && text !== null && text !== '') {
        layout[key] = placeLabel(String(text), multiplicityCandidates(layout.points, key === 'targetMultiplicity'), occupied, true);
      }
    }
    if (edge.data?.label) {
      layout.name = placeLabel(String(edge.data.label), nameCandidates(layout.points), occupied);
    }
  }
  return layouts;
}
