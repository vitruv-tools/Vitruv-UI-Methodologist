import type { Edge, Node } from 'reactflow';
import { isFineGranularReactionEdge } from '../../utils/FineGranularReactionUtils';
import { resolveReactionFileId } from '../../utils/reactionFile';

/** The reaction edge (opened in the Reaction Editor) whose reaction file has the given id. */
export function findReactionEdgeByFileId(edges: readonly Edge[], reactionFileId: number): Edge | undefined {
  return edges.find(edge => (
    edge.type === 'reactions'
    && !isFineGranularReactionEdge(edge)
    && resolveReactionFileId(edge.data?.reactionFileId) === reactionFileId
  ));
}

function sameFileId(raw: unknown, fileId: number): boolean {
  return raw != null && Number(raw) === fileId;
}

/** The metamodel box whose `.ecore` or `.genmodel` file has the given id. */
export function findMetaModelNodeByFileId(nodes: readonly Node[], fileId: number): Node | undefined {
  return nodes.find(node => (
    node.type === 'ecoreFile'
    && (sameFileId(node.data?.ecoreFileId, fileId) || sameFileId(node.data?.genModelFileId, fileId))
  ));
}
