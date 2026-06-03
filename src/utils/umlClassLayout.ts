/**
 * Layout algorithm for floating UML diagram class boxes (UMLDiagram / ecoreToUml).
 * Mirrors the hierarchy + force-directed approach used in umlGenerator.ts.
 */

export interface UmlLayoutClass {
  id: string;
  x: number;
  y: number;
}

/** Minimal position type for focus / fit calculations */
export type UmlLayoutPosition = Pick<UmlLayoutClass, 'id' | 'x' | 'y'>;

export interface UmlLayoutRelationship {
  sourceId: string;
  targetId: string;
  type: 'inheritance' | 'composition' | 'association';
}

const BOX_W = 190;
const BOX_H = 110;
const H_SPACING = 90;
const V_SPACING = 110;
const START_X = 80;
const START_Y = 80;
const MAX_SPAN = 1000;

function findClass(classes: UmlLayoutClass[], id: string): UmlLayoutClass | undefined {
  return classes.find(c => c.id === id);
}

function getTreeWidth(nodeId: string, parentToChildren: Map<string, string[]>): number {
  const children = parentToChildren.get(nodeId) || [];
  if (children.length === 0) return 1;
  return children.reduce((sum, childId) => sum + getTreeWidth(childId, parentToChildren), 0);
}

function layoutTreeNode(
  nodeId: string,
  level: number,
  leftBound: number,
  rightBound: number,
  rootTreeWidth: number,
  startY: number,
  classes: UmlLayoutClass[],
  parentToChildren: Map<string, string[]>,
): void {
  const node = findClass(classes, nodeId);
  if (!node) return;

  const centerX = (leftBound + rightBound) / 2;
  node.x = centerX - BOX_W / 2;
  node.y = startY + level * (BOX_H + V_SPACING);

  const children = parentToChildren.get(nodeId) || [];
  if (children.length === 0) return;

  let childX = leftBound;
  children.forEach(childId => {
    const childWidth = getTreeWidth(childId, parentToChildren);
    const childSpace = (rightBound - leftBound) * (childWidth / Math.max(rootTreeWidth, 1));
    layoutTreeNode(childId, level + 1, childX, childX + childSpace, rootTreeWidth, startY, classes, parentToChildren);
    childX += childSpace;
  });
}

function normalizePositions(
  componentIds: string[],
  positions: Map<string, { x: number; y: number }>,
  startX: number,
  startY: number,
  classes: UmlLayoutClass[],
): void {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  positions.forEach(pos => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + BOX_W);
    maxY = Math.max(maxY, pos.y + BOX_H);
  });

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const scale = Math.min(1, MAX_SPAN / Math.max(spanX, spanY, 1));

  componentIds.forEach(id => {
    const node = findClass(classes, id);
    const pos = positions.get(id);
    if (!node || !pos) return;
    node.x = (pos.x - minX) * scale + startX;
    node.y = (pos.y - minY) * scale + startY;
  });
}

function layoutForceDirected(
  componentIds: string[],
  startX: number,
  startY: number,
  classes: UmlLayoutClass[],
  adjacency: Map<string, Set<string>>,
): void {
  const positions = new Map<string, { x: number; y: number }>();
  const n = componentIds.length;

  const sortedByDegree = [...componentIds].sort(
    (a, b) => (adjacency.get(b)?.size ?? 0) - (adjacency.get(a)?.size ?? 0),
  );
  const hubNode = sortedByDegree[0];
  const otherNodes = sortedByDegree.slice(1);

  const slot = BOX_W + H_SPACING / 2;
  const radius = n <= 2 ? slot * 0.8 : (slot * n) / (2.8 * Math.PI);
  const cx = startX + radius;
  const cy = startY + radius;

  positions.set(hubNode, { x: cx, y: cy });
  otherNodes.forEach((nodeId, idx) => {
    const angle = (2 * Math.PI * idx) / Math.max(otherNodes.length, 1) - Math.PI / 2;
    positions.set(nodeId, {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  });

  const ITERATIONS = 180;
  const IDEAL = BOX_W + H_SPACING * 0.55;
  const REPULSION = 7500;
  const ATTRACTION = 0.48;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const forces = new Map<string, { x: number; y: number }>();
    componentIds.forEach(id => forces.set(id, { x: 0, y: 0 }));

    for (let i = 0; i < componentIds.length; i++) {
      for (let j = i + 1; j < componentIds.length; j++) {
        const a = componentIds[i];
        const b = componentIds[j];
        const posA = positions.get(a)!;
        const posB = positions.get(b)!;
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dist = Math.max(Math.hypot(dx, dy), 1);
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force * 0.15;
        const fy = (dy / dist) * force;
        forces.get(a)!.x -= fx;
        forces.get(a)!.y -= fy;
        forces.get(b)!.x += fx;
        forces.get(b)!.y += fy;
      }
    }

    componentIds.forEach(nodeId => {
      (adjacency.get(nodeId) || new Set()).forEach(neighborId => {
        if (!componentIds.includes(neighborId)) return;
        const posA = positions.get(nodeId)!;
        const posB = positions.get(neighborId)!;
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dist = Math.max(Math.hypot(dx, dy), 1);
        const force = ATTRACTION * (dist - IDEAL);
        forces.get(nodeId)!.x += (dx / dist) * force;
        forces.get(nodeId)!.y += (dy / dist) * force;
      });
    });

    const cool = 1 - (iter / ITERATIONS) * 0.6;
    componentIds.forEach(nodeId => {
      const pos = positions.get(nodeId)!;
      const f = forces.get(nodeId)!;
      pos.x += f.x * 0.75 * cool;
      pos.y += f.y * 0.75 * cool;
    });
  }

  normalizePositions(componentIds, positions, startX, startY, classes);
}

function layoutComponent(
  componentIds: string[],
  startX: number,
  startY: number,
  classes: UmlLayoutClass[],
  relationships: UmlLayoutRelationship[],
  adjacency: Map<string, Set<string>>,
): void {
  if (componentIds.length === 1) {
    const node = findClass(classes, componentIds[0]);
    if (node) {
      node.x = startX;
      node.y = startY;
    }
    return;
  }

  const inheritance = relationships.filter(
    r => r.type === 'inheritance' && componentIds.includes(r.sourceId) && componentIds.includes(r.targetId),
  );

  if (inheritance.length > 0) {
    const childToParent = new Map<string, string>();
    const parentToChildren = new Map<string, string[]>();
    inheritance.forEach(edge => {
      childToParent.set(edge.sourceId, edge.targetId);
      const children = parentToChildren.get(edge.targetId) || [];
      children.push(edge.sourceId);
      parentToChildren.set(edge.targetId, children);
    });

    const roots = componentIds.filter(id => !childToParent.has(id));
    let currentX = startX;
    roots.forEach(rootId => {
      const treeWidth = getTreeWidth(rootId, parentToChildren);
      const treeSpace = treeWidth * (BOX_W + H_SPACING);
      layoutTreeNode(rootId, 0, currentX, currentX + treeSpace, treeWidth, startY, classes, parentToChildren);
      currentX += treeSpace + H_SPACING * 2;
    });
  } else {
    layoutForceDirected(componentIds, startX, startY, classes, adjacency);
  }
}

function resolveOverlaps(classes: UmlLayoutClass[]): void {
  const MIN_DIST = BOX_W * 0.8;
  for (let iter = 0; iter < 25; iter++) {
    let moved = false;
    for (let i = 0; i < classes.length; i++) {
      for (let j = i + 1; j < classes.length; j++) {
        const a = classes[i];
        const b = classes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist < MIN_DIST && dist > 0.001) {
          moved = true;
          const push = (MIN_DIST - dist) / 2 + 4;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
    if (!moved) break;
  }
}

/** Assign parallel index/count for edges between the same node pair (stable sort by id). */
export function assignParallelRelMeta<T extends { id: string; sourceId: string; targetId: string }>(
  rels: T[],
): Array<T & { parallelIndex: number; parallelCount: number }> {
  const groups = new Map<string, typeof rels>();
  for (const rel of rels) {
    const key = rel.sourceId < rel.targetId
      ? `${rel.sourceId}__${rel.targetId}`
      : `${rel.targetId}__${rel.sourceId}`;
    const list = groups.get(key) || [];
    list.push(rel);
    groups.set(key, list);
  }
  return rels.map(rel => {
    const key = rel.sourceId < rel.targetId
      ? `${rel.sourceId}__${rel.targetId}`
      : `${rel.targetId}__${rel.sourceId}`;
    const list = groups.get(key) || [rel];
    const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
    return {
      ...rel,
      parallelIndex: sorted.findIndex(r => r.id === rel.id),
      parallelCount: sorted.length,
    };
  });
}

/** Compute non-overlapping positions for UML class boxes from relationship graph. */
export function applyUmlDiagramLayout(
  classes: UmlLayoutClass[],
  relationships: UmlLayoutRelationship[],
): void {
  if (classes.length === 0) return;

  const adjacency = new Map<string, Set<string>>();
  classes.forEach(c => adjacency.set(c.id, new Set()));
  relationships.forEach(rel => {
    adjacency.get(rel.sourceId)?.add(rel.targetId);
    adjacency.get(rel.targetId)?.add(rel.sourceId);
  });

  const visited = new Set<string>();
  const components: string[][] = [];
  const isolated: string[] = [];

  classes.forEach(c => {
    if ((adjacency.get(c.id)?.size ?? 0) === 0) {
      isolated.push(c.id);
      visited.add(c.id);
    }
  });

  classes.forEach(c => {
    if (visited.has(c.id)) return;
    const component: string[] = [];
    const queue = [c.id];
    visited.add(c.id);
    while (queue.length > 0) {
      const id = queue.shift()!;
      component.push(id);
      adjacency.get(id)?.forEach(nid => {
        if (!visited.has(nid)) {
          visited.add(nid);
          queue.push(nid);
        }
      });
    }
    if (component.length > 0) components.push(component);
  });

  components.sort((a, b) => b.length - a.length);

  let currentY = START_Y;
  components.forEach(component => {
    layoutComponent(component, START_X, currentY, classes, relationships, adjacency);
    let maxY = currentY;
    component.forEach(id => {
      const node = findClass(classes, id);
      if (node) maxY = Math.max(maxY, node.y);
    });
    currentY = maxY + BOX_H + V_SPACING * 2;
  });

  if (isolated.length > 0) {
    const cols = Math.ceil(Math.sqrt(isolated.length));
    isolated.forEach((id, idx) => {
      const node = findClass(classes, id);
      if (!node) return;
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      node.x = START_X + col * (BOX_W + H_SPACING);
      node.y = currentY + row * (BOX_H + V_SPACING);
    });
  }

  resolveOverlaps(classes);
}

/** Median of numeric values (robust center for layout focus). */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Bounding box around the densest cluster of class boxes (median center + nearest ~88%),
 * so the initial viewport focuses where most boxes are—not distant outliers or empty padding.
 */
export function computeUmlFocusRect<T extends UmlLayoutPosition>(
  classes: T[],
  options?: {
    boxWidth?: number;
    boxHeight?: number | ((c: T) => number);
    focusRatio?: number;
    padding?: number;
  },
): { minX: number; minY: number; maxX: number; maxY: number } {
  const boxWidth = options?.boxWidth ?? BOX_W;
  const boxHeightOpt = options?.boxHeight ?? BOX_H;
  const getH: (c: T) => number =
    typeof boxHeightOpt === 'function'
      ? boxHeightOpt
      : () => boxHeightOpt;
  const focusRatio = options?.focusRatio ?? 0.88;
  const padding = options?.padding ?? 48;

  if (classes.length === 0) {
    return { minX: 0, minY: 0, maxX: boxWidth, maxY: BOX_H };
  }
  if (classes.length === 1) {
    const c = classes[0];
    const h = getH(c);
    return { minX: c.x, minY: c.y, maxX: c.x + boxWidth, maxY: c.y + h };
  }

  const points = classes.map(c => ({
    c,
    cx: c.x + boxWidth / 2,
    cy: c.y + getH(c) / 2,
  }));
  const mcx = median(points.map(p => p.cx));
  const mcy = median(points.map(p => p.cy));

  const withDist = points.map(p => ({
    ...p,
    d: Math.hypot(p.cx - mcx, p.cy - mcy),
  }));
  const distSorted = withDist.map(p => p.d).sort((a, b) => a - b);
  const q1 = distSorted[Math.floor(distSorted.length * 0.25)] ?? 0;
  const q3 = distSorted[Math.floor(distSorted.length * 0.75)] ?? 0;
  const maxDist = q3 + Math.max((q3 - q1) * 1.5, boxWidth * 1.5);

  let subset = withDist.filter(p => p.d <= maxDist);
  if (subset.length < Math.min(3, classes.length)) {
    const keep = Math.max(2, Math.ceil(classes.length * focusRatio));
    subset = [...withDist].sort((a, b) => a.d - b.d).slice(0, keep);
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  subset.forEach(({ c }) => {
    const h = getH(c);
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + boxWidth);
    maxY = Math.max(maxY, c.y + h);
  });

  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
}

/** Pick React Flow UML nodes that belong to the dense focus region (for fitView). */
export function pickFocusUmlFlowNodes<T extends { id: string; position: { x: number; y: number } }>(
  nodes: T[],
  boxWidth = BOX_W,
  boxHeight = BOX_H,
): T[] {
  if (nodes.length <= 3) return nodes;
  const layoutItems: UmlLayoutClass[] = nodes.map(n => ({
    id: n.id,
    x: n.position.x,
    y: n.position.y,
  }));
  const rect = computeUmlFocusRect(layoutItems, { boxWidth, boxHeight });
  const inside = nodes.filter(n => {
    const { x, y } = n.position;
    return (
      x + boxWidth >= rect.minX &&
      x <= rect.maxX &&
      y + boxHeight >= rect.minY &&
      y <= rect.maxY
    );
  });
  return inside.length >= 2 ? inside : nodes;
}
