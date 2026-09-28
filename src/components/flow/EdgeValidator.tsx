import type { Connection, Node, Edge } from 'reactflow';
import {
  isReactionHandleConnection,
  validateFineGranularConnection,
} from './lowcode/LowCodeReactionEdgeValidator';

/**
 * Shared edge connection validator.
 *
 * Delegates to specialized validators based on handle type.
 * Used as the `isValidConnection` callback in React Flow.
 */
export function isValidConnection(
  connection: Connection,
  nodes: Node[],
  edges: Edge[],
): boolean {
  if (isReactionHandleConnection(connection)) {
    return validateFineGranularConnection(connection, nodes);
  }

  // Default: allow all non-reaction connections
  // (develop's existing UML/coarse validation stays in FlowCanvas)
  return true;
}
