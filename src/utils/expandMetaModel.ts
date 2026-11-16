/**
 * Expanded Mode: convert a meta-model's .ecore content into React Flow
 * nodes (EObjectNode for each class, BoundingBoxNode as group).
 *
 * Uses `ecoreToUml` for parsing (reuses existing develop pipeline) and
 * `EcoreIdentifiers` for building fully-qualified EObject IDs that the
 * reaction handle system expects.
 */

import type { Edge, Node } from 'reactflow';
import { ecoreToUml, type UMLClass, type UMLRelType } from './ecoreToUml';
import {
  buildEObjectId,
  buildEObjectFeatureId,
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
import {
  createGhostNode,
  midpointForEobjectPair,
  ghostPositionChanges,
} from './FineGranularReactionUtils';

export interface ExpandedMetaModelResult {
  boundingBox: Node<BoundingBoxNodeData>;
  eObjectNodes: Node<EObjectNodeData>[];
  umlEdges: Edge[];
  ghostNodes: Node[];
  modelNsUri: string;
}

const NODE_WIDTH = 200;
const NODE_HEADER_HEIGHT = 32;
const NODE_ATTR_ROW_HEIGHT = 24;
const NODE_GAP_X = 100;
const NODE_GAP_Y = 90;
const BBOX_PADDING_TOP = 70;
const BBOX_PADDING_SIDE = 50;
const BBOX_PADDING_BOTTOM = 40;
const COLUMNS = 3;

function chooseUmlHandles(
  source: Node,
  target: Node,
): { sourceHandle: string; targetHandle: string } {
  const dx = target.position.x - source.position.x;
  const dy = target.position.y - source.position.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'right-source', targetHandle: 'left-target' }
      : { sourceHandle: 'left-source', targetHandle: 'right-target' };
  }
  return dy >= 0
    ? { sourceHandle: 'bottom-source', targetHandle: 'top-target' }
    : { sourceHandle: 'top-source', targetHandle: 'bottom-target' };
}

function umlRelationshipType(type: UMLRelType): string {
  if (type === 'composition') return 'composition';
  if (type === 'inheritance') return 'inheritance';
  return 'association';
}

function expandedClassGrid(classes: UMLClass[]) {
  // A row starts below the tallest class in the preceding row.
  const widths = classes.map(cls => Math.max(NODE_WIDTH,
    60 + Math.max(cls.name.length + (cls.isAbstract || cls.isInterface ? 14 : 0),
      ...cls.attributes.map(a => `${a.name}: ${normalizeAttributeTypeDisplay(a.type)} [1..1]`.length)) * 7));
  const heights = classes.map(cls => NODE_HEADER_HEIGHT + cls.attributes.length * NODE_ATTR_ROW_HEIGHT + 4);
  const columnWidths = Array.from({ length: COLUMNS }, (_, col) =>
    Math.max(NODE_WIDTH, ...widths.filter((_, idx) => idx % COLUMNS === col)));
  const rowTops: number[] = [];
  for (let idx = 0, top = BBOX_PADDING_TOP; idx < heights.length; idx += COLUMNS) {
    rowTops.push(top);
    top += Math.max(...heights.slice(idx, idx + COLUMNS)) + NODE_GAP_Y;
  }
  return { widths, heights, columnWidths, rowTops };
}

function alignAssociationGhosts(eObjectNodes: Node[], ghostNodes: Node[], umlEdges: Edge[]): void {
  for (const change of ghostPositionChanges([...eObjectNodes, ...ghostNodes], umlEdges)) {
    const ghost = ghostNodes.find(node => node.id === change.id);
    if (ghost) ghost.position = change.position;
  }
}

/**
 * Expand a meta-model (.ecore file) into React Flow nodes for the canvas.
 */
export function expandMetaModelToNodes(
  ecoreContent: string,
  fileName: string,
  origin: { x: number; y: number },
  domain?: string,
  explicitColor?: string,
  /**
   * Canvas node id of the ecore box being expanded. Two versions of one
   * package share an nsURI, so React Flow ids must use this instead.
   */
  instanceKey?: string,
): ExpandedMetaModelResult | null {
  const umlModel = ecoreToUml(ecoreContent);
  if (umlModel.classes.length === 0) return null;

  const nsUri = extractNsUriFromEcore(ecoreContent) ?? fileName.replace(/\.ecore$/i, '');
  const canvasKey = instanceKey?.trim() || nsUri;
  const modelLabel = fileName.replace(/\.ecore$/i, '');
  const modelAlias =
    extractEPackageNameFromEcore(ecoreContent)
    || deriveDisplayModelAlias(modelLabel)
    || deriveModelAlias(nsUri);
  const color = explicitColor || metaModelDisplayColor(domain, fileName);

  const eObjectNodes: Node<EObjectNodeData>[] = [];
  const nodeByClassId = new Map<string, Node<EObjectNodeData>>();
  let maxX = 0;
  let maxY = 0;

  const { widths, heights, columnWidths, rowTops } = expandedClassGrid(umlModel.classes);

  umlModel.classes.forEach((cls: UMLClass, idx: number) => {
    const col = idx % COLUMNS;
    const row = Math.floor(idx / COLUMNS);

    const nodeHeight = heights[idx];
    const nodeWidth = widths[idx];
    const x = BBOX_PADDING_SIDE + columnWidths.slice(0, col).reduce((sum, width) => sum + width + NODE_GAP_X, 0);
    const y = rowTops[row];

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
      id: `eobject-${canvasKey}-${cls.name}`,
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
        group: `bbox-${canvasKey}`,
        color,
        modelAlias,
      },
      draggable: true,
      style: { width: nodeWidth },
    };

    eObjectNodes.push(node);
    nodeByClassId.set(cls.id, node);

    const nodeRight = x + nodeWidth;
    const nodeBottom = y + nodeHeight;
    if (nodeRight > maxX) maxX = nodeRight;
    if (nodeBottom > maxY) maxY = nodeBottom;
  });

  const classById = new Map(umlModel.classes.map(cls => [cls.id, cls]));
  const umlEdges: Edge[] = [];
  const ghostNodes: Node[] = [];
  const bboxId = `bbox-${canvasKey}`;

  for (const rel of umlModel.relationships) {
    const sourceNode = nodeByClassId.get(rel.sourceId);
    const targetNode = nodeByClassId.get(rel.targetId);
    const sourceClass = classById.get(rel.sourceId);
    if (!sourceNode || !targetNode || !sourceClass) continue;

    const handles = chooseUmlHandles(sourceNode, targetNode);
    const isReference = rel.type === 'association' || rel.type === 'composition';
    const eReferenceId = isReference
      ? buildEObjectFeatureId(nsUri, sourceClass.name, rel.label || rel.id)
      : undefined;

    if (eReferenceId) {
      sourceNode.data.ecore.eReferenceIds.push(eReferenceId);
    }

    umlEdges.push({
      id: eReferenceId ? `uml-ref-${canvasKey}-${eReferenceId}` : `uml-${canvasKey}-${rel.id}`,
      source: sourceNode.id,
      target: targetNode.id,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      type: 'uml',
      data: {
        relationshipType: umlRelationshipType(rel.type),
        label: rel.label,
        sourceMultiplicity: rel.sourceMultiplicity,
        targetMultiplicity: rel.targetMultiplicity,
        expandedIntraModel: true,
        ...(eReferenceId
          ? {
              ecore: {
                eReferenceId,
                eObjectSourceId: sourceNode.data.ecore.eObjectId,
                eObjectTargetId: targetNode.data.ecore.eObjectId,
                fromModel: nsUri,
                toModel: nsUri,
              },
            }
          : {}),
      },
    });

    if (eReferenceId) {
      const mid = midpointForEobjectPair(
        sourceNode,
        targetNode,
        handles.sourceHandle,
        handles.targetHandle,
      );
      ghostNodes.push(createGhostNode(`ghost-${canvasKey}-${eReferenceId}`, mid.x, mid.y, {
        label: rel.label,
        group: bboxId,
        ecore: {
          model: nsUri,
          eObjectId: eReferenceId,
          eAttributeIds: [],
          eReferenceIds: [],
          eOperationIds: [],
          eAnnotationIds: [],
          eSuperTypeIds: [],
        },
      }));
    }
  }

  const bboxWidth = Math.max(maxX + BBOX_PADDING_SIDE, 350);
  const bboxHeight = Math.max(maxY + BBOX_PADDING_BOTTOM, 250);

  const boundingBox: Node<BoundingBoxNodeData> = {
    id: bboxId,
    type: 'boundingBox',
    position: origin,
    data: {
      label: modelLabel,
      color,
      domain,
      nsUri,
      ownerNodeId: instanceKey?.trim() || undefined,
      isBoundingBox: true,
      width: bboxWidth,
      height: bboxHeight,
    },
    style: { width: bboxWidth, height: bboxHeight, zIndex: 0 },
    draggable: true,
    selectable: true,
  };

  alignAssociationGhosts(eObjectNodes, ghostNodes, umlEdges);
  return { boundingBox, eObjectNodes, umlEdges, ghostNodes, modelNsUri: nsUri };
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
  children: Array<{ position: { x: number; y: number }; width?: number | null; height?: number | null; style?: { width?: string | number }; data?: { attributes?: unknown[] } }>,
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
    const ch = child.height ?? 32 + (child.data?.attributes?.length ?? 0) * 24 + 4;
    const cw = child.width ?? (typeof child.style?.width === 'number' ? child.style.width : NODE_W);
    if (child.position.x < minX) minX = child.position.x;
    if (child.position.y < minY) minY = child.position.y;
    const right = child.position.x + cw;
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

