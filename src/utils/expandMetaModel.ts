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
  ghostNodeId,
  midpointForEobjectPair,
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
const NODE_GAP_X = 50;
const NODE_GAP_Y = 40;
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
  const nodeByClassId = new Map<string, Node<EObjectNodeData>>();
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
    nodeByClassId.set(cls.id, node);

    const nodeRight = x + NODE_WIDTH;
    const nodeBottom = y + nodeHeight;
    if (nodeRight > maxX) maxX = nodeRight;
    if (nodeBottom > maxY) maxY = nodeBottom;
  });

  const classById = new Map(umlModel.classes.map(cls => [cls.id, cls]));
  const umlEdges: Edge[] = [];
  const ghostNodes: Node[] = [];
  const bboxId = `bbox-${nsUri}`;

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
      id: eReferenceId ? `uml-ref-${eReferenceId}` : `uml-${nsUri}-${rel.id}`,
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
      ghostNodes.push(createGhostNode(ghostNodeId(eReferenceId), mid.x, mid.y, {
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
      isBoundingBox: true,
      width: bboxWidth,
      height: bboxHeight,
    },
    style: { width: bboxWidth, height: bboxHeight, zIndex: -1 },
    draggable: true,
    selectable: true,
  };

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

