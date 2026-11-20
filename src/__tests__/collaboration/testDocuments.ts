import * as Y from 'yjs';
import { LAYOUT, LAYOUT_META_MODELS, LAYOUT_REACTIONS, MODELS, NOT_DELETED, RELATIONS, STATUS } from '../../collaboration/document';

export interface TestModel {
  id: number;
  name?: string;
  x?: number;
  y?: number;
  softDeleted?: boolean;
}

export interface TestRelation {
  /** Key in the document; defaults to the backend ID. */
  key?: string;
  backendId?: number | null;
  sourceId: number;
  targetId: number;
  reactionFileId?: number | null;
  fineGranular?: Record<string, unknown>[];
  softDeleted?: boolean;
  softDeletedVia?: string | null;
}

/** Builds a document like the one the collaboration server fills from the backend. */
export function buildDocument(
  { models = [], relations = [], epoch = 'epoch-1' }: { models?: TestModel[]; relations?: TestRelation[]; epoch?: string } = {},
): Y.Doc {
  const doc = new Y.Doc();
  doc.transact(() => {
    const modelMap = doc.getMap(MODELS);
    const positions = new Y.Map<unknown>();
    doc.getMap(LAYOUT).set(LAYOUT_META_MODELS, positions);
    doc.getMap(LAYOUT).set(LAYOUT_REACTIONS, new Y.Map<unknown>());
    for (const model of models) {
      modelMap.set(
        String(model.id),
        new Y.Map<unknown>(Object.entries({ name: model.name ?? `Model ${model.id}`, ...NOT_DELETED, softDeleted: model.softDeleted ?? false })),
      );
      if (model.x !== undefined && model.y !== undefined) {
        positions.set(String(model.id), { x: model.x, y: model.y });
      }
    }
    const relationMap = doc.getMap(RELATIONS);
    for (const relation of relations) {
      const key = relation.key ?? String(relation.backendId);
      relationMap.set(
        key,
        new Y.Map<unknown>(
          Object.entries({
            backendId: relation.backendId ?? null,
            sourceId: relation.sourceId,
            targetId: relation.targetId,
            reactionFileId: relation.reactionFileId ?? null,
            fineGranular: relation.fineGranular ?? [],
            softDeleted: relation.softDeleted ?? false,
            softDeletedVia: relation.softDeletedVia ?? null,
          }),
        ),
      );
    }
    doc.getMap(STATUS).set('writebackError', null);
    doc.getMap(STATUS).set('epoch', epoch);
  }, 'server');
  return doc;
}

/** Copies the whole state of `from` into `to`, like a client that syncs with the server. */
export function sync(from: Y.Doc, to: Y.Doc, origin: unknown = 'remote'): void {
  Y.applyUpdate(to, Y.encodeStateAsUpdate(from, Y.encodeStateVector(to)), origin);
}
