/**
 * Expanded Mode: convert a meta-model's .ecore content into React Flow
 * nodes (EObjectNode for each class, BoundingBoxNode as group).
 *
 * Uses `ecoreToUml` for parsing (reuses existing develop pipeline) and
 * `EcoreIdentifiers` for building fully-qualified EObject IDs that the
 * reaction handle system expects.
 */

import type { Node } from 'reactflow';
import { ecoreToUml, type UMLClass } from './ecoreToUml';
import {
  buildEObjectId,
  extractNsUriFromEcore,
  extractEPackageNameFromEcore,
  deriveDisplayModelAlias,
  deriveModelAlias,
} from './EcoreIdentifiers';
import type { EObjectNodeData } from '../components/flow/lowcode/EObjectNode';
import type { BoundingBoxNodeData } from '../components/flow/lowcode/BoundingBoxNode';
import type { FlowNodeECoreData } from '../types/flow';
import { normalizeAttributeTypeDisplay } from './ecoreToUml';
import { metaModelDisplayColor } from './metaModelColors';

export interface ExpandedMetaModelResult {
  boundingBox: Node<BoundingBoxNodeData>;
  eObjectNodes: Node<EObjectNodeData>[];
  modelNsUri: string;
}

const NODE_WIDTH = 200;
const NODE_HEADER_HEIGHT = 32;
const NODE_ATTR_ROW_HEIGHT = 24;
const NODE_GAP_X = 50;
const NODE_GAP_Y = 40;
const BBOX_PADDING_TOP = 70;
const BBOX_PADDING_SIDE = 50;
const BBOX_PADDING_BOTTOM = 40;
const COLUMNS = 3;

/**
 * Expand a meta-model (.ecore file) into React Flow nodes for the canvas.
 */
export function expandMetaModelToNodes(
  ecoreContent: string,
  fileName: string,
  origin: { x: number; y: number },
  domain?: string,
  explicitColor?: string,
): ExpandedMetaModelResult | null {
  const umlModel = ecoreToUml(ecoreContent);
  if (umlModel.classes.length === 0) return null;

  const nsUri = extractNsUriFromEcore(ecoreContent) ?? fileName.replace(/\.ecore$/i, '');
  const modelLabel = fileName.replace(/\.ecore$/i, '');
  const modelAlias =
    extractEPackageNameFromEcore(ecoreContent)
    || deriveDisplayModelAlias(modelLabel)
    || deriveModelAlias(nsUri);
  const color = explicitColor || metaModelDisplayColor(domain, fileName);

  const eObjectNodes: Node<EObjectNodeData>[] = [];
  let maxX = 0;
  let maxY = 0;

  umlModel.classes.forEach((cls: UMLClass, idx: number) => {
    const col = idx % COLUMNS;
    const row = Math.floor(idx / COLUMNS);

    const nodeHeight = NODE_HEADER_HEIGHT + cls.attributes.length * NODE_ATTR_ROW_HEIGHT + 4;
    const x = BBOX_PADDING_SIDE + col * (NODE_WIDTH + NODE_GAP_X);
    const y = BBOX_PADDING_TOP + row * (nodeHeight + NODE_GAP_Y);

    const eObjectId = buildEObjectId(nsUri, cls.name);
    const ecoreData: FlowNodeECoreData = {
      model: nsUri,
      eObjectId,
      eAttributeIds: cls.attributes.map((a) => `${eObjectId}.${a.name}`),
      eReferenceIds: [],
      eOperationIds: cls.operations.map((o) => `${eObjectId}.${o.name}`),
      eAnnotationIds: [],
      eSuperTypeIds: [],
    };

    const node: Node<EObjectNodeData> = {
      id: `eobject-${nsUri}-${cls.name}`,
      type: 'eobject',
      position: { x: origin.x + x, y: origin.y + y },
      data: {
        label: modelLabel,
        className: cls.name,
        attributes: cls.attributes.map((a) => ({
          name: a.name,
          type: normalizeAttributeTypeDisplay(a.type),
          multiplicity: '1..1',
        })),
        isAbstract: cls.isAbstract,
        isInterface: cls.isInterface,
        ecore: ecoreData,
        group: `bbox-${nsUri}`,
        color,
        modelAlias,
      },
      draggable: true,
    };

    eObjectNodes.push(node);

    const nodeRight = x + NODE_WIDTH;
    const nodeBottom = y + nodeHeight;
    if (nodeRight > maxX) maxX = nodeRight;
    if (nodeBottom > maxY) maxY = nodeBottom;
  });

  const bboxWidth = Math.max(maxX + BBOX_PADDING_SIDE, 350);
  const bboxHeight = Math.max(maxY + BBOX_PADDING_BOTTOM, 250);

  const boundingBox: Node<BoundingBoxNodeData> = {
    id: `bbox-${nsUri}`,
    type: 'boundingBox',
    position: origin,
    data: {
      label: modelLabel,
      color,
      domain,
      nsUri,
      isBoundingBox: true,
      width: bboxWidth,
      height: bboxHeight,
    },
    style: { width: bboxWidth, height: bboxHeight, zIndex: -1 },
    draggable: true,
    selectable: true,
  };

  return { boundingBox, eObjectNodes, modelNsUri: nsUri };
}

/**
 * Compute a non-overlapping origin for a new bounding box given existing ones.
 */
export function nextBoundingBoxOrigin(
  existingNodes: Node[],
): { x: number; y: number } {
  const bboxes = existingNodes.filter((n) => n.type === 'boundingBox');
  if (bboxes.length === 0) return { x: 50, y: 50 };

  let maxRight = 0;
  for (const bb of bboxes) {
    const w = (bb.style as any)?.width ?? 400;
    const right = bb.position.x + (typeof w === 'number' ? w : 400);
    if (right > maxRight) maxRight = right;
  }

  return { x: maxRight + 60, y: 50 };
}

/**
 * Tight bounding-box rect around EObject children (absolute positions).
 */
export function computeBoundingBoxRect(
  children: Array<{ position: { x: number; y: number }; data?: { attributes?: unknown[] } }>,
): { x: number; y: number; width: number; height: number } | null {
  if (children.length === 0) return null;

  const PADDING = 30;
  const HEADER_HEIGHT = 70;
  const NODE_W = 200;

  let minX = Infinity;
  let minY = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;

  for (const child of children) {
    const ch = 32 + (child.data?.attributes?.length ?? 0) * 24 + 4;
    if (child.position.x < minX) minX = child.position.x;
    if (child.position.y < minY) minY = child.position.y;
    const right = child.position.x + NODE_W;
    const bottom = child.position.y + ch;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  return {
    x: minX - PADDING,
    y: minY - HEADER_HEIGHT,
    width: Math.max(maxRight - minX + PADDING * 2, 200),
    height: Math.max(maxBottom - minY + HEADER_HEIGHT + PADDING, 120),
  };
}

