import type { Connection, Node } from 'reactflow';
import {
  extractModelFromEObjectId,
  getProperEObjectIdFromHandle,
} from '../../../utils/EcoreIdentifiers';
import { useProjectStore } from '../../../store/Project';

/**
 * Validates whether a proposed fine-granular reaction connection is allowed.
 *
 * Rules:
 *   1. Must be in reactions mode
 *   2. Both handles must resolve to EObject FQ ids
 *   3. Source and target must belong to different meta-models
 *   4. Self-connections are not allowed
 */
export function validateFineGranularConnection(
  connection: Connection,
  nodes: Node[],
): boolean {
  const { mode } = useProjectStore.getState();
  if (mode !== 'reactions') return false;

  if (!connection.sourceHandle || !connection.targetHandle) return false;

  const sourceEObjectId = getProperEObjectIdFromHandle(connection.sourceHandle);
  const targetEObjectId = getProperEObjectIdFromHandle(connection.targetHandle);
  if (!sourceEObjectId || !targetEObjectId) return false;

  if (connection.source === connection.target) return false;

  const sourceModel = extractModelFromEObjectId(sourceEObjectId);
  const targetModel = extractModelFromEObjectId(targetEObjectId);
  if (sourceModel === targetModel) return false;

  return true;
}

/**
 * Check if a connection originates from a reaction handle.
 */
export function isReactionHandleConnection(connection: Connection): boolean {
  return (
    (connection.sourceHandle?.startsWith('reaction-') ?? false) ||
    (connection.targetHandle?.startsWith('reaction-') ?? false)
  );
}
