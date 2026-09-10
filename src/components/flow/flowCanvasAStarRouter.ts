import type { Edge, Node } from 'reactflow';
import {
  EOBJECT_ATTR_ROW_HEIGHT,
  EOBJECT_DEFAULT_WIDTH,
  EOBJECT_HEADER_HEIGHT,
  GHOST_NODE_SIZE,
  isAttributeHandle,
  reactionHandleAnchor,
  reactionRowRect,
} from '../../utils/reactionEdgeGeometry';
import { ECORE_FILE_BOX_SIZE } from './flowCanvasConstants';
import type { HandlePosition } from './flowCanvasTypes';

export const ROUTING_CELL = 20;
export const BOX_PADDING = 4;

const COST_MOVE = 1;
const COST_TURN = 8;
const COST_NEAR_BOX = 1;
const COST_NEAR_CONNECTION = 10;
const COST_CROSS_CONNECTION = 1000;
const COST_OFF_FACING = 24;
const PORTS_PER_SIDE = 1;
const MAX_AXIS_CELLS = 72;
const MARGIN = 80;
const ROUTABLE_TYPES = new Set(['ecoreFile', 'eobject', 'ghost']);

export type Side = HandlePosition;
export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }

export interface RoutedPath {
  sourceHandle: Side;
  targetHandle: Side;
  points: Point[];
}

const SIDES: Side[] = ['top', 'bottom', 'left', 'right'];
const DIRS: Point[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

export function ecoreFileRect(node: Node): Rect {
  return nodeWorldRect(node) ?? {
    x: node.position.x,
    y: node.position.y,
    width: ECORE_FILE_BOX_SIZE.width,
    height: ECORE_FILE_BOX_SIZE.height,
  };
}

function nodeWorldPosition(node: Node, byId?: Map<string, Node>): Point {
  // Use `position`, not `positionAbsolute`. Bounding-box drags update children
  // via position changes and leave a stale absolute copy on the node.
  let x = node.position.x;
  let y = node.position.y;
  let parentId = node.parentId ?? (node as Node & { parentNode?: string }).parentNode;
  while (parentId && byId) {
    const parent = byId.get(parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId ?? (parent as Node & { parentNode?: string }).parentNode;
  }
  return { x, y };
}

function defaultNodeSize(node: Node): { width: number; height: number } {
  if (node.type === 'ecoreFile') return { ...ECORE_FILE_BOX_SIZE };
  if (node.type === 'ghost') return { width: GHOST_NODE_SIZE, height: GHOST_NODE_SIZE };
  const attrs = Array.isArray(node.data?.attributes) ? node.data.attributes.length : 0;
  return {
    width: EOBJECT_DEFAULT_WIDTH,
    height: EOBJECT_HEADER_HEIGHT + attrs * EOBJECT_ATTR_ROW_HEIGHT + 4,
  };
}

export function isRoutableNode(node: Node): boolean {
  return !node.hidden && ROUTABLE_TYPES.has(node.type ?? '');
}

/** Flow-space rectangle for an ecore card, class, or ghost. */
export function nodeWorldRect(node: Node, byId?: Map<string, Node>): Rect | null {
  if (node.hidden) return null;
  const size = defaultNodeSize(node);
  const pos = nodeWorldPosition(node, byId);
  return {
    x: pos.x,
    y: pos.y,
    width: typeof node.width === 'number' && node.width > 0 ? node.width : size.width,
    height: typeof node.height === 'number' && node.height > 0 ? node.height : size.height,
  };
}

export function inferHandleSide(handle?: string | null): Side | undefined {
  if (!handle) return undefined;
  if (handle.startsWith('reaction-source') || handle.includes('right')) return 'right';
  if (handle.startsWith('reaction-target') || handle.includes('left')) return 'left';
  if (handle.includes('top')) return 'top';
  if (handle.includes('bottom')) return 'bottom';
  return undefined;
}

export interface ReactionEndpoint {
  rect: Rect;
  lockSide?: Side;
  portT?: number;
  anchor?: Point;
  pin: boolean;
}

/** Attribute reactions pin to the field handle; class/ghost reactions use the box. */
export function buildReactionEndpoint(
  node: Node,
  handle: string | null | undefined,
  role: 'source' | 'target',
  byId?: Map<string, Node>,
): ReactionEndpoint | null {
  const rect = nodeWorldRect(node, byId);
  if (!rect) return null;
  if (node.type === 'ghost' || !isAttributeHandle(handle)) {
    return { rect, pin: false };
  }
  const bounds = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    attributes: node.data?.attributes,
  };
  const row = reactionRowRect(bounds, handle);
  const lockSide = inferHandleSide(handle) ?? (role === 'source' ? 'right' : 'left');
  const portT = rect.height > 0
    ? (row.y + row.height / 2 - rect.y) / rect.height
    : 0.5;
  return {
    rect,
    lockSide,
    portT,
    anchor: reactionHandleAnchor(bounds, handle, role),
    pin: true,
  };
}

export function inflateRect(rect: Rect, pad: number): Rect {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

export function pointInRect(p: Point, rect: Rect, inset = 0.75): boolean {
  return (
    p.x > rect.x + inset
    && p.x < rect.x + rect.width - inset
    && p.y > rect.y + inset
    && p.y < rect.y + rect.height - inset
  );
}

export function polylinePathD(points: Point[]): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
}

export function handleAnchor(rect: Rect, side: Side, t = 0.5): Point {
  const clamped = Math.min(1, Math.max(0, t));
  switch (side) {
    case 'top':
      return { x: rect.x + rect.width * clamped, y: rect.y };
    case 'bottom':
      return { x: rect.x + rect.width * clamped, y: rect.y + rect.height };
    case 'left':
      return { x: rect.x, y: rect.y + rect.height * clamped };
    case 'right':
      return { x: rect.x + rect.width, y: rect.y + rect.height * clamped };
  }
}

export function pickSideFromPoint(rect: Rect, point: Point): Side {
  const toLeft = rect.x - point.x;
  const toRight = point.x - (rect.x + rect.width);
  const toTop = rect.y - point.y;
  const toBottom = point.y - (rect.y + rect.height);
  const outsideX = Math.max(toLeft, toRight);
  const outsideY = Math.max(toTop, toBottom);
  if (outsideX > 0 || outsideY > 0) {
    if (outsideX >= outsideY) return toRight > toLeft ? 'right' : 'left';
    return toBottom > toTop ? 'bottom' : 'top';
  }
  const cx = point.x - (rect.x + rect.width / 2);
  const cy = point.y - (rect.y + rect.height / 2);
  if (Math.abs(cx) >= Math.abs(cy)) return cx >= 0 ? 'right' : 'left';
  return cy >= 0 ? 'bottom' : 'top';
}

export function segmentCrossesRect(a: Point, b: Point, rect: Rect): boolean {
  const steps = 6;
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    if (pointInRect({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, rect)) {
      return true;
    }
  }
  return false;
}

export function polylineHitsRects(points: Point[], rects: Rect[]): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    if (rects.some(rect => segmentCrossesRect(points[i], points[i + 1], rect))) return true;
  }
  return false;
}

interface Port {
  cell: { i: number; j: number };
  side: Side;
  t: number;
  dir: number;
}

interface Grid {
  cell: number;
  originX: number;
  originY: number;
  cols: number;
  rows: number;
  blocked: Uint8Array;
  nearBox: Uint8Array;
  nearConn: Uint8Array;
  crossConn: Uint8Array;
}

function cellIndex(grid: Grid, i: number, j: number): number {
  return j * grid.cols + i;
}

function inBounds(grid: Grid, i: number, j: number): boolean {
  return i >= 0 && j >= 0 && i < grid.cols && j < grid.rows;
}

function toCell(grid: Grid, x: number, y: number): { i: number; j: number } {
  return {
    i: Math.max(0, Math.min(grid.cols - 1, Math.floor((x - grid.originX) / grid.cell))),
    j: Math.max(0, Math.min(grid.rows - 1, Math.floor((y - grid.originY) / grid.cell))),
  };
}

function toWorld(grid: Grid, i: number, j: number): Point {
  return {
    x: grid.originX + (i + 0.5) * grid.cell,
    y: grid.originY + (j + 0.5) * grid.cell,
  };
}

function chooseCellSize(width: number, height: number): number {
  let cell = ROUTING_CELL;
  while (width / cell > MAX_AXIS_CELLS || height / cell > MAX_AXIS_CELLS) {
    cell += 4;
  }
  return cell;
}

function worldBounds(rects: Rect[], paths: Point[][], extra: Point[]): Rect {
  const pts = [
    ...rects.flatMap(r => [
      { x: r.x, y: r.y },
      { x: r.x + r.width, y: r.y + r.height },
    ]),
    ...paths.flat(),
    ...extra,
  ];
  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);
  const minX = Math.min(...xs) - MARGIN;
  const minY = Math.min(...ys) - MARGIN;
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) + MARGIN - minX,
    height: Math.max(...ys) + MARGIN - minY,
  };
}

function buildGrid(boxes: Rect[], existing: Point[][], extra: Point[]): Grid {
  const bounds = worldBounds(boxes, existing, extra);
  const cell = chooseCellSize(bounds.width, bounds.height);
  const cols = Math.max(4, Math.ceil(bounds.width / cell));
  const rows = Math.max(4, Math.ceil(bounds.height / cell));
  const size = cols * rows;
  const grid: Grid = {
    cell,
    originX: bounds.x,
    originY: bounds.y,
    cols,
    rows,
    blocked: new Uint8Array(size),
    nearBox: new Uint8Array(size),
    nearConn: new Uint8Array(size),
    crossConn: new Uint8Array(size),
  };

  const expanded = boxes.map(box => inflateRect(box, BOX_PADDING));
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const center = toWorld(grid, i, j);
      const idx = cellIndex(grid, i, j);
      if (expanded.some(rect => pointInRect(center, rect))) {
        grid.blocked[idx] = 1;
      }
    }
  }

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const idx = cellIndex(grid, i, j);
      if (grid.blocked[idx]) continue;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di;
        const nj = j + dj;
        if (inBounds(grid, ni, nj) && grid.blocked[cellIndex(grid, ni, nj)]) {
          grid.nearBox[idx] = 1;
          break;
        }
      }
    }
  }

  markConnectionCosts(grid, existing);
  return grid;
}

function markConnectionCosts(grid: Grid, existing: Point[][]): void {
  const step = grid.cell / 2;
  for (const path of existing) {
    for (let s = 0; s < path.length - 1; s++) {
      const a = path[s];
      const b = path[s + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const samples = Math.max(1, Math.ceil(len / step));
      for (let n = 0; n <= samples; n++) {
        const t = n / samples;
        const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        const { i, j } = toCell(grid, p.x, p.y);
        if (!inBounds(grid, i, j)) continue;
        grid.crossConn[cellIndex(grid, i, j)] = 1;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const ni = i + di;
            const nj = j + dj;
            if (!inBounds(grid, ni, nj)) continue;
            const nidx = cellIndex(grid, ni, nj);
            if (!grid.crossConn[nidx]) grid.nearConn[nidx] = 1;
          }
        }
      }
    }
  }
}

function sideOutwardDir(side: Side): number {
  switch (side) {
    case 'right': return 0;
    case 'bottom': return 1;
    case 'left': return 2;
    case 'top': return 3;
  }
}

function portsOnBox(grid: Grid, box: Rect, sides: Side[], portT = 0.5): Port[] {
  const ports: Port[] = [];
  for (const side of sides) {
    for (let k = 0; k < PORTS_PER_SIDE; k++) {
      const t = portT;
      const onBox = handleAnchor(box, side, t);
      const dir = sideOutwardDir(side);
      const step = DIRS[dir];
      const outside = {
        x: onBox.x + step.x * grid.cell,
        y: onBox.y + step.y * grid.cell,
      };
      const cell = toCell(grid, outside.x, outside.y);
      let i = cell.i;
      let j = cell.j;
      for (let n = 0; n < 6 && inBounds(grid, i, j) && grid.blocked[cellIndex(grid, i, j)]; n++) {
        i += step.x;
        j += step.y;
      }
      if (!inBounds(grid, i, j) || grid.blocked[cellIndex(grid, i, j)]) continue;
      ports.push({ cell: { i, j }, side, t, dir });
    }
  }
  return ports;
}

class MinHeap {
  private keys: number[] = [];
  private values: number[] = [];

  get size(): number {
    return this.keys.length;
  }

  push(key: number, value: number): void {
    this.keys.push(key);
    this.values.push(value);
    this.bubbleUp(this.keys.length - 1);
  }

  pop(): number | undefined {
    if (this.keys.length === 0) return undefined;
    const top = this.values[0];
    const lastK = this.keys.pop()!;
    const lastV = this.values.pop()!;
    if (this.keys.length > 0) {
      this.keys[0] = lastK;
      this.values[0] = lastV;
      this.sink(0);
    }
    return top;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.keys[parent] <= this.keys[index]) break;
      this.swap(parent, index);
      index = parent;
    }
  }

  private sink(index: number): void {
    const n = this.keys.length;
    while (true) {
      let smallest = index;
      const left = index * 2 + 1;
      const right = left + 1;
      if (left < n && this.keys[left] < this.keys[smallest]) smallest = left;
      if (right < n && this.keys[right] < this.keys[smallest]) smallest = right;
      if (smallest === index) break;
      this.swap(index, smallest);
      index = smallest;
    }
  }

  private swap(a: number, b: number): void {
    const tk = this.keys[a];
    this.keys[a] = this.keys[b];
    this.keys[b] = tk;
    const tv = this.values[a];
    this.values[a] = this.values[b];
    this.values[b] = tv;
  }
}

function stateKey(i: number, j: number, dir: number, cols: number, rows: number): number {
  return dir * cols * rows + j * cols + i;
}

function unpackState(key: number, cols: number, rows: number): { i: number; j: number; dir: number } {
  const area = cols * rows;
  const dir = Math.floor(key / area);
  const rem = key - dir * area;
  return { dir, i: rem % cols, j: Math.floor(rem / cols) };
}

function manhattan(a: { i: number; j: number }, goals: Array<{ i: number; j: number }>): number {
  let best = Infinity;
  for (const g of goals) {
    const d = Math.abs(a.i - g.i) + Math.abs(a.j - g.j);
    if (d < best) best = d;
  }
  return best === Infinity ? 0 : best;
}

function stepCost(grid: Grid, ni: number, nj: number, turned: boolean): number {
  const idx = cellIndex(grid, ni, nj);
  let cost = COST_MOVE;
  if (turned) cost += COST_TURN;
  if (grid.nearBox[idx]) cost += COST_NEAR_BOX;
  if (grid.nearConn[idx]) cost += COST_NEAR_CONNECTION;
  if (grid.crossConn[idx]) cost += COST_CROSS_CONNECTION;
  return cost;
}

/** Face-to-face gaps: positive when `target` sits fully on that side of `source`. */
function boxGaps(source: Rect, target: Rect) {
  return {
    east: target.x - (source.x + source.width),
    west: source.x - (target.x + target.width),
    south: target.y - (source.y + source.height),
    north: source.y - (target.y + target.height),
  };
}

/**
 * One midpoint per side. When the boxes are diagonal, use the closer
 * face-to-face gap so a box below-and-left attaches on its top, not its right.
 */
export function facingSides(source: Rect, target: Rect): { source: Side; target: Side } {
  const g = boxGaps(source, target);
  const horiz = g.east > 0 ? g.east : (g.west > 0 ? g.west : -1);
  const vert = g.south > 0 ? g.south : (g.north > 0 ? g.north : -1);
  const preferVertical = vert >= 0 && (horiz < 0 || vert <= horiz);

  if (preferVertical) {
    return g.south >= 0 && (g.north < 0 || g.south >= g.north)
      ? { source: 'bottom', target: 'top' }
      : { source: 'top', target: 'bottom' };
  }
  if (horiz >= 0) {
    return g.east >= 0 && (g.west < 0 || g.east >= g.west)
      ? { source: 'right', target: 'left' }
      : { source: 'left', target: 'right' };
  }

  const dx = (target.x + target.width / 2) - (source.x + source.width / 2);
  const dy = (target.y + target.height / 2) - (source.y + source.height / 2);
  if (Math.abs(dy) > Math.abs(dx)) {
    return dy > 0
      ? { source: 'bottom', target: 'top' }
      : { source: 'top', target: 'bottom' };
  }
  return dx >= 0
    ? { source: 'right', target: 'left' }
    : { source: 'left', target: 'right' };
}

function runAStar(
  grid: Grid,
  starts: Port[],
  goals: Port[],
  preferred?: { source?: Side; target?: Side },
): { cells: Array<{ i: number; j: number }>; start: Port; goal: Port } | null {
  if (starts.length === 0 || goals.length === 0) return null;
  const goalSet = new Map<string, Port>();
  for (const g of goals) goalSet.set(`${g.cell.i},${g.cell.j}`, g);
  const goalCells = goals.map(g => g.cell);

  const open = new MinHeap();
  const gScore = new Map<number, number>();
  const came = new Map<number, number>();
  const startPortOf = new Map<number, Port>();

  for (const port of starts) {
    const key = stateKey(port.cell.i, port.cell.j, port.dir, grid.cols, grid.rows);
    const extra = preferred?.source && port.side !== preferred.source ? COST_OFF_FACING : 0;
    gScore.set(key, extra);
    startPortOf.set(key, port);
    open.push(extra + manhattan(port.cell, goalCells) * COST_MOVE, key);
  }

  const seen = new Set<number>();
  while (open.size > 0) {
    const current = open.pop();
    if (current === undefined) break;
    if (seen.has(current)) continue;
    seen.add(current);

    const cur = unpackState(current, grid.cols, grid.rows);
    const hit = goalSet.get(`${cur.i},${cur.j}`);
    if (hit) {
      const cells: Array<{ i: number; j: number }> = [];
      let walk: number | undefined = current;
      let startPort = starts[0];
      while (walk !== undefined) {
        const node = unpackState(walk, grid.cols, grid.rows);
        cells.push({ i: node.i, j: node.j });
        const prev = came.get(walk);
        if (prev === undefined) {
          startPort = startPortOf.get(walk) ?? startPort;
        }
        walk = prev;
      }
      cells.reverse();
      return { cells, start: startPort, goal: hit };
    }

    const currentG = gScore.get(current) ?? Infinity;
    for (let nd = 0; nd < 4; nd++) {
      const ni = cur.i + DIRS[nd].x;
      const nj = cur.j + DIRS[nd].y;
      if (!inBounds(grid, ni, nj) || grid.blocked[cellIndex(grid, ni, nj)]) continue;
      const next = stateKey(ni, nj, nd, grid.cols, grid.rows);
      const hitNext = goalSet.get(`${ni},${nj}`);
      const sidePenalty = hitNext && preferred?.target && hitNext.side !== preferred.target
        ? COST_OFF_FACING
        : 0;
      const tentative = currentG + stepCost(grid, ni, nj, nd !== cur.dir) + sidePenalty;
      if (tentative >= (gScore.get(next) ?? Infinity)) continue;
      came.set(next, current);
      gScore.set(next, tentative);
      open.push(tentative + manhattan({ i: ni, j: nj }, goalCells) * COST_MOVE, next);
    }
  }
  return null;
}

function simplifyWorld(points: Point[]): Point[] {
  if (points.length < 3) return points;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1];
    const cur = points[i];
    const next = points[i + 1];
    const collinear = (
      (Math.abs(prev.x - cur.x) < 0.5 && Math.abs(cur.x - next.x) < 0.5)
      || (Math.abs(prev.y - cur.y) < 0.5 && Math.abs(cur.y - next.y) < 0.5)
    );
    if (!collinear) out.push(cur);
  }
  out.push(points[points.length - 1]);
  return out;
}

function fallbackPath(
  source: Rect,
  target: Rect,
  lockSource?: Side,
  lockTarget?: Side,
  anchors?: { start?: Point; end?: Point },
): RoutedPath {
  const sc = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const tc = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const sourceHandle = lockSource ?? (Math.abs(tc.x - sc.x) >= Math.abs(tc.y - sc.y)
    ? (tc.x >= sc.x ? 'right' : 'left')
    : (tc.y >= sc.y ? 'bottom' : 'top'));
  const targetHandle = lockTarget ?? (sourceHandle === 'right' ? 'left'
    : sourceHandle === 'left' ? 'right'
      : sourceHandle === 'bottom' ? 'top' : 'bottom');
  const a = anchors?.start ?? handleAnchor(source, sourceHandle);
  const b = anchors?.end ?? handleAnchor(target, targetHandle);
  return {
    sourceHandle,
    targetHandle,
    points: midwayOrthogonal(a, b, targetHandle),
  };
}

function orthogonalLeave(from: Point, to: Point, side: Side): Point[] {
  if (side === 'left' || side === 'right') {
    if (Math.abs(from.y - to.y) < 0.5) return [from, to];
    return [from, { x: to.x, y: from.y }, to];
  }
  if (Math.abs(from.x - to.x) < 0.5) return [from, to];
  return [from, { x: from.x, y: to.y }, to];
}

function orthogonalArrive(from: Point, to: Point, side: Side): Point[] {
  if (side === 'top' || side === 'bottom') {
    if (Math.abs(from.x - to.x) < 0.5) return [from, to];
    return [from, { x: to.x, y: from.y }, to];
  }
  if (Math.abs(from.y - to.y) < 0.5) return [from, to];
  return [from, { x: to.x, y: from.y }, to];
}

/** Elbows sit in the gap between the boxes, not against the destination. */
function midwayOrthogonal(from: Point, to: Point, targetSide: Side): Point[] {
  if (Math.abs(from.x - to.x) < 0.5 && Math.abs(from.y - to.y) < 0.5) return [from, to];
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  if (targetSide === 'left' || targetSide === 'right') {
    if (Math.abs(from.y - to.y) < 0.5) return [from, to];
    return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
  }
  if (Math.abs(from.x - to.x) < 0.5) return [from, to];
  return [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to];
}

function lastSegmentMatchesSide(points: Point[], side: Side): boolean {
  if (points.length < 2) return false;
  const from = points[points.length - 2];
  const to = points[points.length - 1];
  if (side === 'top') return Math.abs(from.x - to.x) < 1 && from.y < to.y;
  if (side === 'bottom') return Math.abs(from.x - to.x) < 1 && from.y > to.y;
  if (side === 'left') return Math.abs(from.y - to.y) < 1 && from.x < to.x;
  return Math.abs(from.y - to.y) < 1 && from.x > to.x;
}

function trimPortStubs(points: Point[], start: Point, end: Point, cell: number): Point[] {
  const limit = cell * 2;
  const out = points.slice();
  while (out.length > 0 && Math.hypot(out[0].x - start.x, out[0].y - start.y) < limit) {
    out.shift();
  }
  while (out.length > 0 && Math.hypot(out[out.length - 1].x - end.x, out[out.length - 1].y - end.y) < limit) {
    out.pop();
  }
  return out;
}

function pathFromSearch(
  grid: Grid,
  source: Rect,
  target: Rect,
  search: { cells: Array<{ i: number; j: number }>; start: Port; goal: Port },
  anchors?: { start?: Point; end?: Point },
): RoutedPath {
  const gridPoints = simplifyWorld(search.cells.map(c => toWorld(grid, c.i, c.j)));
  const startAnchor = anchors?.start ?? handleAnchor(source, search.start.side, search.start.t);
  const endAnchor = anchors?.end ?? handleAnchor(target, search.goal.side, search.goal.t);
  const mid = trimPortStubs(gridPoints, startAnchor, endAnchor, grid.cell);
  let points: Point[];
  if (mid.length === 0) {
    points = midwayOrthogonal(startAnchor, endAnchor, search.goal.side);
  } else {
    const head = orthogonalLeave(startAnchor, mid[0], search.start.side);
    const body = head[head.length - 1].x === mid[0].x && head[head.length - 1].y === mid[0].y
      ? [...head, ...mid.slice(1)]
      : [...head, ...mid];
    const tail = orthogonalArrive(body[body.length - 1], endAnchor, search.goal.side);
    points = [...body, ...tail.slice(1)];
  }
  return {
    sourceHandle: search.start.side,
    targetHandle: search.goal.side,
    points: simplifyWorld(points),
  };
}

export interface RouteInput {
  source: Rect;
  target: Rect;
  obstacles?: Rect[];
  existing?: Point[][];
  lockSourceHandle?: Side;
  lockTargetHandle?: Side;
  sourcePortT?: number;
  targetPortT?: number;
  sourceAnchor?: Point;
  targetAnchor?: Point;
  cursor?: Point;
  via?: Point;
}

export function routeOrthogonalAStar(input: RouteInput): RoutedPath {
  const obstacles = input.obstacles ?? [];
  const existing = input.existing ?? [];
  const boxes = [input.source, input.target, ...obstacles];
  const extras = [input.cursor, input.via].filter((p): p is Point => Boolean(p));
  const grid = buildGrid(boxes, existing, extras);

  const facing = facingSides(input.source, input.target);
  const sourceSides = input.lockSourceHandle ? [input.lockSourceHandle] : SIDES;
  const cursorSide = input.cursor ? pickSideFromPoint(input.target, input.cursor) : undefined;
  const targetSides = input.lockTargetHandle
    ? [input.lockTargetHandle]
    : (cursorSide ? [cursorSide] : SIDES);

  const anchors = { start: input.sourceAnchor, end: input.targetAnchor };
  const starts = portsOnBox(grid, input.source, sourceSides, input.sourcePortT);
  const goals = portsOnBox(grid, input.target, targetSides, input.targetPortT);
  if (starts.length === 0 || goals.length === 0) {
    return fallbackPath(
      input.source,
      input.target,
      input.lockSourceHandle,
      input.lockTargetHandle ?? cursorSide,
      anchors,
    );
  }

  const preferred = {
    source: input.lockSourceHandle ?? facing.source,
    target: input.lockTargetHandle ?? cursorSide ?? facing.target,
  };

  if (input.via) {
    const viaCell = toCell(grid, input.via.x, input.via.y);
    const viaPort: Port = {
      cell: inBounds(grid, viaCell.i, viaCell.j) && !grid.blocked[cellIndex(grid, viaCell.i, viaCell.j)]
        ? viaCell
        : starts[0].cell,
      side: 'right',
      t: 0.5,
      dir: 0,
    };
    const first = runAStar(grid, starts, [viaPort], { source: preferred.source });
    const second = runAStar(grid, [{ ...viaPort, dir: 0 }, { ...viaPort, dir: 1 }, { ...viaPort, dir: 2 }, { ...viaPort, dir: 3 }], goals, { target: preferred.target });
    if (first && second) {
      const combined = {
        cells: [...first.cells, ...second.cells.slice(1)],
        start: first.start,
        goal: second.goal,
      };
      return simplifyIfClear(
        pathFromSearch(grid, input.source, input.target, combined, anchors),
        input.source,
        input.target,
        obstacles,
      );
    }
  }

  const search = runAStar(grid, starts, goals, preferred);
  if (!search) {
    return fallbackPath(
      input.source,
      input.target,
      input.lockSourceHandle,
      cursorSide ?? input.lockTargetHandle,
      anchors,
    );
  }
  return simplifyIfClear(
    pathFromSearch(grid, input.source, input.target, search, anchors),
    input.source,
    input.target,
    obstacles,
  );
}

function simplifyIfClear(
  route: RoutedPath,
  source: Rect,
  target: Rect,
  obstacles: Rect[],
): RoutedPath {
  const start = route.points[0];
  const end = route.points[route.points.length - 1];
  if (!start || !end) return route;
  const blocked = [source, target, ...obstacles];
  const midway = simplifyWorld(midwayOrthogonal(start, end, route.targetHandle));
  if (
    lastSegmentMatchesSide(midway, route.targetHandle)
    && !polylineHitsRects(midway, blocked)
  ) {
    return { ...route, points: midway };
  }
  const candidates = [
    orthogonalArrive(start, end, route.targetHandle),
    orthogonalLeave(start, end, route.sourceHandle),
  ];
  const score = (points: Point[]) => (
    points.length + (lastSegmentMatchesSide(points, route.targetHandle) ? 0 : 10)
  );
  let best = route.points;
  let bestScore = score(best);
  for (const points of candidates) {
    const clean = simplifyWorld(points);
    if (polylineHitsRects(clean, blocked)) continue;
    const nextScore = score(clean);
    if (nextScore < bestScore) {
      best = clean;
      bestScore = nextScore;
    }
  }
  return best === route.points ? route : { ...route, points: best };
}

export function routeToCursorAStar(
  source: Rect,
  sourceHandle: Side,
  cursor: Point,
  obstacles: Rect[],
  existing: Point[][] = [],
): Point[] {
  const target: Rect = { x: cursor.x - 1, y: cursor.y - 1, width: 2, height: 2 };
  const points = [...routeOrthogonalAStar({
    source,
    target,
    obstacles,
    existing,
    lockSourceHandle: sourceHandle,
    cursor,
  }).points];
  if (points.length === 0) return [handleAnchor(source, sourceHandle), cursor];
  points[points.length - 1] = cursor;
  if (points.length >= 2) {
    const prev = points[points.length - 2];
    if (Math.abs(prev.x - cursor.x) >= 1 && Math.abs(prev.y - cursor.y) >= 1) {
      points.splice(points.length - 1, 0, { x: cursor.x, y: prev.y });
    }
  }
  return points;
}

export function routeAllReactionEdges(nodes: Node[], edges: Edge[]): Map<string, RoutedPath> {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const routable = nodes.filter(isRoutableNode);
  const rectById = new Map<string, Rect>();
  for (const node of routable) {
    const rect = nodeWorldRect(node, byId);
    if (rect) rectById.set(node.id, rect);
  }
  const reactionEdges = edges
    .filter(e => e.type === 'reactions' || e.type === 'fine-granular-reaction')
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));

  const routes = new Map<string, RoutedPath>();
  const placed: Point[][] = [];

  for (const edge of reactionEdges) {
    const sourceNode = byId.get(edge.source);
    const targetNode = byId.get(edge.target);
    if (!sourceNode || !targetNode) continue;
    const sourceEp = edge.type === 'fine-granular-reaction'
      ? buildReactionEndpoint(sourceNode, edge.sourceHandle, 'source', byId)
      : null;
    const targetEp = edge.type === 'fine-granular-reaction'
      ? buildReactionEndpoint(targetNode, edge.targetHandle, 'target', byId)
      : null;
    const source = sourceEp?.rect ?? rectById.get(edge.source);
    const target = targetEp?.rect ?? rectById.get(edge.target);
    if (!source || !target) continue;
    const obstacles = routable
      .filter(n => n.id !== edge.source && n.id !== edge.target)
      .map(n => rectById.get(n.id))
      .filter((rect): rect is Rect => Boolean(rect));
    const route = routeOrthogonalAStar({
      source,
      target,
      obstacles,
      existing: placed,
      via: edge.data?.customControlPoint,
      lockSourceHandle: sourceEp?.pin ? sourceEp.lockSide : undefined,
      lockTargetHandle: targetEp?.pin ? targetEp.lockSide : undefined,
      sourcePortT: sourceEp?.portT,
      targetPortT: targetEp?.portT,
      sourceAnchor: sourceEp?.anchor,
      targetAnchor: targetEp?.anchor,
    });
    routes.set(edge.id, route);
    placed.push(route.points);
  }
  return routes;
}

export function applyAStarReactionHandles(nodes: Node[], edges: Edge[]): Edge[] {
  // Handle choice must ignore a stale via-point: that waypoint is discarded
  // whenever the attachment sides change.
  const forHandles = edges.map(edge => (
    edge.type === 'reactions' && edge.data?.customControlPoint
      ? { ...edge, data: { ...edge.data, customControlPoint: undefined } }
      : edge
  ));
  const routes = routeAllReactionEdges(nodes, forHandles);
  let changed = false;
  const next = edges.map(edge => {
    const route = routes.get(edge.id);
    if (!route || edge.type !== 'reactions') return edge;
    if (edge.sourceHandle === route.sourceHandle && edge.targetHandle === route.targetHandle) {
      return edge;
    }
    changed = true;
    return {
      ...edge,
      sourceHandle: route.sourceHandle,
      targetHandle: route.targetHandle,
      data: {
        ...edge.data,
        customControlPoint: undefined,
      },
    };
  });
  return changed ? next : edges;
}

export function flowToScreenPoints(
  points: Point[],
  viewport: { x: number; y: number; zoom: number },
): Point[] {
  return points.map(p => ({
    x: p.x * viewport.zoom + viewport.x,
    y: p.y * viewport.zoom + viewport.y,
  }));
}
