import { Edge, Node } from 'reactflow';

export type Point = { x: number; y: number };

/** Tuning for the force-directed workspace layout. */
export const LAYOUT_CONFIG = {
  BOX_WIDTH: 280,
  BOX_HEIGHT: 180,
  MIN_HORIZONTAL_SPACING: 150,
  MIN_VERTICAL_SPACING: 120,
  START_X: 100,
  START_Y: 100,
  ITERATIONS: 150,
  REPULSION_STRENGTH: 50000,
  ATTRACTION_STRENGTH: 0.3,
  DAMPING: 0.85,
};

/** Every node pushes every other node apart, falling off with the square of distance. */
export function calculateRepulsiveForces(
  componentNodes: string[],
  positions: Map<string, Point>,
  forces: Map<string, Point>,
): void {
  for (let i = 0; i < componentNodes.length; i++) {
    for (let j = i + 1; j < componentNodes.length; j++) {
      const nodeA = componentNodes[i];
      const nodeB = componentNodes[j];
      const posA = positions.get(nodeA)!;
      const posB = positions.get(nodeB)!;

      const dx = posB.x - posA.x;
      const dy = posB.y - posA.y;
      const distance = Math.hypot(dx, dy) || 1;

      const force = LAYOUT_CONFIG.REPULSION_STRENGTH / (distance * distance);
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;

      const forceA = forces.get(nodeA)!;
      const forceB = forces.get(nodeB)!;
      forceA.x -= fx;
      forceA.y -= fy;
      forceB.x += fx;
      forceB.y += fy;
    }
  }
}

/** Connected nodes pull toward each other until they sit one ideal edge length apart. */
export function calculateAttractiveForces(
  componentNodes: string[],
  positions: Map<string, Point>,
  forces: Map<string, Point>,
  adjacencyMap: Map<string, Set<string>>,
  idealEdgeLength: number,
): void {
  componentNodes.forEach(nodeId => {
    const neighbors = adjacencyMap.get(nodeId) || new Set<string>();
    neighbors.forEach(neighborId => {
      if (!componentNodes.includes(neighborId)) return;

      const posA = positions.get(nodeId)!;
      const posB = positions.get(neighborId)!;

      const dx = posB.x - posA.x;
      const dy = posB.y - posA.y;
      const distance = Math.hypot(dx, dy) || 1;

      const force = LAYOUT_CONFIG.ATTRACTION_STRENGTH * (distance - idealEdgeLength);
      const forceA = forces.get(nodeId)!;
      forceA.x += (dx / distance) * force;
      forceA.y += (dy / distance) * force;
    });
  });
}

/**
 * Runs the force simulation for one connected component, seeded on a circle,
 * then normalises the result so its top-left corner sits at (startX, startY).
 */
export function layoutComponent(
  componentNodes: string[],
  startX: number,
  startY: number,
  adjacencyMap: Map<string, Set<string>>,
): Map<string, Point> {
  if (componentNodes.length === 1) {
    return new Map([[componentNodes[0], { x: startX, y: startY }]]);
  }

  const positions = new Map<string, Point>();
  componentNodes.forEach((nodeId, idx) => {
    const angle = (idx / componentNodes.length) * 2 * Math.PI;
    const radius = Math.max(200, componentNodes.length * 40);
    positions.set(nodeId, {
      x: startX + radius + radius * Math.cos(angle),
      y: startY + radius + radius * Math.sin(angle),
    });
  });

  const idealEdgeLength = LAYOUT_CONFIG.BOX_WIDTH + LAYOUT_CONFIG.MIN_HORIZONTAL_SPACING;

  for (let iter = 0; iter < LAYOUT_CONFIG.ITERATIONS; iter++) {
    const forces = new Map<string, Point>();
    componentNodes.forEach(nodeId => forces.set(nodeId, { x: 0, y: 0 }));

    calculateRepulsiveForces(componentNodes, positions, forces);
    calculateAttractiveForces(componentNodes, positions, forces, adjacencyMap, idealEdgeLength);

    componentNodes.forEach(nodeId => {
      const pos = positions.get(nodeId)!;
      const force = forces.get(nodeId)!;
      pos.x += force.x * LAYOUT_CONFIG.DAMPING;
      pos.y += force.y * LAYOUT_CONFIG.DAMPING;
    });
  }

  let minX = Infinity;
  let minY = Infinity;
  positions.forEach(pos => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
  });

  positions.forEach(pos => {
    pos.x = pos.x - minX + startX;
    pos.y = pos.y - minY + startY;
  });

  return positions;
}

/** Undirected adjacency over reaction edges only. */
export function buildAdjacencyMap(ecoreNodes: Node[], allEdges: Edge[]): Map<string, Set<string>> {
  const adjacencyMap = new Map<string, Set<string>>();
  ecoreNodes.forEach(node => adjacencyMap.set(node.id, new Set()));

  allEdges.forEach(edge => {
    if (edge.type === 'reactions') {
      adjacencyMap.get(edge.source)?.add(edge.target);
      adjacencyMap.get(edge.target)?.add(edge.source);
    }
  });

  return adjacencyMap;
}

/** Splits the graph into connected components (BFS), pulling out unconnected nodes. */
export function findConnectedComponents(
  ecoreNodes: Node[],
  adjacencyMap: Map<string, Set<string>>,
): { components: string[][]; isolatedNodes: string[] } {
  const visited = new Set<string>();
  const components: string[][] = [];
  const isolatedNodes: string[] = [];

  ecoreNodes.forEach(node => {
    if ((adjacencyMap.get(node.id)?.size || 0) === 0) {
      isolatedNodes.push(node.id);
      visited.add(node.id);
    }
  });

  ecoreNodes.forEach(startNode => {
    if (visited.has(startNode.id)) return;

    const component: string[] = [];
    const queue = [startNode.id];
    visited.add(startNode.id);

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      component.push(nodeId);

      adjacencyMap.get(nodeId)?.forEach(neighborId => {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      });
    }

    if (component.length > 0) {
      components.push(component);
    }
  });

  return { components, isolatedNodes };
}

/**
 * Computes a fresh position for every ecoreFile node: connected components are
 * laid out one below the other with the force simulation, and isolated nodes
 * are packed into a grid underneath them.
 */
export function computeAutoLayoutPositions(ecoreNodes: Node[], edges: Edge[]): Map<string, Point> {
  const adjacencyMap = buildAdjacencyMap(ecoreNodes, edges);
  const { components, isolatedNodes } = findConnectedComponents(ecoreNodes, adjacencyMap);

  const positionMap = new Map<string, Point>();
  let currentY = LAYOUT_CONFIG.START_Y;

  components.forEach(component => {
    const componentPositions = layoutComponent(component, LAYOUT_CONFIG.START_X, currentY, adjacencyMap);
    componentPositions.forEach((pos, nodeId) => positionMap.set(nodeId, pos));

    let maxY = 0;
    componentPositions.forEach(pos => {
      maxY = Math.max(maxY, pos.y);
    });
    currentY = maxY + LAYOUT_CONFIG.BOX_HEIGHT + LAYOUT_CONFIG.MIN_VERTICAL_SPACING * 2;
  });

  if (isolatedNodes.length > 0) {
    const itemsPerRow = Math.ceil(Math.sqrt(isolatedNodes.length * 2));
    isolatedNodes.forEach((nodeId, idx) => {
      const row = Math.floor(idx / itemsPerRow);
      const col = idx % itemsPerRow;
      positionMap.set(nodeId, {
        x: LAYOUT_CONFIG.START_X + col * (LAYOUT_CONFIG.BOX_WIDTH + LAYOUT_CONFIG.MIN_HORIZONTAL_SPACING),
        y: currentY + row * (LAYOUT_CONFIG.BOX_HEIGHT + LAYOUT_CONFIG.MIN_VERTICAL_SPACING),
      });
    });
  }

  return positionMap;
}

/** Applies computed positions, leaving non-ecoreFile nodes untouched. */
export function applyAutoLayoutPositions(nodes: Node[], positionMap: Map<string, Point>): Node[] {
  return nodes.map(node => {
    if (node.type !== 'ecoreFile') return node;
    const position = positionMap.get(node.id);
    return position ? { ...node, position } : node;
  });
}
