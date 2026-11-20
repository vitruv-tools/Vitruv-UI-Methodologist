import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { LAYOUT, LAYOUT_META_MODELS, LAYOUT_REACTIONS, MODELS, RELATIONS } from '../../collaboration/document';
import { LOCAL_ORIGIN, ProjectDocument } from '../../collaboration/projectDocument';
import { pairKey, type ProjectChanges, type ProjectState } from '../../collaboration/projectState';
import { buildDocument, sync } from './testDocuments';

const LOW_CODE = { id: 5, sourceId: 'a', targetId: 'b', lowCodeReactionRequestBase: { name: 'x' } };

/** A project with three metamodels, and one relation between the first two. */
function project() {
  return new ProjectDocument(
    buildDocument({
      models: [
        { id: 1, name: 'Car', x: 0, y: 0 },
        { id: 2, name: 'Brake', x: 100, y: 0 },
        { id: 3, name: 'Wheel', x: 200, y: 0 },
      ],
      relations: [{ backendId: 7, sourceId: 1, targetId: 2, reactionFileId: 30 }],
    }),
  );
}

const model = (p: ProjectDocument, id: number) => p.doc.getMap(MODELS).get(String(id)) as Y.Map<unknown>;
const relationMaps = (p: ProjectDocument) => [...p.doc.getMap(RELATIONS).entries()] as [string, Y.Map<unknown>][];

describe('adding a metamodel', () => {
  it('adds it with its name and position', () => {
    const p = project();

    p.addModel({ sourceId: 4, name: 'Tire', position: { x: 5, y: 6 } });

    expect(model(p, 4).toJSON()).toEqual({ name: 'Tire', softDeleted: false, softDeletedVia: null });
    expect(p.read().models.get(4)).toEqual({ sourceId: 4, name: 'Tire', position: { x: 5, y: 6 } });
  });

  it('brings back a metamodel that was deleted, with its new name and position', () => {
    const p = project();
    p.removeModel(3);

    p.addModel({ sourceId: 3, name: 'Wheel 2', position: { x: 7, y: 8 } });

    expect(p.read().models.get(3)).toEqual({ sourceId: 3, name: 'Wheel 2', position: { x: 7, y: 8 } });
    expect(model(p, 3).get('softDeletedVia')).toBeNull();
  });

  it('keeps a metamodel that is there as it is', () => {
    const p = project();
    const before = model(p, 1);

    p.addModel({ sourceId: 1, name: 'Car', position: { x: 0, y: 0 } });

    expect(model(p, 1)).toBe(before);
  });
});

describe('deleting a metamodel', () => {
  it('only marks it as deleted, and takes its relations along', () => {
    const p = project();

    p.removeModel(2);

    expect(model(p, 2).toJSON()).toEqual({ name: 'Brake', softDeleted: true, softDeletedVia: null });
    const relation = relationMaps(p)[0][1];
    expect(relation.get('softDeleted')).toBe(true);
    expect(relation.get('softDeletedVia')).toBe('2');
    expect(p.read().models.has(2)).toBe(false);
    expect(p.read().relations.size).toBe(0);
  });

  it('keeps the reason of a relation that was deleted before', () => {
    const p = project();
    p.removeRelation(1, 2);

    p.removeModel(2);

    expect(relationMaps(p)[0][1].get('softDeletedVia')).toBeNull();
  });

  it('does nothing for a metamodel that is not there', () => {
    const p = project();
    const before = Y.encodeStateAsUpdate(p.doc);

    p.removeModel(99);

    expect(Y.encodeStateAsUpdate(p.doc)).toEqual(before);
  });
});

describe('renaming and moving', () => {
  it('renames a metamodel', () => {
    const p = project();

    p.renameModel(1, 'Vehicle');

    expect(p.read().models.get(1)?.name).toBe('Vehicle');
  });

  it('moves metamodels, and changes only the positions that differ', () => {
    const p = project();
    const changed: string[] = [];
    (p.doc.getMap(LAYOUT).get(LAYOUT_META_MODELS) as Y.Map<unknown>).observe((event) => changed.push(...event.keysChanged));

    p.moveModels(new Map([[1, { x: 0, y: 0 }], [2, { x: 150, y: 20 }]]));

    expect(changed).toEqual(['2']);
    expect(p.read().models.get(2)?.position).toEqual({ x: 150, y: 20 });
  });
});

describe('relations', () => {
  it('adds a relation with a new key and no backend ID', () => {
    const p = project();

    p.upsertRelation({ sourceId: 2, targetId: 3, reactionFileId: null });

    const added = relationMaps(p).find(([key]) => key !== '7')!;
    expect(added[1].toJSON()).toEqual({
      backendId: null,
      sourceId: 2,
      targetId: 3,
      reactionFileId: null,
      fineGranular: [],
      softDeleted: false,
      softDeletedVia: null,
    });
    expect(p.read().relations.get(pairKey(2, 3))?.key).toBe(added[0]);
  });

  it('updates the reaction file and mappings of the relation the pair has, keeping its key', () => {
    const p = project();

    p.upsertRelation({ sourceId: 1, targetId: 2, reactionFileId: 31, fineGranular: [LOW_CODE] });

    expect(relationMaps(p)).toHaveLength(1);
    expect(p.read().relations.get(pairKey(1, 2))).toEqual({
      key: '7',
      sourceId: 1,
      targetId: 2,
      reactionFileId: 31,
      fineGranular: [LOW_CODE],
    });
  });

  it('keeps the mappings if the update brings none', () => {
    const p = project();
    p.upsertRelation({ sourceId: 1, targetId: 2, reactionFileId: 30, fineGranular: [LOW_CODE] });

    p.upsertRelation({ sourceId: 1, targetId: 2, reactionFileId: 32 });

    expect(p.read().relations.get(pairKey(1, 2))?.fineGranular).toEqual([LOW_CODE]);
  });

  it('writes nothing if the relation is as it was, also if only the order of keys differs', () => {
    const p = project();
    p.upsertRelation({ sourceId: 1, targetId: 2, reactionFileId: 30, fineGranular: [{ a: 1, b: 2 }] });
    const before = Y.encodeStateAsUpdate(p.doc);

    p.upsertRelation({ sourceId: 1, targetId: 2, reactionFileId: 30, fineGranular: [{ b: 2, a: 1 }] });

    expect(Y.encodeStateAsUpdate(p.doc)).toEqual(before);
  });

  it('adds a new relation for a pair whose relation was deleted, instead of bringing the old one back', () => {
    const p = project();
    p.removeRelation(1, 2);

    p.upsertRelation({ sourceId: 1, targetId: 2, reactionFileId: 33 });

    expect(relationMaps(p)).toHaveLength(2);
    expect(relationMaps(p).find(([key]) => key === '7')![1].get('softDeleted')).toBe(true);
    expect(p.read().relations.get(pairKey(1, 2))?.reactionFileId).toBe(33);
  });

  it('deletes the relation of a pair, only marking it', () => {
    const p = project();

    p.removeRelation(1, 2);

    expect(relationMaps(p)[0][1].toJSON()).toMatchObject({ softDeleted: true, softDeletedVia: null });
    expect(p.read().relations.size).toBe(0);
  });
});

describe('reaction layout', () => {
  it('sets entries, and removes those given as undefined', () => {
    const p = project();
    p.setReactionLayout({ 'ns:car': { bbox: { x: 1, y: 2 } }, 'ns:brake': { bbox: { x: 3, y: 4 } } });

    p.setReactionLayout({ 'ns:car': undefined, 'ns:wheel': { bbox: { x: 5, y: 6 } } });

    expect(p.read().reactionLayout).toEqual({
      'ns:brake': { bbox: { x: 3, y: 4 } },
      'ns:wheel': { bbox: { x: 5, y: 6 } },
    });
  });
});

describe('a document that is not loaded', () => {
  it('is not written to: without the maps the server creates, clients must not create them', () => {
    const p = new ProjectDocument(new Y.Doc());
    const updates: unknown[] = [];
    p.doc.on('update', (update: Uint8Array) => updates.push(update));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    p.addModel({ sourceId: 1, name: 'Car', position: { x: 0, y: 0 } });
    p.moveModels(new Map([[1, { x: 1, y: 1 }]]));
    p.setReactionLayout({ a: 1 });

    expect(p.isLoaded()).toBe(false);
    expect(updates).toEqual([]);
    expect(p.read().models.size).toBe(0);
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it('is loaded once the server created the layout maps', () => {
    expect(project().isLoaded()).toBe(true);
  });
});

describe('changes of other users', () => {
  /** Alice and Bob have the same document; Bob listens. */
  function twoUsers() {
    const alice = project();
    const bob = new ProjectDocument(new Y.Doc());
    sync(alice.doc, bob.doc, 'server');
    const received: ProjectChanges[] = [];
    const stop = bob.onRemoteChange((changes) => received.push(changes)).stop;
    return { alice, bob, received, stop };
  }

  it('are reported with the whole state they lead to', () => {
    const { alice, bob } = twoUsers();
    const states: ProjectState[] = [];
    bob.onRemoteChange((_changes, state) => states.push(state));

    alice.renameModel(1, 'Vehicle');
    sync(alice.doc, bob.doc);

    expect(states).toHaveLength(1);
    expect(states[0].models.get(1)?.name).toBe('Vehicle');
    expect(states[0].models.size).toBe(3);
  });

  it('are reported as what changed, when they arrive', () => {
    const { alice, bob, received } = twoUsers();

    alice.addModel({ sourceId: 4, name: 'Tire', position: { x: 1, y: 2 } });
    alice.moveModels(new Map([[1, { x: 9, y: 9 }]]));
    sync(alice.doc, bob.doc);

    expect(received.flatMap((c) => c.addedModels.map((m) => m.sourceId))).toEqual([4]);
    expect(received.flatMap((c) => c.movedModels)).toEqual([{ sourceId: 1, position: { x: 9, y: 9 } }]);
  });

  it('start with the state of the document when listening', () => {
    const alice = project();
    const bob = new ProjectDocument(new Y.Doc());
    sync(alice.doc, bob.doc, 'server');

    const { state } = bob.onRemoteChange(() => {});

    expect([...state.models.keys()]).toEqual([1, 2, 3]);
  });

  it("don't include the user's own changes, which the canvas already shows", () => {
    const { bob, received } = twoUsers();

    bob.renameModel(1, 'Mine');
    bob.removeModel(3);

    expect(received).toEqual([]);
  });

  it("don't report what the user's own change is later followed by as new", () => {
    const { alice, bob, received } = twoUsers();
    bob.renameModel(1, 'Mine');

    alice.addModel({ sourceId: 4, name: 'Tire', position: { x: 0, y: 0 } });
    sync(alice.doc, bob.doc);

    expect(received).toHaveLength(1);
    expect(received[0].renamedModels).toEqual([]);
  });

  it("aren't reported for what the server does itself, like filling in backend IDs", () => {
    const { alice, bob, received } = twoUsers();

    alice.doc.transact(() => relationMaps(alice)[0][1].set('backendId', 8), 'server');
    sync(alice.doc, bob.doc);

    expect(received).toEqual([]);
  });

  it('stop being reported once the listener is stopped', () => {
    const { alice, bob, received, stop } = twoUsers();
    stop();

    alice.renameModel(1, 'Vehicle');
    sync(alice.doc, bob.doc);

    expect(received).toEqual([]);
  });
});

describe('two users at the same time', () => {
  it('keep what both added, and a metamodel one deleted while the other moved it stays deleted', () => {
    const alice = project();
    const bob = new ProjectDocument(new Y.Doc());
    sync(alice.doc, bob.doc, 'server');

    alice.addModel({ sourceId: 4, name: 'Tire', position: { x: 0, y: 0 } });
    bob.addModel({ sourceId: 5, name: 'Seat', position: { x: 0, y: 0 } });
    alice.removeModel(3);
    bob.moveModels(new Map([[3, { x: 9, y: 9 }]]));
    sync(alice.doc, bob.doc);
    sync(bob.doc, alice.doc);

    for (const p of [alice, bob]) {
      expect([...p.read().models.keys()]).toEqual([1, 2, 4, 5]);
    }
    expect(alice.doc.getMap(LAYOUT).toJSON()).toEqual(bob.doc.getMap(LAYOUT).toJSON());
  });

  it('can add the same pair of metamodels twice, which shows as one relation for everyone', () => {
    const alice = project();
    const bob = new ProjectDocument(new Y.Doc());
    sync(alice.doc, bob.doc, 'server');

    alice.upsertRelation({ sourceId: 2, targetId: 3, reactionFileId: 40 });
    bob.upsertRelation({ sourceId: 2, targetId: 3, reactionFileId: 41 });
    sync(alice.doc, bob.doc);
    sync(bob.doc, alice.doc);

    expect(relationMaps(alice).filter(([, r]) => r.get('targetId') === 3)).toHaveLength(2);
    expect(alice.read().relations.get(pairKey(2, 3))).toEqual(bob.read().relations.get(pairKey(2, 3)));
  });
});

describe('origin of local changes', () => {
  it('is LOCAL_ORIGIN', () => {
    const p = project();
    const origins: unknown[] = [];
    p.doc.on('update', (_update: Uint8Array, origin: unknown) => origins.push(origin));

    p.renameModel(1, 'Vehicle');
    p.upsertRelation({ sourceId: 2, targetId: 3, reactionFileId: null });

    expect(origins).toEqual([LOCAL_ORIGIN, LOCAL_ORIGIN]);
  });
});
