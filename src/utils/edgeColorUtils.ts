// Edge Color Management System
// This module provides consistent color assignment for edges between nodes

/**
 * 25 distinct, visually appealing colors for edge connections
 * Colors are chosen to be easily distinguishable and aesthetically pleasing
 */
export const EDGE_COLORS = [
  '#FF6B6B', // Coral Red
  '#4ECDC4', // Turquoise
  '#45B7D1', // Sky Blue
  '#FFA07A', // Light Salmon
  '#98D8C8', // Mint Green
  '#F7DC6F', // Sunny Yellow
  '#BB8FCE', // Lavender
  '#85C1E2', // Powder Blue
  '#F8B88B', // Peach
  '#AED6F1', // Light Blue
  '#A9DFBF', // Light Green
  '#FAD7A0', // Light Orange
  '#D7BDE2', // Light Purple
  '#A3E4D7', // Aquamarine
  '#F9E79F', // Light Yellow
  '#EDBB99', // Apricot
  '#C39BD3', // Orchid
  '#7FB3D5', // Cerulean
  '#76D7C4', // Medium Turquoise
  '#F0B27A', // Sandy Brown
  '#82E0AA', // Light Sea Green
  '#F8C471', // Marigold
  '#AF7AC5', // Medium Orchid
  '#5DADE2', // Dodger Blue
  '#58D68D', // Emerald Green
];


/**
 * Global registry to track assigned colors for node pairs
 * Key format: "sourceId|targetId" (normalized)
 */
const colorRegistry = new Map<string, string>();

/**
 * Counter to track the next color index to assign
 */
let colorIndex = 0;

/**
 * Normalize node pair to ensure consistent key regardless of direction
 * For example: ("nodeA", "nodeB") and ("nodeB", "nodeA") produce the same key
 */
function normalizeNodePair(sourceId: string, targetId: string): string {
  // Sort alphabetically to ensure consistency
  const [first, second] = [sourceId, targetId].sort();
  return `${first}|${second}`;
}

/**
 * Get a consistent color for an edge between two nodes
 * - If the connection already exists, returns the existing color
 * - If it's a new connection, assigns the next color from the palette
 * 
 * @param sourceId - ID of the source node
 * @param targetId - ID of the target node
 * @returns A color hex string
 */
export function getEdgeColor(sourceId: string, targetId: string): string {
  const key = normalizeNodePair(sourceId, targetId);
  
  // Check if this connection already has a color
  if (colorRegistry.has(key)) {
    return colorRegistry.get(key)!;
  }
  
  // Assign a new color (cycling through the palette if needed)
  const color = EDGE_COLORS[colorIndex % EDGE_COLORS.length];
  colorRegistry.set(key, color);
  
  // Move to next color
  colorIndex++;
  
  return color;
}

/**
 * Reset the color registry (useful for clearing all assignments)
 */
export function resetColorRegistry(): void {
  colorRegistry.clear();
  colorIndex = 0;
}

/**
 * Get all current color assignments
 * @returns Map of node pairs to their assigned colors
 */
export function getColorRegistry(): Map<string, string> {
  return new Map(colorRegistry);
}

/**
 * Manually set a color for a specific node pair
 * @param sourceId - ID of the source node
 * @param targetId - ID of the target node
 * @param color - Hex color string
 */
export function setEdgeColor(sourceId: string, targetId: string, color: string): void {
  const key = normalizeNodePair(sourceId, targetId);
  colorRegistry.set(key, color);
}

/**
 * Remove color assignment for a specific node pair
 * @param sourceId - ID of the source node
 * @param targetId - ID of the target node
 */
export function removeEdgeColor(sourceId: string, targetId: string): void {
  const key = normalizeNodePair(sourceId, targetId);
  colorRegistry.delete(key);
}

/**
 * Get statistics about color usage
 */
export function getColorStats() {
  return {
    totalAssignments: colorRegistry.size,
    nextColorIndex: colorIndex % EDGE_COLORS.length,
    availableColors: EDGE_COLORS.length,
  };
}