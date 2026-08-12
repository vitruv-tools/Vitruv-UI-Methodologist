import { Edge, Node } from 'reactflow';
import { MetaModelRelationRequest } from '../../services/api';
import type { EditableFineGranularMetaModelRelation } from '../../types/FineGranularMetaModelRelation';
import { WorkspaceSnapshot } from '../../types/workspace';
import { getMetaModelSourceId } from './flowCanvasNodeLookup';

/**
 * Reduces the canvas to what the backend persists: the set of metamodels on it
 * and the reaction relations between them. Relations whose endpoints have no
 * resolvable metamodel id are dropped rather than sent as partial records.
 *
 * Fine-granular reaction edges (`type: 'fine-granular-reaction'`) are grouped
 * into their parent coarse relation's `fineGranularMetaModelRelationSet`.
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

  const fineEdges = edges.filter(edge => edge.type === 'fine-granular-reaction');
  const fineByCoarseKey = new Map<string, EditableFineGranularMetaModelRelation[]>();

  for (const edge of fineEdges) {
    const ecore = edge.data?.ecore;
    if (!ecore) continue;
    const fromModel = ecore.fromModel as string;
    const toModel = ecore.toModel as string;
    const key = `${fromModel}->${toModel}`;
    if (!fineByCoarseKey.has(key)) fineByCoarseKey.set(key, []);
    fineByCoarseKey.get(key)!.push({
      id: null,
      sourceId: ecore.eObjectSourceId,
      targetId: ecore.eObjectTargetId,
      reactionFileStorageId: edge.data?.reactionFileId,
      lowCodeReactionRequestBase: edge.data?.lowCodeReactionRequestBase,
    });
  }

  const metaModelRelationRequests: MetaModelRelationRequest[] = edges
    .filter(edge => edge.type === 'reactions')
    .map(edge => {
      const sourceId = getMetaModelSourceId(nodes, edge.source);
      const targetId = getMetaModelSourceId(nodes, edge.target);
      const reactionFileId = typeof edge.data?.reactionFileId === 'number' ? edge.data.reactionFileId : 0;

      if (typeof sourceId !== 'number' || typeof targetId !== 'number') {
        return null;
      }

      const key = `${sourceId}->${targetId}`;
      const fineSet = fineByCoarseKey.get(key);

      return {
        sourceId,
        targetId,
        reactionFileId,
        ...(fineSet?.length ? { fineGranularMetaModelRelationSet: fineSet } : {}),
      };
    })
    .filter((req): req is MetaModelRelationRequest => req !== null);

  return { metaModelIds, metaModelRelationRequests };
}
