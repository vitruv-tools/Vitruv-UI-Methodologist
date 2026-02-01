import { ReactFlowInstance } from "reactflow";
import { FlowNode } from "../types";

export interface BoundingBox {
  rearrangeKey: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface BoxOffset {
  rearrangeKey: string;
  x: number;
  y: number;
}

const NODE_DIMENSIONS = {
  default: { width: 280, height: 180 },
  ghost: { width: 0, height: 0 },
};
const NODE_PADDING = 40;

/**
 * IBM Color Palette for Colorblindness with accessible styles
 * Reference: https://www.ibm.com/design/v1/language/resources/color-library
 */
const ACCESSIBLE_BBOX_PALETTE = [
  {
    color: "#648fff",
    backgroundColor: "rgba(100, 143, 255, 0.05)",
    borderStyle: "solid" as const,
    label: "Blue Solid",
  },
  {
    color: "#ffb000",
    backgroundColor: "rgba(255, 176, 0, 0.05)",
    borderStyle: "dashed" as const,
    label: "Gold Dashed",
  },
  {
    color: "#dc267f",
    backgroundColor: "rgba(220, 38, 127, 0.05)",
    borderStyle: "dotted" as const,
    label: "Magenta Dotted",
  },
  {
    color: "#fe6100",
    backgroundColor: "rgba(254, 97, 0, 0.05)",
    borderStyle: "double" as const,
    label: "Orange Double",
  },
  {
    color: "#785ef0",
    backgroundColor: "rgba(120, 94, 240, 0.05)",
    borderStyle: "groove" as const,
    label: "Purple Groove",
  },
];

function getByPath<T>(obj: any, path: string): T | undefined {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

/**
 * Calculate bounding boxes for each rearrange key or group
 */
export function calculateBoundingBoxes(
  nodesToArrange: FlowNode[],
  rearrangeBy?: string,
): BoundingBox[] {
  const boundingBox: { [key: string]: BoundingBox } = {};

  nodesToArrange.forEach((n) => {
    if (n.data.isBoundingBox) return;
    // If no rearrange key is provided, we use the existing group assignment
    const rearrangeKey = rearrangeBy
      ? getByPath<string | undefined>(n.data, rearrangeBy)
      : n.data.group;

    if (rearrangeKey === undefined) return;

    if (!boundingBox[rearrangeKey]) {
      boundingBox[rearrangeKey] = {
        rearrangeKey,
        left: n.position.x,
        right: n.position.x,
        top: n.position.y,
        bottom: n.position.y,
      };
    }

    boundingBox[rearrangeKey].left = Math.min(
      boundingBox[rearrangeKey].left,
      n.position.x,
    );
    boundingBox[rearrangeKey].right = Math.max(
      boundingBox[rearrangeKey].right,
      n.position.x + (n.width ?? NODE_DIMENSIONS[(n.type ?? "") as keyof typeof NODE_DIMENSIONS]?.width ?? NODE_DIMENSIONS.default.width),
    );
    boundingBox[rearrangeKey].top = Math.min(
      boundingBox[rearrangeKey].top,
      n.position.y,
    );
    boundingBox[rearrangeKey].bottom = Math.max(
      boundingBox[rearrangeKey].bottom,
      n.position.y + (n.height ?? NODE_DIMENSIONS[(n.type ?? "") as keyof typeof NODE_DIMENSIONS]?.height ?? NODE_DIMENSIONS.default.height),
    );

    // Tell node about its bounding box
    n.data.group = rearrangeKey;
  });

  const boxes = Object.values(boundingBox);

  // Apply padding
  boxes.forEach((box) => {
    box.left -= NODE_PADDING / 2;
    box.right += NODE_PADDING / 2;
    box.top -= NODE_PADDING / 2;
    box.bottom += NODE_PADDING / 2;
  });

  return boxes;
}

/**
 * Check if two bounding boxes overlap
 */
export function boxesOverlap(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
): boolean {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

/**
 * Calculate minimum separation offset between overlapping boxes
 */
export function calculateSeparationOffset(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
): { x: number; y: number } {
  const moveLeft = b.left - a.right;
  const moveRight = b.right - a.left;
  const moveUp = b.top - a.bottom;
  const moveDown = b.bottom - a.top;

  const xOffset =
    Math.abs(moveLeft) < Math.abs(moveRight) ? moveLeft : moveRight;
  const yOffset = Math.abs(moveUp) < Math.abs(moveDown) ? moveUp : moveDown;

  return Math.abs(xOffset) < Math.abs(yOffset)
    ? { x: xOffset, y: 0 }
    : { x: 0, y: yOffset };
}

/**
 * Apply offset to a bounding box
 */
export function applyBoxOffset(
  box: BoundingBox,
  offset: { x: number; y: number },
): BoundingBox {
  return {
    rearrangeKey: box.rearrangeKey,
    left: box.left + offset.x,
    right: box.right + offset.x,
    top: box.top + offset.y,
    bottom: box.bottom + offset.y,
  };
}

/**
 * Calculate all necessary offsets to separate overlapping boxes
 */
export function calculateAndUpdateBoundingBoxes(
  boxes: BoundingBox[],
): BoxOffset[] {
  const originalBoxes = JSON.stringify(boxes);
  const offsets: BoxOffset[] = [];
  const maxIterations = 100;
  let iteration = 0;

  for (let i = 0; i < boxes.length && iteration < maxIterations; i++) {
    for (let j = i + 1; j < boxes.length && iteration < maxIterations; j++) {
      iteration++;
      if (boxesOverlap(boxes[i], boxes[j])) {
        const offset = calculateSeparationOffset(boxes[i], boxes[j]);
        offsets[i] = {
          rearrangeKey: boxes[i].rearrangeKey,
          x: (offsets[i]?.x ?? 0) + offset.x,
          y: (offsets[i]?.y ?? 0) + offset.y,
        };
        boxes[i] = applyBoxOffset(boxes[i], offset);
      }
    }
  }

  // Remove undefined offsets because they indicate no movement needed
  return offsets.filter((o) => o !== undefined);
}

export type BoundingBoxNodeData = {
  boundingBoxPaletteIndex: number;
};

/**
 * Create or update debug visualization nodes for bounding boxes
 * Uses carousel-style accessible colors and border styles for colorblind accessibility
 */
export function createOrUpdateBoundingBoxNodes(
  boxes: BoundingBox[],
  nodes: (FlowNode & { data: Partial<BoundingBoxNodeData> })[],
): FlowNode[] {
  const result: FlowNode[] = [];

  // First we track which palette indexes are already used
  const boundingBoxPalleteIndexes = new Set<number>(
    Array.from(Array(ACCESSIBLE_BBOX_PALETTE.length).keys()),
  );
  nodes
    .filter((n) => n.data.isBoundingBox)
    .forEach((n) => {
      const paletteIndex = n.data.boundingBoxPaletteIndex;
      if (paletteIndex !== undefined) {
        // Mark palette index as used
        boundingBoxPalleteIndexes.delete(paletteIndex);
      }
    });

  for (const [idx, box] of Array.from(boxes.entries())) {
    const existingDebugNode = nodes.find(
      (n) => n.data.isBoundingBox && n.data.group === box.rearrangeKey,
    );

    let paletteIndex: number;
    if (existingDebugNode?.data.boundingBoxPaletteIndex !== undefined) {
      // Preserve color of existing box
      paletteIndex = existingDebugNode.data.boundingBoxPaletteIndex;
    } else if (boundingBoxPalleteIndexes.size > 0) {
      // Carousel through palette styles
      // Take ones we know are free first
      paletteIndex = boundingBoxPalleteIndexes.values().next().value!;
      boundingBoxPalleteIndexes.delete(paletteIndex);
    } else {
      // Fall back to cycling through all styles
      paletteIndex = idx % ACCESSIBLE_BBOX_PALETTE.length;
    }
    const { color, backgroundColor, borderStyle } =
      ACCESSIBLE_BBOX_PALETTE[paletteIndex];

    const newNode = {
      id: `bbox-${box.rearrangeKey}-${Date.now()}-${idx}`,
      type: "default",
      position: { x: box.left, y: box.top },
      data: {
        label: `${box.rearrangeKey}`,
        group: box.rearrangeKey,
        isBoundingBox: true,
        boundingBoxPaletteIndex: paletteIndex,
      },
      draggable: false,
      selectable: true,
      style: {
        width: box.right - box.left,
        height: box.bottom - box.top,
        backgroundColor,
        border: `2px ${borderStyle} ${color}`,
        borderRadius: "4px",
        fontSize: "10px",
        padding: "4px",
        color,
        pointerEvents: "none" as React.CSSProperties["pointerEvents"],
        zIndex: -1,
      },
    } as FlowNode;

    if (existingDebugNode) {
      existingDebugNode.position = newNode.position;
      existingDebugNode.style = newNode.style;
    } else {
      result.push(newNode);
    }
  }

  return result;
}

/**
 * Apply calculated offsets to actual nodes
 */
export function applyOffsetsToNodes(
  nodesToOffset: FlowNode[],
  offsets: BoxOffset[],
): void {
  for (const n of nodesToOffset) {
    let offset: BoxOffset | undefined = undefined;
    for (const o of offsets) {
      if (o.rearrangeKey === (n.data.group as string)) {
        offset = o;
      }
    }
    if (offset) {
      n.position = {
        x: n.position.x + offset.x,
        y: n.position.y + offset.y,
      };
    }
  }
}

export function recalculateBoundingBoxes(
  rearrange: boolean,
  currentNodes: FlowNode[],
): FlowNode[] {
  console.log("🔄 Recalculating bounding boxes...");

  // Calculate bounding boxes around nodes
  const boxes = calculateBoundingBoxes(currentNodes, "ecore.model");

  // Rearrange
  if (rearrange) {
    const offsets = calculateAndUpdateBoundingBoxes(boxes);
    // Apply offsets to actual nodes
    applyOffsetsToNodes(currentNodes, offsets);
  }

  const newNodes = createOrUpdateBoundingBoxNodes(boxes, currentNodes);
  return currentNodes.concat(newNodes);
}
