import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { LAYOUT, LAYOUT_META_MODELS, LAYOUT_REACTIONS, LAYOUT_VSUM_CIRCLE, MODELS, RELATIONS } from '../../collaboration/document';
import { diffProjectState, hasChanges, pairKey, readProjectState } from '../../collaboration/projectState';
import { buildDocument, copyOf, saveCopy } from './testDocuments';

const LOW_CODE = { id: 5, sourceId: 'a', targetId: 'b', lowCodeReactionRequestBase: { name: 'x' } };

describe('readProjectState', () => {
  it('reads the live metamodels with their names and positions', () => {
    const doc = buildDocument({
      models: [
        { id: 1, name: 'Car', x: 10, y: 20 },
        { id: 2, name: 'Brake' },
      ],
    });

    const state = readProjectState(doc);

    expect([...state.models.values()]).toEqual([
      { sourceId: 1, name: 'Car', position: { x: 10, y: 20 }, copy: copyOf(1) },
      { sourceId: 2, name: 'Brake', position: null, copy: copyOf(2) },
    ]);
  });

  it("reads the project's copy of a metamodel, and none before the server saved it", () => {
    const doc = buildDocument({
      models: [
        { id: 1, copy: { projectMetaModelId: 101, ecoreFileId: 201, genModelFileId: 301 } },
        { id: 2, copy: null },
      ],
    });
    // A metamodel a client added, without any of the copy fields.
    doc.getMap(MODELS).set('3', new Y.Map<unknown>(Object.entries({ name: 'Seat', softDeleted: false, softDeletedVia: null })));

    const { models } = readProjectState(doc);

    expect(models.get(1)?.copy).toEqual({ projectMetaModelId: 101, ecoreFileId: 201, genModelFileId: 301 });
    expect(models.get(2)?.copy).toBeUndefined();
    expect(models.get(3)?.copy).toBeUndefined();
  });

  it('leaves out soft-deleted metamodels', () => {
    const doc = buildDocument({ models: [{ id: 1 }, { id: 2, softDeleted: true }] });

    expect([...readProjectState(doc).models.keys()]).toEqual([1]);
  });

  it('reads relations between live metamodels by their pair', () => {
    const doc = buildDocument({
      models: [{ id: 1 }, { id: 2 }],
      relations: [{ backendId: 7, sourceId: 1, targetId: 2, reactionFileId: 30, fineGranular: [LOW_CODE] }],
    });

    expect(readProjectState(doc).relations.get(pairKey(1, 2))).toEqual({
      key: '7',
      sourceId: 1,
      targetId: 2,
      reactionFileId: 30,
      fineGranular: [LOW_CODE],
    });
  });

  it('leaves out soft-deleted relations and relations to a metamodel that is not live', () => {
    const doc = buildDocument({
      models: [{ id: 1 }, { id: 2 }, { id: 3, softDeleted: true }],
      relations: [
        { backendId: 7, sourceId: 1, targetId: 2, softDeleted: true },
        { backendId: 8, sourceId: 1, targetId: 3 },
        { backendId: 9, sourceId: 4, targetId: 1 },
      ],
    });

    expect(readProjectState(doc).relations.size).toBe(0);
  });

  it('shows one relation for a pair that two users added at the same time: the one the backend has', () => {
    const doc = buildDocument({
      models: [{ id: 1 }, { id: 2 }],
      relations: [
        { key: 'aaa', sourceId: 1, targetId: 2, reactionFileId: 31 },
        { key: '7', backendId: 7, sourceId: 1, targetId: 2, reactionFileId: 30 },
      ],
    });

    expect(readProjectState(doc).relations.get(pairKey(1, 2))?.key).toBe('7');
  });

  it('shows the one with a reaction file, then the smallest key, if the backend has none', () => {
    const configured = buildDocument({
      models: [{ id: 1 }, { id: 2 }],
      relations: [
        { key: 'a', sourceId: 1, targetId: 2 },
        { key: 'b', sourceId: 1, targetId: 2, reactionFileId: 31 },
      ],
    });
    const plain = buildDocument({
      models: [{ id: 1 }, { id: 2 }],
      relations: [
        { key: 'b', sourceId: 1, targetId: 2 },
        { key: 'a', sourceId: 1, targetId: 2 },
      ],
    });

    expect(readProjectState(configured).relations.get(pairKey(1, 2))?.key).toBe('b');
    expect(readProjectState(plain).relations.get(pairKey(1, 2))?.key).toBe('a');
  });

  it('keeps the two directions of a pair apart', () => {
    const doc = buildDocument({
      models: [{ id: 1 }, { id: 2 }],
      relations: [
        { backendId: 7, sourceId: 1, targetId: 2 },
        { backendId: 8, sourceId: 2, targetId: 1 },
      ],
    });

    expect([...readProjectState(doc).relations.keys()].sort()).toEqual([pairKey(1, 2), pairKey(2, 1)]);
  });

  it('reads the reaction layout', () => {
    const doc = buildDocument({ models: [{ id: 1 }] });
    (doc.getMap(LAYOUT).get(LAYOUT_REACTIONS) as Y.Map<unknown>).set('ns:car', { bbox: { x: 1, y: 2 } });

    expect(readProjectState(doc).reactionLayout).toEqual({ 'ns:car': { bbox: { x: 1, y: 2 } } });
  });

  it('copes with a document that is empty or has elements it cannot read', () => {
    const doc = new Y.Doc();
    const models = doc.getMap(MODELS);
    models.set('1', new Y.Map<unknown>([['name', 'Car']]));
    models.set('abc', new Y.Map<unknown>([['name', 'Bad key']]));
    models.set('2', 'not a map' as unknown as Y.Map<unknown>);
    doc.getMap(RELATIONS).set('x', new Y.Map<unknown>([['sourceId', '1']]));
    doc.getMap(LAYOUT).set(LAYOUT_META_MODELS, new Y.Map<unknown>([['1', { x: 'left', y: 1 }]]));

    const state = readProjectState(doc);

    expect([...state.models.values()]).toEqual([{ sourceId: 1, name: 'Car', position: null }]);
    expect(state.relations.size).toBe(0);
    expect(readProjectState(new Y.Doc()).models.size).toBe(0);
  });
});

describe('diffProjectState', () => {
  const stateOf = (models: Parameters<typeof buildDocument>[0]) => readProjectState(buildDocument(models));

  it('finds nothing if nothing changed', () => {
    const state = stateOf({ models: [{ id: 1, x: 1, y: 2 }], relations: [] });

    expect(hasChanges(diffProjectState(state, state))).toBe(false);
  });

  it('finds added, removed, renamed and moved metamodels', () => {
    const prev = stateOf({ models: [{ id: 1, name: 'Car', x: 0, y: 0 }, { id: 2, name: 'Brake', x: 5, y: 5 }, { id: 3, name: 'Wheel' }] });
    const next = stateOf({ models: [{ id: 1, name: 'Vehicle', x: 0, y: 0 }, { id: 2, name: 'Brake', x: 9, y: 9 }, { id: 4, name: 'Tire', x: 1, y: 1 }] });

    const changes = diffProjectState(prev, next);

    expect(changes.addedModels).toEqual([{ sourceId: 4, name: 'Tire', position: { x: 1, y: 1 }, copy: copyOf(4) }]);
    expect(changes.removedModels).toEqual([3]);
    expect(changes.renamedModels).toEqual([{ sourceId: 1, name: 'Vehicle' }]);
    expect(changes.movedModels).toEqual([{ sourceId: 2, position: { x: 9, y: 9 } }]);
  });

  it('finds metamodels whose copy got new files, but not one that lost its copy', () => {
    const before = buildDocument({ models: [{ id: 1, copy: null }, { id: 2 }, { id: 3 }] });
    const after = buildDocument({ models: [{ id: 1, copy: null }, { id: 2 }, { id: 3, copy: null }] });
    saveCopy(after, 1);
    saveCopy(after, 2, { ...copyOf(2), ecoreFileId: 999 });

    const changes = diffProjectState(readProjectState(before), readProjectState(after));

    expect(changes.copiedModels.map((model) => model.sourceId)).toEqual([1, 2]);
    expect(changes.copiedModels[0].copy).toEqual(copyOf(1));
    expect(hasChanges(changes)).toBe(true);
  });

  it('counts a position that appeared as a move, but not one that disappeared', () => {
    const prev = stateOf({ models: [{ id: 1 }, { id: 2, x: 1, y: 1 }] });
    const next = stateOf({ models: [{ id: 1, x: 3, y: 4 }, { id: 2 }] });

    expect(diffProjectState(prev, next).movedModels).toEqual([{ sourceId: 1, position: { x: 3, y: 4 } }]);
  });

  it('finds added, changed and removed relations', () => {
    const models = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const prev = stateOf({
      models,
      relations: [
        { backendId: 7, sourceId: 1, targetId: 2, reactionFileId: 30 },
        { backendId: 8, sourceId: 2, targetId: 3, reactionFileId: 31 },
      ],
    });
    const next = stateOf({
      models,
      relations: [
        { backendId: 7, sourceId: 1, targetId: 2, reactionFileId: 40 },
        { backendId: 9, sourceId: 3, targetId: 1, reactionFileId: 32 },
      ],
    });

    const changes = diffProjectState(prev, next);

    expect(changes.upsertedRelations.map((r) => [r.sourceId, r.targetId, r.reactionFileId])).toEqual([
      [1, 2, 40],
      [3, 1, 32],
    ]);
    expect(changes.removedRelations).toEqual([{ sourceId: 2, targetId: 3 }]);
  });

  it('finds a changed set of fine-granular mappings, regardless of the order of keys', () => {
    const models = [{ id: 1 }, { id: 2 }];
    const prev = stateOf({ models, relations: [{ backendId: 7, sourceId: 1, targetId: 2, fineGranular: [{ a: 1, b: 2 }] }] });
    const same = stateOf({ models, relations: [{ backendId: 7, sourceId: 1, targetId: 2, fineGranular: [{ b: 2, a: 1 }] }] });
    const other = stateOf({ models, relations: [{ backendId: 7, sourceId: 1, targetId: 2, fineGranular: [{ a: 1, b: 3 }] }] });

    expect(hasChanges(diffProjectState(prev, same))).toBe(false);
    expect(diffProjectState(prev, other).upsertedRelations).toHaveLength(1);
  });

  it('can leave out the mappings, to find only what the canvas shows of a relation', () => {
    const models = [{ id: 1 }, { id: 2 }];
    const prev = stateOf({ models, relations: [{ backendId: 7, sourceId: 1, targetId: 2, reactionFileId: 30, fineGranular: [{ a: 1 }] }] });
    const other = stateOf({ models, relations: [{ backendId: 7, sourceId: 1, targetId: 2, reactionFileId: 30, fineGranular: [{ a: 2 }] }] });
    const file = stateOf({ models, relations: [{ backendId: 7, sourceId: 1, targetId: 2, reactionFileId: 31, fineGranular: [{ a: 1 }] }] });

    expect(hasChanges(diffProjectState(prev, other, { compareMappings: false }))).toBe(false);
    expect(diffProjectState(prev, file, { compareMappings: false }).upsertedRelations).toHaveLength(1);
  });

  it('is not changed by a relation getting its backend ID or another key', () => {
    const models = [{ id: 1 }, { id: 2 }];
    const prev = stateOf({ models, relations: [{ key: 'uuid', backendId: null, sourceId: 1, targetId: 2, reactionFileId: 30 }] });
    const next = stateOf({ models, relations: [{ key: 'uuid', backendId: 7, sourceId: 1, targetId: 2, reactionFileId: 30 }] });

    expect(hasChanges(diffProjectState(prev, next))).toBe(false);
  });

  it('finds a changed reaction layout', () => {
    const prev = buildDocument({ models: [{ id: 1 }] });
    const next = buildDocument({ models: [{ id: 1 }] });
    (next.getMap(LAYOUT).get(LAYOUT_REACTIONS) as Y.Map<unknown>).set('ns:car', { bbox: { x: 1, y: 2 } });

    const changes = diffProjectState(readProjectState(prev), readProjectState(next));

    expect(changes.reactionLayout).toEqual({ 'ns:car': { bbox: { x: 1, y: 2 } } });
    expect(hasChanges(changes)).toBe(true);
  });
});

describe('the VSUM circle', () => {
  it('is read from the layout, and left out if it is not a valid circle', () => {
    const doc = buildDocument();
    expect(readProjectState(doc).vsumCircle).toBeNull();

    doc.getMap(LAYOUT).set(LAYOUT_VSUM_CIRCLE, { cx: 1, cy: 2, r: 300 });
    expect(readProjectState(doc).vsumCircle).toEqual({ cx: 1, cy: 2, r: 300 });

    for (const invalid of [{ cx: 1, cy: 2, r: 0 }, { cx: 'a', cy: 2, r: 300 }, { cx: 1, cy: 2 }, 5, null]) {
      doc.getMap(LAYOUT).set(LAYOUT_VSUM_CIRCLE, invalid);
      expect(readProjectState(doc).vsumCircle).toBeNull();
    }
  });

  it('is a change when it is new or different, not when it is the same or removed', () => {
    const doc = buildDocument();
    const without = readProjectState(doc);
    doc.getMap(LAYOUT).set(LAYOUT_VSUM_CIRCLE, { cx: 1, cy: 2, r: 300 });
    const first = readProjectState(doc);
    doc.getMap(LAYOUT).set(LAYOUT_VSUM_CIRCLE, { cx: 1, cy: 2, r: 400 });
    const second = readProjectState(doc);

    expect(diffProjectState(without, first).vsumCircle).toEqual({ cx: 1, cy: 2, r: 300 });
    expect(diffProjectState(first, second).vsumCircle).toEqual({ cx: 1, cy: 2, r: 400 });
    expect(hasChanges(diffProjectState(first, second))).toBe(true);
    expect(diffProjectState(second, readProjectState(doc)).vsumCircle).toBeUndefined();
    expect(diffProjectState(second, without).vsumCircle).toBeUndefined();
  });
});
