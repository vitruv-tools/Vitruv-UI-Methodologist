import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { ProjectDocument } from '../../collaboration/projectDocument';
import { pairKey } from '../../collaboration/projectState';
import { buildDocument, copyOf, sync } from './testDocuments';

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

/** Two users of one project: what one does reaches the other with `exchange()`. */
function twoUsers() {
  const alice = project();
  const bob = new ProjectDocument(new Y.Doc());
  sync(alice.doc, bob.doc, 'server');
  const exchange = () => {
    sync(alice.doc, bob.doc);
    sync(bob.doc, alice.doc);
  };
  return { alice, bob, exchange };
}

const name = (p: ProjectDocument, id: number) => p.read().models.get(id)?.name;
const position = (p: ProjectDocument, id: number) => p.read().models.get(id)?.position;

describe('undoing and redoing own changes', () => {
  it('brings back several metamodels deleted together, with their relations, in one step', () => {
    const p = project();
    p.removeModels([1, 3]);
    expect([...p.read().models.keys()]).toEqual([2]);

    p.undo();

    expect([...p.read().models.keys()]).toEqual([1, 2, 3]);
    expect(p.read().relations.get(pairKey(1, 2))?.reactionFileId).toBe(30);
    expect(p.history().canUndo).toBe(false);
  });

  it('has nothing to undo or redo at first', () => {
    const p = project();

    expect(p.history()).toEqual({ canUndo: false, canRedo: false });
    expect(p.undo()).toBe(false);
    expect(p.redo()).toBe(false);
  });

  it('takes back a rename, and brings it back', () => {
    const p = project();
    p.renameModel(1, 'Auto');

    expect(p.undo()).toBe(true);
    expect(name(p, 1)).toBe('Car');
    expect(p.history()).toEqual({ canUndo: false, canRedo: true });

    expect(p.redo()).toBe(true);
    expect(name(p, 1)).toBe('Auto');
    expect(p.history()).toEqual({ canUndo: true, canRedo: false });
  });

  it('takes back a new metamodel with its position, and brings it back', () => {
    const p = project();
    p.addModel({ sourceId: 4, name: 'Tire', position: { x: 5, y: 6 } });

    p.undo();
    expect(p.read().models.has(4)).toBe(false);

    p.redo();
    expect(p.read().models.get(4)).toEqual({ sourceId: 4, name: 'Tire', position: { x: 5, y: 6 } });
  });

  it('brings back a deleted metamodel together with its relations, in one step', () => {
    const p = project();
    p.removeModel(1);
    expect(p.read().models.has(1)).toBe(false);
    expect(p.read().relations.size).toBe(0);

    p.undo();

    expect(p.read().models.get(1)).toEqual({ sourceId: 1, name: 'Car', position: { x: 0, y: 0 }, copy: copyOf(1) });
    expect(p.read().relations.get(pairKey(1, 2))?.reactionFileId).toBe(30);
    expect(p.history().canUndo).toBe(false);
  });

  it('brings back a deleted relation with its reaction file', () => {
    const p = project();
    p.removeRelation(1, 2);

    p.undo();

    expect(p.read().relations.get(pairKey(1, 2))?.reactionFileId).toBe(30);
  });

  it('takes back a new relation and a changed reaction file', () => {
    const p = project();
    p.upsertRelation({ sourceId: 2, targetId: 3, reactionFileId: 40 });
    p.upsertRelation({ sourceId: 1, targetId: 2, reactionFileId: 31 });

    p.undo();
    expect(p.read().relations.get(pairKey(1, 2))?.reactionFileId).toBe(30);
    p.undo();
    expect(p.read().relations.has(pairKey(2, 3))).toBe(false);
  });

  it('undoes the changes in the opposite order', () => {
    const p = project();
    p.renameModel(1, 'Auto');
    p.renameModel(1, 'Vehicle');

    p.undo();
    expect(name(p, 1)).toBe('Auto');
    p.undo();
    expect(name(p, 1)).toBe('Car');
  });

  it('forgets what could be redone once the user changes something else', () => {
    const p = project();
    p.renameModel(1, 'Auto');
    p.undo();

    p.renameModel(2, 'Pedal');

    expect(p.history().canRedo).toBe(false);
  });

  it('does nothing while the project is not loaded into the document', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const p = new ProjectDocument(new Y.Doc());
    p.renameModel(1, 'Auto');

    expect(p.history()).toEqual({ canUndo: false, canRedo: false });
    vi.restoreAllMocks();
  });
});

describe('one user action is one step', () => {
  it('undoes a whole drag at once, however many positions were written', () => {
    const p = project();
    p.moveModels(new Map([[1, { x: 10, y: 0 }]]), { dragging: true });
    p.moveModels(new Map([[1, { x: 20, y: 0 }]]), { dragging: true });
    p.moveModels(new Map([[1, { x: 30, y: 0 }]]), { dragging: true });
    p.moveModels(new Map([[1, { x: 31, y: 0 }]]), { dragging: false });

    p.undo();

    expect(position(p, 1)).toEqual({ x: 0, y: 0 });
    expect(p.history().canUndo).toBe(false);
  });

  it('keeps two drags apart, even when one follows the other right away', () => {
    const p = project();
    p.moveModels(new Map([[1, { x: 10, y: 0 }]]), { dragging: true });
    p.moveModels(new Map([[1, { x: 11, y: 0 }]]), { dragging: false });
    p.moveModels(new Map([[1, { x: 50, y: 0 }]]), { dragging: true });
    p.moveModels(new Map([[1, { x: 51, y: 0 }]]), { dragging: false });

    p.undo();
    expect(position(p, 1)).toEqual({ x: 11, y: 0 });
    p.undo();
    expect(position(p, 1)).toEqual({ x: 0, y: 0 });
  });

  it('keeps a move apart from the change before it', () => {
    const p = project();
    p.renameModel(1, 'Auto');
    p.moveModels(new Map([[1, { x: 10, y: 0 }]]), { dragging: false });

    p.undo();

    expect(position(p, 1)).toEqual({ x: 0, y: 0 });
    expect(name(p, 1)).toBe('Auto');
  });

  it('keeps a change apart from the drag before it', () => {
    const p = project();
    p.moveModels(new Map([[1, { x: 10, y: 0 }]]), { dragging: false });
    p.renameModel(1, 'Auto');

    p.undo();

    expect(name(p, 1)).toBe('Car');
    expect(position(p, 1)).toEqual({ x: 10, y: 0 });
  });

  it('moves several metamodels dragged together in one step', () => {
    const p = project();
    p.moveModels(new Map([[1, { x: 10, y: 0 }], [2, { x: 110, y: 0 }]]), { dragging: false });

    p.undo();

    expect(position(p, 1)).toEqual({ x: 0, y: 0 });
    expect(position(p, 2)).toEqual({ x: 100, y: 0 });
  });
});

describe('only the own changes', () => {
  it('does not undo what another user did', () => {
    const { alice, bob, exchange } = twoUsers();
    bob.renameModel(1, 'Auto');
    exchange();

    expect(alice.history().canUndo).toBe(false);
    expect(alice.undo()).toBe(false);
    expect(name(alice, 1)).toBe('Auto');
  });

  it('does not undo what the server changed', () => {
    const p = project();
    sync(buildDocument({ models: [{ id: 1, name: 'Server name', x: 0, y: 0 }] }), p.doc, 'server');

    expect(p.history().canUndo).toBe(false);
  });

  it('leaves what another user did since then as it is', () => {
    const { alice, bob, exchange } = twoUsers();
    alice.renameModel(1, 'Auto');
    bob.moveModels(new Map([[2, { x: 500, y: 5 }]]), { dragging: false });
    exchange();

    alice.undo();
    exchange();

    expect(name(bob, 1)).toBe('Car');
    for (const p of [alice, bob]) {
      expect(position(p, 2)).toEqual({ x: 500, y: 5 });
    }
  });

  it('does not take away a newer change of another user to the same thing', () => {
    const { alice, bob, exchange } = twoUsers();
    alice.renameModel(1, 'Auto');
    exchange();
    bob.renameModel(1, 'Vehicle');
    exchange();

    alice.undo();
    exchange();

    expect(name(alice, 1)).toBe('Vehicle');
    expect(name(bob, 1)).toBe('Vehicle');
  });

  it('keeps both users in agreement when a new metamodel that another user moved is undone', () => {
    const { alice, bob, exchange } = twoUsers();
    alice.addModel({ sourceId: 4, name: 'Tire', position: { x: 0, y: 0 } });
    exchange();
    bob.moveModels(new Map([[4, { x: 40, y: 40 }]]), { dragging: false });
    exchange();

    alice.undo();
    exchange();

    // Undoing the add takes the metamodel away for everyone, like a delete would.
    expect(bob.read().models.has(4)).toBe(alice.read().models.has(4));
  });

  it('shows the others what an undo did', () => {
    const { alice, bob, exchange } = twoUsers();
    alice.renameModel(1, 'Auto');
    exchange();

    alice.undo();
    exchange();

    expect(name(bob, 1)).toBe('Car');
  });
});

describe('reporting an undo to the canvas', () => {
  it('reports an undo and a redo like a change of another user, so the canvas shows them', () => {
    const p = project();
    const listener = vi.fn();
    p.onRemoteChange(listener);
    p.renameModel(1, 'Auto');
    expect(listener).not.toHaveBeenCalled();

    p.undo();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].renamedModels).toEqual([{ sourceId: 1, name: 'Car' }]);

    p.redo();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0].renamedModels).toEqual([{ sourceId: 1, name: 'Auto' }]);
  });
});

describe('telling when the history changes', () => {
  it('tells when there is something to undo or redo, and stops when asked to', () => {
    const p = project();
    const listener = vi.fn();
    const stop = p.onHistoryChange(listener);

    p.renameModel(1, 'Auto');
    expect(listener).toHaveBeenLastCalledWith({ canUndo: true, canRedo: false });

    p.undo();
    expect(listener).toHaveBeenLastCalledWith({ canUndo: false, canRedo: true });

    stop();
    listener.mockClear();
    p.redo();
    expect(listener).not.toHaveBeenCalled();
  });
});
