import type { Edge, Node } from 'reactflow';
import { canonicalJson } from '../../collaboration/projectState';
import type { Position } from '../../collaboration/document';
import type { EditableVsumMetaModelRelation } from '../../types/EditableVsumDetails';
import { parseFineGranularRelationSet } from '../../utils/workspaceSnapshotUtils';

/*
 * How changes of other users in the shared project are shown on the canvas. These are the pure
 * parts: each takes the nodes and edges (or the Low Code store's relations) and returns the new
 * ones, or the same array if nothing changes, so that nothing re-renders for no reason.
 *
 * Metamodels are identified like the shared document does: by the library ID in `metaModelSourceId`,
 * or by `metaModelId` for a box that has none.
 */

/** The library ID a box is keyed by in the shared document. */
export function metaModelDocumentId(node: Node): number | undefined {
  const id = node.data?.metaModelSourceId ?? node.data?.metaModelId;
  return typeof id === 'number' ? id : undefined;
}

function findBox(nodes: Node[], sourceId: number): Node | undefined {
  return nodes.find((node) => node.type === 'ecoreFile' && metaModelDocumentId(node) === sourceId);
}

/** The namespace a bounding box of the reaction view was made for. */
function boundingBoxNsUri(node: Node): string | undefined {
  const nsUri = node.data?.nsUri;
  if (typeof nsUri === 'string' && nsUri !== '') {
    return nsUri;
  }
  return node.id.startsWith('bbox-') ? node.id.slice('bbox-'.length) : undefined;
}

/**
 * Removes the box of a metamodel with the edges that end at it. A metamodel that is expanded in the
 * reaction view is removed completely: its bounding box and the nodes inside it.
 */
export function removeMetaModelFromCanvas(
  nodes: Node[],
  edges: Edge[],
  sourceId: number,
): { nodes: Node[]; edges: Edge[] } {
  const boxes = nodes.filter((node) => node.type === 'ecoreFile' && metaModelDocumentId(node) === sourceId);
  if (boxes.length === 0) {
    return { nodes, edges };
  }
  const removed = new Set(boxes.map((box) => box.id));
  const nsUris = new Set(boxes.map((box) => box.data?.nsUri).filter((nsUri): nsUri is string => typeof nsUri === 'string'));
  const boundingBoxes = nodes.filter((node) => node.type === 'boundingBox' && nsUris.has(boundingBoxNsUri(node) ?? ''));
  for (const boundingBox of boundingBoxes) {
    removed.add(boundingBox.id);
  }
  for (const node of nodes) {
    if (boundingBoxes.some((boundingBox) => boundingBox.id === node.data?.group)) {
      removed.add(node.id);
    }
  }
  return {
    nodes: nodes.filter((node) => !removed.has(node.id)),
    edges: edges.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target)),
  };
}

/** Moves the boxes of metamodels. A box the user is dragging stays where the user has it. */
export function moveMetaModelBoxes(nodes: Node[], positions: ReadonlyMap<number, Position>): Node[] {
  let changed = false;
  const moved = nodes.map((node) => {
    const id = node.type === 'ecoreFile' ? metaModelDocumentId(node) : undefined;
    const position = id === undefined ? undefined : positions.get(id);
    if (position === undefined || node.dragging || (node.position.x === position.x && node.position.y === position.y)) {
      return node;
    }
    changed = true;
    return { ...node, position: { x: position.x, y: position.y } };
  });
  return changed ? moved : nodes;
}

/**
 * Shows a relation as the reaction edge between the boxes of its two metamodels: changes the
 * reaction file of the edge the pair has, or adds an edge made by `createEdge`. Nothing happens
 * while a box is missing, e.g. because it is still being added.
 */
export function upsertReactionEdge(
  nodes: Node[],
  edges: Edge[],
  relation: { sourceId: number; targetId: number; reactionFileId: number | null },
  createEdge: (source: Node, target: Node, data: { reactionFileId: number | null }) => Edge,
): Edge[] {
  const source = findBox(nodes, relation.sourceId);
  const target = findBox(nodes, relation.targetId);
  if (source === undefined || target === undefined) {
    return edges;
  }
  const existing = edges.find((edge) => edge.type === 'reactions' && edge.source === source.id && edge.target === target.id);
  if (existing === undefined) {
    return [...edges, createEdge(source, target, { reactionFileId: relation.reactionFileId })];
  }
  if ((existing.data?.reactionFileId ?? null) === relation.reactionFileId) {
    return edges;
  }
  return edges.map((edge) =>
    edge === existing ? { ...edge, data: { ...edge.data, reactionFileId: relation.reactionFileId } } : edge,
  );
}

/** Removes the reaction edge from one metamodel to another. */
export function removeReactionEdge(nodes: Node[], edges: Edge[], sourceId: number, targetId: number): Edge[] {
  const source = findBox(nodes, sourceId);
  const target = findBox(nodes, targetId);
  if (source === undefined || target === undefined) {
    return edges;
  }
  const remaining = edges.filter((edge) => !(edge.type === 'reactions' && edge.source === source.id && edge.target === target.id));
  return remaining.length === edges.length ? edges : remaining;
}

/** A relation as the shared document has it. */
export interface SharedRelation {
  sourceId: number;
  targetId: number;
  reactionFileId: number | null;
  /** The mappings as plain JSON, in the form the backend uses. */
  fineGranular: Record<string, unknown>[];
}

/**
 * Brings a relation of the shared document into the relations of the Low Code store, which the
 * reaction editor and the reaction view read the mappings from.
 */
export function applyRelationToStore(
  relations: EditableVsumMetaModelRelation[],
  relation: SharedRelation,
): EditableVsumMetaModelRelation[] {
  const mappings = parseFineGranularRelationSet(relation.fineGranular);
  const existing = relations.find((r) => r.sourceId === relation.sourceId && r.targetId === relation.targetId);
  if (existing === undefined) {
    return [
      ...relations,
      {
        id: 0,
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        reactionFileId: relation.reactionFileId,
        reactionFileStorageId: relation.reactionFileId,
        fineGranularMetaModelRelationSet: mappings,
      },
    ];
  }
  if (
    existing.reactionFileId === relation.reactionFileId &&
    canonicalJson(existing.fineGranularMetaModelRelationSet) === canonicalJson(mappings)
  ) {
    return relations;
  }
  return relations.map((r) =>
    r === existing
      ? {
          ...r,
          reactionFileId: relation.reactionFileId,
          reactionFileStorageId: relation.reactionFileId,
          fineGranularMetaModelRelationSet: mappings,
        }
      : r,
  );
}

/** Removes a relation from the relations of the Low Code store. */
export function removeRelationFromStore(
  relations: EditableVsumMetaModelRelation[],
  sourceId: number,
  targetId: number,
): EditableVsumMetaModelRelation[] {
  const remaining = relations.filter((r) => !(r.sourceId === sourceId && r.targetId === targetId));
  return remaining.length === relations.length ? relations : remaining;
}
