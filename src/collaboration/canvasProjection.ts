import type { Node } from 'reactflow';
import type { MetaModelRelationRequest } from '../services/api';
import { pairKey, type ModelState, type ProjectState, type RelationState } from './projectState';

export interface CanvasProjectionInput {
  nodes: Node[];
  /**
   * The relations of the canvas as the sync request has them (`prepareSnapshotForSyncSave`), or
   * `null` if there are none.
   */
  relationRequests: MetaModelRelationRequest[] | null;
  /** Layout of the reaction editor, as the canvas keeps it. */
  reactionLayout: Record<string, unknown>;
}

/**
 * Describes the canvas in the terms of the shared document: its metamodels and the relations
 * between them. Metamodels are keyed by library ID, like in the document; the canvas has no
 * document keys for relations, so those are empty.
 *
 * A metamodel that is being dragged has the position it is at now, so that others see it move.
 */
export function projectCanvasState({ nodes, relationRequests, reactionLayout }: CanvasProjectionInput): ProjectState {
  const models = new Map<number, ModelState>();
  for (const node of nodes) {
    if (node.type !== 'ecoreFile') {
      continue;
    }
    const sourceId = metaModelId(node);
    if (sourceId === undefined || models.has(sourceId)) {
      continue;
    }
    models.set(sourceId, {
      sourceId,
      name: titleOf(node),
      position: { x: node.position.x, y: node.position.y },
    });
  }

  const relations = new Map<string, RelationState>();
  for (const request of relationRequests ?? []) {
    if (!models.has(request.sourceId) || !models.has(request.targetId)) {
      continue;
    }
    relations.set(pairKey(request.sourceId, request.targetId), {
      key: '',
      sourceId: request.sourceId,
      targetId: request.targetId,
      reactionFileId: request.reactionFileId ?? null,
      fineGranular: (request.fineGranularMetaModelRelationSet ?? []) as unknown as Record<string, unknown>[],
    });
  }

  return { models, relations, reactionLayout };
}

/** The ID the canvas keys a metamodel by: the library ID, else the ID of the metamodel itself. */
function metaModelId(node: Node): number | undefined {
  const id = node.data?.metaModelSourceId ?? node.data?.metaModelId;
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

/** The title the box shows: the name in the project, else its file name without the extension. */
function titleOf(node: Node): string {
  const displayName = node.data?.displayName;
  if (typeof displayName === 'string' && displayName !== '') {
    return displayName;
  }
  const fileName = node.data?.fileName;
  return typeof fileName === 'string' ? fileName.replace(/\.ecore$/i, '') : '';
}
