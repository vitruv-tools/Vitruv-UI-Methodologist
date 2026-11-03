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
const COST_NEAR_CONNECTION = 2;
/** Crossing another link is cheaper than a long detour round the diagram, but overlapping along it is not. */
const COST_CROSS_CONNECTION = 40;
const COST_OFF_FACING = 24;
const PORTS_PER_SIDE = 1;
const MAX_AXIS_CELLS = 72;
const MARGIN = 80;
/** Length of the straight run every link leaves/enters a box with, perpendicular to its side. */
export const STUB_LENGTH = 24;
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

function lastPoint(points: Point[]): Point | undefined {
  return points.at(-1);
}

function secondLastPoint(points: Point[]): Point | undefined {
  return points.at(-2);
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

function emptyGrid(bounds: Rect): Grid {
  const cell = chooseCellSize(bounds.width, bounds.height);
  const cols = Math.max(4, Math.ceil(bounds.width / cell));
  const rows = Math.max(4, Math.ceil(bounds.height / cell));
  const size = cols * rows;
  return {
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
}

function markBlockedCells(grid: Grid, expanded: Rect[]): void {
  for (let j = 0; j < grid.rows; j++) {
    for (let i = 0; i < grid.cols; i++) {
      const center = toWorld(grid, i, j);
      if (expanded.some(rect => pointInRect(center, rect))) {
        grid.blocked[cellIndex(grid, i, j)] = 1;
      }
    }
  }
}

function hasBlockedNeighbor(grid: Grid, i: number, j: number): boolean {
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ni = i + di;
    const nj = j + dj;
    if (inBounds(grid, ni, nj) && grid.blocked[cellIndex(grid, ni, nj)]) return true;
  }
  return false;
}

function markNearBoxCells(grid: Grid): void {
  for (let j = 0; j < grid.rows; j++) {
    for (let i = 0; i < grid.cols; i++) {
      const idx = cellIndex(grid, i, j);
      if (grid.blocked[idx]) continue;
      if (hasBlockedNeighbor(grid, i, j)) grid.nearBox[idx] = 1;
    }
  }
}

function buildGrid(boxes: Rect[], existing: Point[][], extra: Point[]): Grid {
  const grid = emptyGrid(worldBounds(boxes, existing, extra));
  markBlockedCells(grid, boxes.map(box => inflateRect(box, BOX_PADDING)));
  markNearBoxCells(grid);
  markConnectionCosts(grid, existing);
  return grid;
}

function markNearConnAround(grid: Grid, i: number, j: number): void {
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

function markPathSegment(grid: Grid, a: Point, b: Point, step: number): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const samples = Math.max(1, Math.ceil(len / step));
  for (let n = 0; n <= samples; n++) {
    const t = n / samples;
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const { i, j } = toCell(grid, p.x, p.y);
    if (!inBounds(grid, i, j)) continue;
    grid.crossConn[cellIndex(grid, i, j)] = 1;
    markNearConnAround(grid, i, j);
  }
}

function markConnectionCosts(grid: Grid, existing: Point[][]): void {
  const step = grid.cell / 2;
  for (const path of existing) {
    for (let s = 0; s < path.length - 1; s++) {
      markPathSegment(grid, path[s], path[s + 1], step);
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

function firstOpenCell(
  grid: Grid,
  start: { i: number; j: number },
  step: Point,
): { i: number; j: number } | null {
  let i = start.i;
  let j = start.j;
  for (let n = 0; n < 6; n++) {
    if (!inBounds(grid, i, j)) return null;
    if (!grid.blocked[cellIndex(grid, i, j)]) return { i, j };
    i += step.x;
    j += step.y;
  }
  if (!inBounds(grid, i, j) || grid.blocked[cellIndex(grid, i, j)]) return null;
  return { i, j };
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
      const open = firstOpenCell(grid, toCell(grid, outside.x, outside.y), step);
      if (!open) continue;
      ports.push({ cell: open, side, t, dir });
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
function positiveGap(primary: number, secondary: number): number {
  if (primary > 0) return primary;
  if (secondary > 0) return secondary;
  return -1;
}

function closerVerticalPair(g: ReturnType<typeof boxGaps>): { source: Side; target: Side } {
  if (g.south >= 0 && (g.north < 0 || g.south >= g.north)) {
    return { source: 'bottom', target: 'top' };
  }
  return { source: 'top', target: 'bottom' };
}

function closerHorizontalPair(g: ReturnType<typeof boxGaps>): { source: Side; target: Side } {
  if (g.east >= 0 && (g.west < 0 || g.east >= g.west)) {
    return { source: 'right', target: 'left' };
  }
  return { source: 'left', target: 'right' };
}

function pairFromCenterDelta(source: Rect, target: Rect): { source: Side; target: Side } {
  const dx = (target.x + target.width / 2) - (source.x + source.width / 2);
  const dy = (target.y + target.height / 2) - (source.y + source.height / 2);
  if (Math.abs(dy) > Math.abs(dx)) {
    if (dy > 0) return { source: 'bottom', target: 'top' };
    return { source: 'top', target: 'bottom' };
  }
  if (dx >= 0) return { source: 'right', target: 'left' };
  return { source: 'left', target: 'right' };
}

/** Below this a link cannot fit its two stubs between boxes, so it would squeeze along them. */
const MIN_FACING_GAP = STUB_LENGTH * 2;

export function facingSides(source: Rect, target: Rect): { source: Side; target: Side } {
  const g = boxGaps(source, target);
  const horiz = positiveGap(g.east, g.west);
  const vert = positiveGap(g.south, g.north);
  const horizRoomy = horiz >= MIN_FACING_GAP;
  const vertRoomy = vert >= MIN_FACING_GAP;
  if (vertRoomy && !horizRoomy) return closerVerticalPair(g);
  if (horizRoomy && !vertRoomy) return closerHorizontalPair(g);
  if (vert >= 0 && (horiz < 0 || vert <= horiz)) return closerVerticalPair(g);
  if (horiz >= 0) return closerHorizontalPair(g);
  return pairFromCenterDelta(source, target);
}

interface AStarSearch {
  grid: Grid;
  goals: Port[];
  goalSet: Map<string, Port>;
  goalCells: Array<{ i: number; j: number }>;
  open: MinHeap;
  gScore: Map<number, number>;
  came: Map<number, number>;
  startPortOf: Map<number, Port>;
  preferred?: { source?: Side; target?: Side };
}

function seedStarts(search: AStarSearch, starts: Port[]): void {
  for (const port of starts) {
    const key = stateKey(port.cell.i, port.cell.j, port.dir, search.grid.cols, search.grid.rows);
    const extra = search.preferred?.source && port.side !== search.preferred.source ? COST_OFF_FACING : 0;
    search.gScore.set(key, extra);
    search.startPortOf.set(key, port);
    search.open.push(extra + manhattan(port.cell, search.goalCells) * COST_MOVE, key);
  }
}

function reconstructPath(
  search: AStarSearch,
  current: number,
  starts: Port[],
  hit: Port,
): { cells: Array<{ i: number; j: number }>; start: Port; goal: Port } {
  const cells: Array<{ i: number; j: number }> = [];
  let walk: number | undefined = current;
  let startPort = starts[0];
  while (walk !== undefined) {
    const node = unpackState(walk, search.grid.cols, search.grid.rows);
    cells.push({ i: node.i, j: node.j });
    const prev = search.came.get(walk);
    if (prev === undefined) {
      startPort = search.startPortOf.get(walk) ?? startPort;
    }
    walk = prev;
  }
  cells.reverse();
  return { cells, start: startPort, goal: hit };
}

function neighborPenalty(hitNext: Port | undefined, preferred?: { target?: Side }): number {
  if (hitNext && preferred?.target && hitNext.side !== preferred.target) return COST_OFF_FACING;
  return 0;
}

function expandFromState(search: AStarSearch, current: number): void {
  const cur = unpackState(current, search.grid.cols, search.grid.rows);
  const currentG = search.gScore.get(current) ?? Infinity;
  for (let nd = 0; nd < 4; nd++) {
    const ni = cur.i + DIRS[nd].x;
    const nj = cur.j + DIRS[nd].y;
    if (!inBounds(search.grid, ni, nj) || search.grid.blocked[cellIndex(search.grid, ni, nj)]) continue;
    const next = stateKey(ni, nj, nd, search.grid.cols, search.grid.rows);
    const hitNext = search.goalSet.get(`${ni},${nj}`);
    const tentative = currentG
      + stepCost(search.grid, ni, nj, nd !== cur.dir)
      + neighborPenalty(hitNext, search.preferred);
    if (tentative >= (search.gScore.get(next) ?? Infinity)) continue;
    search.came.set(next, current);
    search.gScore.set(next, tentative);
    search.open.push(tentative + manhattan({ i: ni, j: nj }, search.goalCells) * COST_MOVE, next);
  }
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
  const search: AStarSearch = {
    grid,
    goals,
    goalSet,
    goalCells: goals.map(g => g.cell),
    open: new MinHeap(),
    gScore: new Map<number, number>(),
    came: new Map<number, number>(),
    startPortOf: new Map<number, Port>(),
    preferred,
  };
  seedStarts(search, starts);
  const seen = new Set<number>();
  while (search.open.size > 0) {
    const current = search.open.pop();
    if (current === undefined) break;
    if (seen.has(current)) continue;
    seen.add(current);
    const cur = unpackState(current, grid.cols, grid.rows);
    const hit = goalSet.get(`${cur.i},${cur.j}`);
    if (hit) return reconstructPath(search, current, starts, hit);
    expandFromState(search, current);
  }
  return null;
}

function simplifyWorld(points: Point[]): Point[] {
  if (points.length < 3) return points;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = lastPoint(out);
    if (!prev) break;
    const cur = points[i];
    const next = points[i + 1];
    const collinear = (
      (Math.abs(prev.x - cur.x) < 0.5 && Math.abs(cur.x - next.x) < 0.5)
      || (Math.abs(prev.y - cur.y) < 0.5 && Math.abs(cur.y - next.y) < 0.5)
    );
    if (!collinear) out.push(cur);
  }
  const tip = lastPoint(points);
  if (tip) out.push(tip);
  return out;
}

function sideTowardPoint(from: Point, to: Point): Side {
  if (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)) {
    return to.x >= from.x ? 'right' : 'left';
  }
  return to.y >= from.y ? 'bottom' : 'top';
}

function oppositeSide(side: Side): Side {
  if (side === 'right') return 'left';
  if (side === 'left') return 'right';
  if (side === 'bottom') return 'top';
  return 'bottom';
}

function sideNormal(side: Side): Point {
  switch (side) {
    case 'right': return { x: 1, y: 0 };
    case 'left': return { x: -1, y: 0 };
    case 'top': return { x: 0, y: -1 };
    case 'bottom': return { x: 0, y: 1 };
  }
}

function stubOf(anchor: Point, side: Side): Point {
  const n = sideNormal(side);
  return { x: anchor.x + n.x * STUB_LENGTH, y: anchor.y + n.y * STUB_LENGTH };
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

/** Corner(s) taking a link from just outside its start box to `to`, leaving along the side normal. */
function elbowFromStub(stub: Point, side: Side, to: Point): Point[] {
  if (Math.abs(stub.x - to.x) < 0.5 || Math.abs(stub.y - to.y) < 0.5) return [to];
  const n = sideNormal(side);
  const alongNormal = n.x !== 0 ? (to.x - stub.x) * n.x : (to.y - stub.y) * n.y;
  const normalFirst = n.x !== 0 ? { x: to.x, y: stub.y } : { x: stub.x, y: to.y };
  const perpFirst = n.x !== 0 ? { x: stub.x, y: to.y } : { x: to.x, y: stub.y };
  return [alongNormal > 0.5 ? normalFirst : perpFirst, to];
}

/** Corner(s) taking a link from `from` to just outside its end box, arriving along the side normal. */
function elbowIntoStub(from: Point, stub: Point, side: Side): Point[] {
  if (Math.abs(stub.x - from.x) < 0.5 || Math.abs(stub.y - from.y) < 0.5) return [stub];
  const n = sideNormal(side);
  const alongNormal = n.x !== 0 ? (from.x - stub.x) * n.x : (from.y - stub.y) * n.y;
  const normalLast = n.x !== 0 ? { x: from.x, y: stub.y } : { x: stub.x, y: from.y };
  const perpLast = n.x !== 0 ? { x: stub.x, y: from.y } : { x: from.x, y: stub.y };
  return [alongNormal > 0.5 ? normalLast : perpLast, stub];
}

function dedupePoints(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const prev = lastPoint(out);
    if (!prev || !samePoint(prev, p)) out.push(p);
  }
  return out;
}

/** True when the first/last segments run perpendicular to their box side, away from/into the box. */
export function endsAreOrthogonal(points: Point[], startSide: Side, endSide: Side): boolean {
  if (points.length < 2) return false;
  const sn = sideNormal(startSide);
  const en = sideNormal(endSide);
  const a = points[0];
  const b = points[1];
  const y = points.at(-2);
  const z = points.at(-1);
  if (!y || !z) return false;
  const out = (b.x - a.x) * sn.x + (b.y - a.y) * sn.y;
  const sideways = Math.abs((b.x - a.x) * sn.y) + Math.abs((b.y - a.y) * sn.x);
  const into = (y.x - z.x) * en.x + (y.y - z.y) * en.y;
  const sideways2 = Math.abs((y.x - z.x) * en.y) + Math.abs((y.y - z.y) * en.x);
  return out > 0.5 && sideways < 0.5 && into > 0.5 && sideways2 < 0.5;
}

const JOG_MAX = 10;
const HOOK_MAX = ROUTING_CELL * 1.5;

type Axis = 'h' | 'v';

function axisOf(a: Point, b: Point): Axis | null {
  if (Math.abs(a.y - b.y) < 0.5 && Math.abs(a.x - b.x) >= 0.5) return 'h';
  if (Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) >= 0.5) return 'v';
  return null;
}

function travel(a: Point, b: Point, axis: Axis): number {
  return Math.sign(axis === 'v' ? b.y - a.y : b.x - a.x);
}

/**
 * Removes "hooks": a run that overshoots, steps a few pixels sideways and comes straight back
 * (grid cells rarely line up with an anchor, so the search can overshoot by up to a cell).
 */
function removeHooks(points: Point[]): Point[] | null {
  for (let i = 0; i + 3 < points.length; i++) {
    if (i === 0 || i + 3 === points.length - 1) continue;
    const [a, b, c, d] = points.slice(i, i + 4);
    const axis = axisOf(a, b);
    if (!axis || axisOf(c, d) !== axis) continue;
    const across = axisOf(b, c);
    if (!across || across === axis) continue;
    if (travel(a, b, axis) === travel(c, d, axis)) continue;
    if (Math.hypot(c.x - b.x, c.y - b.y) > HOOK_MAX) continue;
    const dir = travel(a, b, axis);
    const within = axis === 'v'
      ? (d.y - a.y) * dir > 0 && (b.y - d.y) * dir > 0
      : (d.x - a.x) * dir > 0 && (b.x - d.x) * dir > 0;
    if (!within) continue;
    const corner = axis === 'v' ? { x: a.x, y: d.y } : { x: d.x, y: a.y };
    return [...points.slice(0, i + 1), corner, ...points.slice(i + 3)];
  }
  return null;
}

/** Removes micro-jogs (a few px sideways between two long runs) by sliding one run onto the other. */
function removeJogs(points: Point[]): Point[] | null {
  const last = points.length - 1;
  for (let i = 1; i + 1 < last; i++) {
    const axis = axisOf(points[i], points[i + 1]);
    if (!axis) continue;
    if (Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y) >= JOG_MAX) continue;
    const before = axisOf(points[i - 1], points[i]);
    const after = axisOf(points[i + 1], points[i + 2]);
    if (!before || !after || before === axis || after === axis) continue;
    const key = axis === 'h' ? 'x' : 'y';
    const next = points.map(p => ({ ...p }));
    if (i + 2 < last) {
      next[i + 1][key] = points[i][key];
      next[i + 2][key] = points[i][key];
      return next;
    }
    if (i - 1 > 0) {
      next[i][key] = points[i + 1][key];
      next[i - 1][key] = points[i + 1][key];
      return next;
    }
  }
  return null;
}

/** Straightens a route: no repeated points, hooks, micro-jogs or needless bends. */
export function tidyRoute(points: Point[]): Point[] {
  let pts = simplifyWorld(dedupePoints(points));
  for (let guard = 0; guard < 24; guard++) {
    const next = removeHooks(pts) ?? removeJogs(pts);
    if (!next) break;
    pts = simplifyWorld(dedupePoints(next));
  }
  return pts;
}

/**
 * Link body between two anchors. The first and last runs are always straight
 * stubs perpendicular to the box side, so an arrowhead never lies along the box.
 */
function buildStubbedPoints(
  startAnchor: Point,
  startSide: Side,
  endAnchor: Point,
  endSide: Side,
  mid: Point[],
): Point[] {
  const sStub = stubOf(startAnchor, startSide);
  const tStub = stubOf(endAnchor, endSide);
  const pts: Point[] = [startAnchor, sStub];
  if (mid.length === 0) {
    if (sideNormal(startSide).x !== 0) {
      const midX = (sStub.x + tStub.x) / 2;
      pts.push({ x: midX, y: sStub.y }, { x: midX, y: tStub.y });
    } else {
      const midY = (sStub.y + tStub.y) / 2;
      pts.push({ x: sStub.x, y: midY }, { x: tStub.x, y: midY });
    }
    pts.push(tStub);
  } else {
    pts.push(...elbowFromStub(sStub, startSide, mid[0]), ...mid.slice(1));
    const tail = lastPoint(pts) ?? sStub;
    pts.push(...elbowIntoStub(tail, tStub, endSide));
  }
  pts.push(endAnchor);
  return tidyRoute(pts);
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
  const sourceHandle = lockSource ?? sideTowardPoint(sc, tc);
  const targetHandle = lockTarget ?? oppositeSide(sourceHandle);
  const a = anchors?.start ?? handleAnchor(source, sourceHandle);
  const b = anchors?.end ?? handleAnchor(target, targetHandle);
  return {
    sourceHandle,
    targetHandle,
    points: buildStubbedPoints(a, sourceHandle, b, targetHandle, []),
  };
}

function trimPortStubs(points: Point[], start: Point, end: Point, cell: number): Point[] {
  const limit = cell * 1.5;
  const out = points.slice();
  while (out.length > 0) {
    const head = out.at(0);
    if (!head || Math.hypot(head.x - start.x, head.y - start.y) >= limit) break;
    out.shift();
  }
  while (out.length > 0) {
    const tail = lastPoint(out);
    if (!tail || Math.hypot(tail.x - end.x, tail.y - end.y) >= limit) break;
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
  const points = buildStubbedPoints(startAnchor, search.start.side, endAnchor, search.goal.side, mid);
  return {
    sourceHandle: search.start.side,
    targetHandle: search.goal.side,
    points,
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

function portSides(lock?: Side, cursorSide?: Side): Side[] {
  if (lock) return [lock];
  if (cursorSide) return [cursorSide];
  return SIDES;
}

function openViaCell(grid: Grid, via: Point, fallback: { i: number; j: number }): { i: number; j: number } {
  const cell = toCell(grid, via.x, via.y);
  if (inBounds(grid, cell.i, cell.j) && !grid.blocked[cellIndex(grid, cell.i, cell.j)]) return cell;
  return fallback;
}

function routeViaPoint(
  grid: Grid,
  via: Point,
  options: {
    source: Rect;
    target: Rect;
    starts: Port[];
    goals: Port[];
    preferred: { source?: Side; target?: Side };
    anchors: { start?: Point; end?: Point };
    obstacles: Rect[];
  },
): RoutedPath | null {
  const { source, target, starts, goals, preferred, anchors, obstacles } = options;
  const viaPort: Port = {
    cell: openViaCell(grid, via, starts[0].cell),
    side: 'right',
    t: 0.5,
    dir: 0,
  };
  const first = runAStar(grid, starts, [viaPort], { source: preferred.source });
  const second = runAStar(
    grid,
    [{ ...viaPort, dir: 0 }, { ...viaPort, dir: 1 }, { ...viaPort, dir: 2 }, { ...viaPort, dir: 3 }],
    goals,
    { target: preferred.target },
  );
  if (!first || !second) return null;
  return simplifyIfClear(pathFromSearch(grid, source, target, {
      cells: [...first.cells, ...second.cells.slice(1)],
      start: first.start,
      goal: second.goal,
    }, anchors), [source, target, ...obstacles], []);
}

export function routeOrthogonalAStar(input: RouteInput): RoutedPath {
  const obstacles = input.obstacles ?? [];
  const existing = input.existing ?? [];
  const boxes = [input.source, input.target, ...obstacles];
  const extras = [input.cursor, input.via].filter((p): p is Point => Boolean(p));
  const grid = buildGrid(boxes, existing, extras);

  const facing = facingSides(input.source, input.target);
  const sourceSides = portSides(input.lockSourceHandle);
  const cursorSide = input.cursor ? pickSideFromPoint(input.target, input.cursor) : undefined;
  const targetSides = portSides(input.lockTargetHandle, cursorSide);

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
    const viaRoute = routeViaPoint(grid, input.via, {
      source: input.source,
      target: input.target,
      starts,
      goals,
      preferred,
      anchors,
      obstacles,
    });
    if (viaRoute) return viaRoute;
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
    [input.source, input.target, ...obstacles],
    existing,
  );
}

function segmentBox(a: Point, b: Point, pad: number): Rect {
  return {
    x: Math.min(a.x, b.x) - pad,
    y: Math.min(a.y, b.y) - pad,
    width: Math.abs(a.x - b.x) + pad * 2,
    height: Math.abs(a.y - b.y) + pad * 2,
  };
}

function boxesOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function touchesAnyPath(points: Point[], paths: Point[][]): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const mine = segmentBox(points[i], points[i + 1], 4);
    for (const path of paths) {
      for (let j = 0; j < path.length - 1; j++) {
        if (boxesOverlap(mine, segmentBox(path[j], path[j + 1], 0))) return true;
      }
    }
  }
  return false;
}

/**
 * Keeps ends orthogonal, and prefers the plain stubbed Z/L between the two
 * anchors whenever it is clear of boxes and other links.
 */
function simplifyIfClear(
  route: RoutedPath,
  blocked: Rect[],
  existing: Point[][],
): RoutedPath {
  const start = route.points[0];
  const end = lastPoint(route.points);
  if (!start || !end) return route;
  const direct = buildStubbedPoints(start, route.sourceHandle, end, route.targetHandle, []);
  if (!endsAreOrthogonal(route.points, route.sourceHandle, route.targetHandle)) {
    return { ...route, points: direct };
  }
  if (
    direct.length <= route.points.length
    && endsAreOrthogonal(direct, route.sourceHandle, route.targetHandle)
    && !polylineHitsRects(direct, blocked)
    && !touchesAnyPath(direct, existing)
  ) {
    return { ...route, points: direct };
  }
  return route;
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
  points.pop();
  points.push(cursor);
  if (points.length >= 2) {
    const prev = secondLastPoint(points);
    if (prev && Math.abs(prev.x - cursor.x) >= 1 && Math.abs(prev.y - cursor.y) >= 1) {
      points.splice(-1, 0, { x: cursor.x, y: prev.y });
    }
  }
  return points;
}

function reactionEndpoints(
  edge: Edge,
  sourceNode: Node,
  targetNode: Node,
  byId: Map<string, Node>,
): { sourceEp: ReactionEndpoint | null; targetEp: ReactionEndpoint | null } {
  if (edge.type !== 'fine-granular-reaction') return { sourceEp: null, targetEp: null };
  return {
    sourceEp: buildReactionEndpoint(sourceNode, edge.sourceHandle, 'source', byId),
    targetEp: buildReactionEndpoint(targetNode, edge.targetHandle, 'target', byId),
  };
}

function routeOneReactionEdge(
  edge: Edge,
  byId: Map<string, Node>,
  routable: Node[],
  rectById: Map<string, Rect>,
  placed: Point[][],
  plan?: { sourceSide: Side; targetSide: Side; sourceT?: number; targetT?: number },
): RoutedPath | null {
  const sourceNode = byId.get(edge.source);
  const targetNode = byId.get(edge.target);
  if (!sourceNode || !targetNode) return null;
  const { sourceEp, targetEp } = reactionEndpoints(edge, sourceNode, targetNode, byId);
  const source = sourceEp?.rect ?? rectById.get(edge.source);
  const target = targetEp?.rect ?? rectById.get(edge.target);
  if (!source || !target) return null;
  const obstacles = routable
    .filter(n => n.id !== edge.source && n.id !== edge.target)
    .map(n => rectById.get(n.id))
    .filter((rect): rect is Rect => Boolean(rect));
  return routeOrthogonalAStar({
    source,
    target,
    obstacles,
    existing: placed,
    via: edge.data?.customControlPoint,
    lockSourceHandle: sourceEp?.pin ? sourceEp.lockSide : plan?.sourceSide,
    lockTargetHandle: targetEp?.pin ? targetEp.lockSide : plan?.targetSide,
    sourcePortT: sourceEp?.portT ?? plan?.sourceT,
    targetPortT: targetEp?.portT ?? plan?.targetT,
    sourceAnchor: sourceEp?.anchor,
    targetAnchor: targetEp?.anchor,
  });
}

/** A link path kept on `edge.data.savedRoute` and in local storage; only recomputed when the link changes. */
export interface SavedRoute {
  points: Point[];
  sourceHandle: Side;
  targetHandle: Side;
}

const ROUTE_TOLERANCE = 1.5;

function onSide(rect: Rect, side: Side, p: Point): boolean {
  const withinX = p.x >= rect.x - ROUTE_TOLERANCE && p.x <= rect.x + rect.width + ROUTE_TOLERANCE;
  const withinY = p.y >= rect.y - ROUTE_TOLERANCE && p.y <= rect.y + rect.height + ROUTE_TOLERANCE;
  switch (side) {
    case 'left': return withinY && Math.abs(p.x - rect.x) <= ROUTE_TOLERANCE;
    case 'right': return withinY && Math.abs(p.x - (rect.x + rect.width)) <= ROUTE_TOLERANCE;
    case 'top': return withinX && Math.abs(p.y - rect.y) <= ROUTE_TOLERANCE;
    case 'bottom': return withinX && Math.abs(p.y - (rect.y + rect.height)) <= ROUTE_TOLERANCE;
  }
}

/** A route whose first or last run is too short to hold an arrowhead — it was squeezed between boxes. */
export function hasCrampedEnds(route: SavedRoute): boolean {
  const pts = route.points;
  const tail = pts.at(-2);
  const tip = pts.at(-1);
  if (pts.length < 3 || !tail || !tip) return false;
  const run = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
  const min = STUB_LENGTH / 2;
  return run(pts[0], pts[1]) < min || run(tail, tip) < min;
}

export function asSavedRoute(value: unknown): SavedRoute | null {
  const route = value as Partial<SavedRoute> | null | undefined;
  if (!route || !Array.isArray(route.points) || route.points.length < 2) return null;
  if (!SIDES.includes(route.sourceHandle as Side) || !SIDES.includes(route.targetHandle as Side)) return null;
  const finite = route.points.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  return finite ? route as SavedRoute : null;
}

/** A saved route still holds when both ends sit on the boxes' sides where they were saved. */
export function isSavedRouteValid(route: SavedRoute | null, source?: Rect, target?: Rect): route is SavedRoute {
  if (!route || !source || !target) return false;
  const first = route.points[0];
  const last = route.points.at(-1);
  if (!last) return false;
  return onSide(source, route.sourceHandle, first) && onSide(target, route.targetHandle, last);
}

function sideCoordinate(rect: Rect, side: Side, p: Point): number {
  const horizontal = side === 'top' || side === 'bottom';
  const t = horizontal ? (p.x - rect.x) / rect.width : (p.y - rect.y) / rect.height;
  return Math.min(1, Math.max(0, t));
}

function pickFreeSlot(occupied: number[]): number {
  if (occupied.length === 0) return 0.5;
  let best = 0.5;
  let bestGap = -1;
  for (let k = 1; k <= 9; k++) {
    const t = k / 10;
    const gap = Math.min(...occupied.map(o => Math.abs(o - t)));
    if (gap > bestGap + 1e-6) {
      best = t;
      bestGap = gap;
    }
  }
  return best;
}

interface SlotRequest {
  edgeId: string;
  role: 'source' | 'target';
  farCoord: number;
  /** Length in px of the box side the end attaches to. */
  length: number;
}

/** Widest gap between neighbouring ends, and the room an arrowhead needs; short sides get tighter slots. */
const SLOT_SPACING = 48;
const SLOT_MARGIN = 8;

function evenSlot(index: number, count: number, length: number): number {
  if (count <= 1 || length <= 0) return 0.5;
  const margin = Math.min(SLOT_MARGIN, length * 0.25);
  const spacing = Math.min(SLOT_SPACING, (length - margin * 2) / (count - 1));
  return (length / 2 + (index - (count - 1) / 2) * spacing) / length;
}

/**
 * Spreads the ends of links that share a box side so they sit next to each
 * other instead of on one point. Ends of already-saved links keep their place.
 */
function assignSlots(
  requests: Map<string, SlotRequest[]>,
  occupied: Map<string, number[]>,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const [key, list] of requests) {
    const taken = [...(occupied.get(key) ?? [])];
    const ordered = list.slice().sort((a, b) => a.farCoord - b.farCoord || a.edgeId.localeCompare(b.edgeId));
    ordered.forEach((req, index) => {
      const t = taken.length === 0 ? evenSlot(index, ordered.length, req.length) : pickFreeSlot(taken);
      if (taken.length > 0) taken.push(t);
      result.set(`${req.edgeId}|${req.role}`, t);
    });
  }
  return result;
}

function sideLength(rect: Rect, side: Side): number {
  return side === 'top' || side === 'bottom' ? rect.width : rect.height;
}

function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function pushSlot<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

interface CoarsePlan {
  edge: Edge;
  sourceSide: Side;
  targetSide: Side;
}

function planCoarseEdges(
  pending: Edge[],
  rectById: Map<string, Rect>,
  fixed: Array<{ edge: Edge; route: SavedRoute }>,
  isFree: (edge: Edge, role: 'source' | 'target') => boolean = () => true,
): { plans: CoarsePlan[]; slots: Map<string, number> } {
  const plans: CoarsePlan[] = [];
  const requests = new Map<string, SlotRequest[]>();
  const far = (side: Side, other: Point) => (side === 'top' || side === 'bottom' ? other.x : other.y);
  for (const edge of pending) {
    const source = rectById.get(edge.source);
    const target = rectById.get(edge.target);
    if (!source || !target) continue;
    const { source: sourceSide, target: targetSide } = facingSides(source, target);
    plans.push({ edge, sourceSide, targetSide });
    if (isFree(edge, 'source')) {
      pushSlot(requests, `${edge.source}|${sourceSide}`, {
        edgeId: edge.id,
        role: 'source',
        farCoord: far(sourceSide, rectCenter(target)),
        length: sideLength(source, sourceSide),
      });
    }
    if (isFree(edge, 'target')) {
      pushSlot(requests, `${edge.target}|${targetSide}`, {
        edgeId: edge.id,
        role: 'target',
        farCoord: far(targetSide, rectCenter(source)),
        length: sideLength(target, targetSide),
      });
    }
  }
  const occupied = new Map<string, number[]>();
  for (const { edge, route } of fixed) {
    const source = rectById.get(edge.source);
    const target = rectById.get(edge.target);
    const end = route.points.at(-1);
    if (!source || !target || !end) continue;
    pushSlot(occupied, `${edge.source}|${route.sourceHandle}`, sideCoordinate(source, route.sourceHandle, route.points[0]));
    pushSlot(
      occupied,
      `${edge.target}|${route.targetHandle}`,
      sideCoordinate(target, route.targetHandle, end),
    );
  }
  return { plans, slots: assignSlots(requests, occupied) };
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
  const fixed: Array<{ edge: Edge; route: SavedRoute }> = [];
  const pendingCoarse: Edge[] = [];
  const pendingFine: Edge[] = [];

  for (const edge of reactionEdges) {
    const saved = edge.type === 'reactions' ? asSavedRoute(edge.data?.savedRoute) : null;
    if (isSavedRouteValid(saved, rectById.get(edge.source), rectById.get(edge.target))) {
      routes.set(edge.id, saved);
      placed.push(saved.points);
      fixed.push({ edge, route: saved });
    } else if (edge.type === 'reactions') {
      pendingCoarse.push(edge);
    } else {
      pendingFine.push(edge);
    }
  }

  // Class-level ends of fine-granular links (no pinned attribute row, not a ghost dot) get spread
  // along their box side just like the links between meta models.
  const isFree = (edge: Edge, role: 'source' | 'target'): boolean => {
    if (edge.type === 'reactions') return true;
    const node = byId.get(role === 'source' ? edge.source : edge.target);
    if (!node || node.type === 'ghost') return false;
    const handle = role === 'source' ? edge.sourceHandle : edge.targetHandle;
    return !buildReactionEndpoint(node, handle, role, byId)?.pin;
  };
  const { plans, slots } = planCoarseEdges([...pendingFine, ...pendingCoarse], rectById, fixed, isFree);

  for (const plan of plans) {
    if (plan.edge.type === 'reactions') continue;
    const { edge, sourceSide, targetSide } = plan;
    const route = routeOneReactionEdge(edge, byId, routable, rectById, placed, {
      sourceSide,
      targetSide,
      sourceT: slots.get(`${edge.id}|source`),
      targetT: slots.get(`${edge.id}|target`),
    });
    if (!route) continue;
    routes.set(edge.id, route);
    placed.push(route.points);
  }

  for (const { edge, sourceSide, targetSide } of plans) {
    if (edge.type !== 'reactions') continue;
    const source = rectById.get(edge.source);
    const target = rectById.get(edge.target);
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
      lockSourceHandle: sourceSide,
      lockTargetHandle: targetSide,
      sourcePortT: slots.get(`${edge.id}|source`),
      targetPortT: slots.get(`${edge.id}|target`),
    });
    routes.set(edge.id, route);
    placed.push(route.points);
  }
  return routes;
}

/**
 * Cheap re-routing while a box is being dragged: links whose ends still sit on their boxes keep
 * the route they had, the rest get a plain stubbed Z/L between their facing sides. The full
 * obstacle-aware search runs once, when the drag ends.
 */
export function routeReactionEdgesWhileDragging(
  nodes: Node[],
  edges: Edge[],
  previous: Map<string, RoutedPath>,
): Map<string, RoutedPath> {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const rectById = new Map<string, Rect>();
  for (const node of nodes) {
    if (!isRoutableNode(node)) continue;
    const rect = nodeWorldRect(node, byId);
    if (rect) rectById.set(node.id, rect);
  }
  const routes = new Map<string, RoutedPath>();
  for (const edge of edges) {
    if (edge.type !== 'reactions' && edge.type !== 'fine-granular-reaction') continue;
    const sourceNode = byId.get(edge.source);
    const targetNode = byId.get(edge.target);
    const source = rectById.get(edge.source);
    const target = rectById.get(edge.target);
    if (!sourceNode || !targetNode || !source || !target) continue;

    const before = previous.get(edge.id);
    if (before && isSavedRouteValid(before, source, target)) {
      routes.set(edge.id, before);
      continue;
    }
    const { sourceEp, targetEp } = reactionEndpoints(edge, sourceNode, targetNode, byId);
    const facing = facingSides(source, target);
    const sourceSide = sourceEp?.pin && sourceEp.lockSide ? sourceEp.lockSide : facing.source;
    const targetSide = targetEp?.pin && targetEp.lockSide ? targetEp.lockSide : facing.target;
    const start = sourceEp?.anchor ?? handleAnchor(source, sourceSide, sourceEp?.portT);
    const end = targetEp?.anchor ?? handleAnchor(target, targetSide, targetEp?.portT);
    routes.set(edge.id, {
      sourceHandle: sourceSide,
      targetHandle: targetSide,
      points: buildStubbedPoints(start, sourceSide, end, targetSide, []),
    });
  }
  return routes;
}

export function applyAStarReactionHandles(nodes: Node[], edges: Edge[]): Edge[] {
  const routes = routeAllReactionEdges(nodes, edges);
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
        savedRoute: undefined,
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
