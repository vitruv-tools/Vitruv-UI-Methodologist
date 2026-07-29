import { Edge, Node } from 'reactflow';
import { MetaModelRelationRequest } from '../../services/api';
import { WorkspaceSnapshot } from '../../types/workspace';
import { getMetaModelSourceId } from './flowCanvasNodeLookup';

/**
 * Reduces the canvas to what the backend persists: the set of metamodels on it
 * and the reaction relations between them. Relations whose endpoints have no
 * resolvable metamodel id are dropped rather than sent as partial records.
 */
export function buildWorkspaceSnapshot(nodes: Node[], edges: Edge[]): WorkspaceSnapshot {
  const metaModelIds = Array.from(
    new Set(
      nodes
        .filter(node => node.type === 'ecoreFile')
        .map(node => getMetaModelSourceId(nodes, node.id))
        .filter((value): value is number => typeof value === 'number'),
    ),
  );

  const metaModelRelationRequests: MetaModelRelationRequest[] = edges
    .filter(edge => edge.type === 'reactions')
    .map(edge => {
      const sourceId = getMetaModelSourceId(nodes, edge.source);
      const targetId = getMetaModelSourceId(nodes, edge.target);
      const reactionFileId = typeof edge.data?.reactionFileId === 'number' ? edge.data.reactionFileId : 0;

      if (typeof sourceId !== 'number' || typeof targetId !== 'number') {
        return null;
      }

      return { sourceId, targetId, reactionFileId };
    })
    .filter((req): req is MetaModelRelationRequest => req !== null);

  return { metaModelIds, metaModelRelationRequests };
}
