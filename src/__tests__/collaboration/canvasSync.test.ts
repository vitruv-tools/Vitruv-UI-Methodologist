import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { CanvasSync, SEED_CONFIRM_MS, type CanvasPort } from '../../collaboration/canvasSync';
import { LAYOUT, LAYOUT_VSUM_CIRCLE, type VsumCircle } from '../../collaboration/document';
import { ProjectDocument } from '../../collaboration/projectDocument';
import { pairKey, type ProjectChanges, type ProjectState } from '../../collaboration/projectState';
import { buildDocument, sync } from './testDocuments';

const LOW_CODE = { id: 5, sourceId: 'a', targetId: 'b', lowCodeReactionRequestBase: { name: 'x' } };

/** An in-memory canvas: it applies what it is told, and the "user" changes it directly. */
class FakeCanvas implements CanvasPort {
  state: ProjectState = { models: new Map(), relations: new Map(), reactionLayout: {}, vsumCircle: null };
  applied: ProjectChanges[] = [];
  /** The VSUM circles it was told to show, and whether each was confirmed. */
  circles: [VsumCircle, boolean][] = [];
  /** Resolves a pending {@link apply} when called, if {@link hold} was used. */
  private release: (() => void) | undefined;
  private held: Promise<void> | undefined;

  read(): ProjectState {
    return structuredClone(this.state);
  }

  async apply(changes: ProjectChanges): Promise<void> {
    await this.held;
    this.applied.push(changes);
    for (const model of changes.addedModels) this.state.models.set(model.sourceId, { ...model });
    for (const id of changes.removedModels) this.state.models.delete(id);
    for (const { sourceId, name } of changes.renamedModels) this.state.models.get(sourceId)!.name = name;
    for (const { sourceId, position } of changes.movedModels) this.state.models.get(sourceId)!.position = position;
    for (const relation of changes.upsertedRelations) this.state.relations.set(pairKey(relation.sourceId, relation.targetId), { ...relation });
    for (const { sourceId, targetId } of changes.removedRelations) this.state.relations.delete(pairKey(sourceId, targetId));
    if (changes.reactionLayout) this.state.reactionLayout = changes.reactionLayout;
    if (changes.vsumCircle) this.circles.push([changes.vsumCircle, true]);
  }

  showVsumCircle(circle: VsumCircle, confirmed: boolean): void {
    this.circles.push([circle, confirmed]);
  }

  /** Makes the next applies wait until {@link unhold}. */
  hold(): void {
    this.held = new Promise((resolve) => (this.release = resolve));
  }

  unhold(): void {
    this.release?.();
    this.held = undefined;
  }

  // What the user does:
  addModel(sourceId: number, name: string, x = 0, y = 0): void {
    this.state.models.set(sourceId, { sourceId, name, position: { x, y } });
  }
  addRelation(sourceId: number, targetId: number, reactionFileId: number | null = null, fineGranular: Record<string, unknown>[] = []): void {
    this.state.relations.set(pairKey(sourceId, targetId), { key: '', sourceId, targetId, reactionFileId, fineGranular });
  }
}

/** A project with models 1-3 and a relation 1->2, as the server loads it. */
function serverDocument() {
  return buildDocument({
    models: [{ id: 1, name: 'Car', x: 0, y: 0 }, { id: 2, name: 'Brake', x: 100, y: 0 }, { id: 3, name: 'Wheel', x: 200, y: 0 }],
    relations: [{ backendId: 7, sourceId: 1, targetId: 2, reactionFileId: 30 }],
  });
}

/**
 * A client: its own copy of the project, as synced from the server, with a canvas. Clients of one
 * project sync from the same server document, so that their changes can be merged.
 */
function client(server: Y.Doc = serverDocument(), canvas = new FakeCanvas()) {
  const doc = new Y.Doc();
  sync(server, doc, 'server');
  const project = new ProjectDocument(doc);
  const canvasSync = new CanvasSync(project, canvas);
  return { doc, project, canvas, canvasSync };
}

const stopAll: (() => void)[] = [];
afterEach(() => stopAll.splice(0).forEach((stop) => stop()));
async function started(c = client()) {
  await c.canvasSync.start();
  stopAll.push(() => c.canvasSync.stop());
  return c;
}
const modelNames = (project: ProjectDocument) => [...project.read().models.values()].map((m) => `${m.sourceId}:${m.name}`);
const updatesOf = (doc: Y.Doc) => {
  const updates: unknown[] = [];
  doc.on('update', (_u: Uint8Array, origin: unknown) => updates.push(origin));
  return updates;
};

describe('starting', () => {
  it('brings the canvas in line with the project, whatever the canvas had', async () => {
    const c = client();
    c.canvas.addModel(1, 'Car', 0, 0);
    c.canvas.addModel(9, 'Only in the canvas');
    c.canvas.addRelation(1, 9);

    await started(c);

    expect([...c.canvas.state.models.keys()]).toEqual([1, 2, 3]);
    expect([...c.canvas.state.relations.keys()]).toEqual([pairKey(1, 2)]);
  });

  it('never changes the project, not even for an empty canvas', async () => {
    const c = client();
    const updates = updatesOf(c.doc);

    await started(c);

    expect(updates).toEqual([]);
    expect(modelNames(c.project)).toEqual(['1:Car', '2:Brake', '3:Wheel']);
  });

  it('is not done before the canvas has applied the project', async () => {
    const c = client();
    c.canvas.hold();
    let done = false;

    const starting = c.canvasSync.start().then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    c.canvas.unhold();
    await starting;

    expect(c.canvas.state.models.size).toBe(3);
  });

  it('refuses a project that is not loaded, since it would take the canvas away', async () => {
    const c = client(new Y.Doc());
    c.canvas.addModel(1, 'Car');

    await expect(c.canvasSync.start()).rejects.toThrow(/not loaded/);

    expect(c.canvas.state.models.size).toBe(1);
  });
});

describe('changes of other users', () => {
  it('are applied to the canvas', async () => {
    const server = serverDocument();
    const mine = await started(client(server));
    const theirs = client(server);

    theirs.project.addModel({ sourceId: 4, name: 'Tire', position: { x: 5, y: 5 } });
    theirs.project.renameModel(1, 'Vehicle');
    sync(theirs.doc, mine.doc);
    await mine.canvasSync.whenIdle();

    expect(mine.canvas.state.models.get(4)).toEqual({ sourceId: 4, name: 'Tire', position: { x: 5, y: 5 } });
    expect(mine.canvas.state.models.get(1)?.name).toBe('Vehicle');
  });

  it('are not written back into the project, however the canvas shows them', async () => {
    const server = serverDocument();
    const mine = await started(client(server));
    const updates = updatesOf(mine.doc);
    const theirs = client(server);

    theirs.project.moveModels(new Map([[1, { x: 50, y: 50 }]]));
    sync(theirs.doc, mine.doc);
    await mine.canvasSync.whenIdle();
    mine.canvasSync.pushLocalChanges();

    expect(updates).toEqual(['remote']); // only their update arrived
  });

  it('are applied one after the other, in the order they came', async () => {
    const server = serverDocument();
    const mine = await started(client(server));
    const theirs = client(server);
    mine.canvas.hold();

    theirs.project.renameModel(1, 'First');
    sync(theirs.doc, mine.doc);
    theirs.project.renameModel(1, 'Second');
    sync(theirs.doc, mine.doc);
    mine.canvas.unhold();
    await mine.canvasSync.whenIdle();

    // The first apply is the one that showed the project when it started.
    expect(mine.canvas.applied.slice(1).map((c) => c.renamedModels[0]?.name)).toEqual(['First', 'Second']);
    expect(mine.canvas.state.models.get(1)?.name).toBe('Second');
  });

  it('are not applied after stopping', async () => {
    const server = serverDocument();
    const mine = await started(client(server));
    const theirs = client(server);
    mine.canvasSync.stop();

    theirs.project.renameModel(1, 'Vehicle');
    sync(theirs.doc, mine.doc);
    await mine.canvasSync.whenIdle();

    expect(mine.canvas.state.models.get(1)?.name).toBe('Car');
  });
});

describe('changes of the user', () => {
  it('are written into the project: new metamodels, renames and moves', async () => {
    const mine = await started();

    mine.canvas.addModel(4, 'Tire', 9, 9);
    mine.canvas.state.models.get(1)!.name = 'Vehicle';
    mine.canvas.state.models.get(2)!.position = { x: 150, y: 20 };
    mine.canvasSync.pushLocalChanges();

    expect(mine.project.read().models.get(4)).toEqual({ sourceId: 4, name: 'Tire', position: { x: 9, y: 9 } });
    expect(mine.project.read().models.get(1)?.name).toBe('Vehicle');
    expect(mine.project.read().models.get(2)?.position).toEqual({ x: 150, y: 20 });
  });

  it('reach other users', async () => {
    const server = serverDocument();
    const mine = await started(client(server));
    const theirs = await started(client(server));

    mine.canvas.addModel(4, 'Tire');
    mine.canvasSync.pushLocalChanges();
    sync(mine.doc, theirs.doc);
    await theirs.canvasSync.whenIdle();

    expect(theirs.canvas.state.models.has(4)).toBe(true);
  });

  it('are written into the project once: pushing again changes nothing', async () => {
    const mine = await started();
    mine.canvas.addModel(4, 'Tire');
    mine.canvasSync.pushLocalChanges();
    const updates = updatesOf(mine.doc);

    mine.canvasSync.pushLocalChanges();
    mine.canvasSync.pushLocalChanges();

    expect(updates).toEqual([]);
  });

  it('add a relation, and change its reaction file, without touching its mappings', async () => {
    const mine = await started();
    mine.project.upsertRelation({ sourceId: 1, targetId: 2, reactionFileId: 30, fineGranular: [LOW_CODE] });
    await mine.canvasSync.whenIdle();

    mine.canvas.addRelation(2, 3, 40);
    mine.canvas.state.relations.set(pairKey(1, 2), { key: '', sourceId: 1, targetId: 2, reactionFileId: 31, fineGranular: [] });
    mine.canvasSync.pushLocalChanges();

    expect(mine.project.read().relations.get(pairKey(2, 3))?.reactionFileId).toBe(40);
    expect(mine.project.read().relations.get(pairKey(1, 2))).toMatchObject({ reactionFileId: 31, fineGranular: [LOW_CODE] });
  });

  it('write the mappings only when that is asked for, e.g. when the Low Code editor saved', async () => {
    const mine = await started();
    mine.canvas.state.relations.set(pairKey(1, 2), { key: '', sourceId: 1, targetId: 2, reactionFileId: 30, fineGranular: [LOW_CODE] });

    mine.canvasSync.pushLocalChanges();
    expect(mine.project.read().relations.get(pairKey(1, 2))?.fineGranular).toEqual([]);
    mine.canvasSync.pushMappings();

    expect(mine.project.read().relations.get(pairKey(1, 2))?.fineGranular).toEqual([LOW_CODE]);
  });

  it('do not include a metamodel that is being dragged', async () => {
    const mine = await started();

    mine.canvas.state.models.get(1)!.position = null; // the canvas can't say where it is yet
    mine.canvasSync.pushLocalChanges();

    expect(mine.project.read().models.get(1)?.position).toEqual({ x: 0, y: 0 });
  });

  it('are not written while the canvas still shows changes of others, so a newer value is not overwritten', async () => {
    const server = serverDocument();
    const mine = await started(client(server));
    const theirs = client(server);
    mine.canvas.hold();
    theirs.project.renameModel(1, 'Newer name');
    sync(theirs.doc, mine.doc); // arrives, but the canvas has not applied it yet
    mine.canvas.state.models.get(3)!.name = 'My rename';

    mine.canvasSync.pushLocalChanges();
    expect(mine.project.read().models.get(3)?.name).toBe('Wheel'); // waits
    mine.canvas.unhold();
    await mine.canvasSync.whenIdle();

    expect(mine.project.read().models.get(3)?.name).toBe('My rename');
    expect(mine.project.read().models.get(1)?.name).toBe('Newer name');
  });
});

describe('deleting', () => {
  it('a metamodel is explicit: it is marked as deleted, with its relations', async () => {
    const mine = await started();

    mine.canvasSync.removeModel(2);

    expect(mine.project.read().models.has(2)).toBe(false);
    expect(mine.project.read().relations.size).toBe(0);
  });

  it('a relation is explicit', async () => {
    const mine = await started();

    mine.canvasSync.removeRelation(1, 2);

    expect(mine.project.read().relations.size).toBe(0);
    expect(mine.project.read().models.size).toBe(3);
  });

  it('reaches other users', async () => {
    const server = serverDocument();
    const mine = await started(client(server));
    const theirs = await started(client(server));

    mine.canvasSync.removeModel(3);
    sync(mine.doc, theirs.doc);
    await theirs.canvasSync.whenIdle();

    expect(theirs.canvas.state.models.has(3)).toBe(false);
  });

  it('is not what a canvas that lost its content means: clearing it, e.g. when another project is loaded, deletes nothing', async () => {
    const mine = await started();

    mine.canvas.state = { models: new Map(), relations: new Map(), reactionLayout: {} };
    mine.canvasSync.pushLocalChanges();
    mine.canvasSync.pushMappings();

    expect(modelNames(mine.project)).toEqual(['1:Car', '2:Brake', '3:Wheel']);
    expect(mine.project.read().relations.size).toBe(1);
  });

  it('a metamodel that was deleted can be added again', async () => {
    const mine = await started();
    mine.canvasSync.removeModel(3);

    mine.canvas.addModel(3, 'Wheel', 1, 1);
    mine.canvasSync.pushLocalChanges();

    expect(mine.project.read().models.get(3)).toEqual({ sourceId: 3, name: 'Wheel', position: { x: 1, y: 1 } });
  });
});

describe('without a project that is ready', () => {
  it('writes nothing before it has started, and nothing afterwards', async () => {
    const c = client();
    const updates = updatesOf(c.doc);
    c.canvas.addModel(4, 'Tire');

    c.canvasSync.pushLocalChanges();
    c.canvasSync.removeModel(1);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    c.canvasSync.stop();
    c.canvasSync.pushLocalChanges();
    warn.mockRestore();

    expect(updates).toEqual([]);
  });
});

describe('undoing', () => {
  it('shows a taken-back rename on the canvas', async () => {
    const mine = await started();
    mine.canvas.state.models.get(1)!.name = 'Vehicle';
    mine.canvasSync.pushLocalChanges();

    expect(mine.canvasSync.undo()).toBe(true);
    await mine.canvasSync.whenIdle();

    expect(mine.canvas.state.models.get(1)?.name).toBe('Car');
    expect(mine.project.read().models.get(1)?.name).toBe('Car');
  });

  it('brings a deleted metamodel and its relation back onto the canvas', async () => {
    const mine = await started();
    mine.canvasSync.removeModel(1);
    mine.canvas.state.models.delete(1);
    mine.canvas.state.relations.clear();

    mine.canvasSync.undo();
    await mine.canvasSync.whenIdle();

    expect(mine.canvas.state.models.get(1)).toEqual({ sourceId: 1, name: 'Car', position: { x: 0, y: 0 } });
    expect(mine.canvas.state.relations.has(pairKey(1, 2))).toBe(true);
  });

  it('writes what was taken back into the project only once: the next push does not undo the undo', async () => {
    const mine = await started();
    mine.canvas.state.models.get(1)!.name = 'Vehicle';
    mine.canvasSync.pushLocalChanges();
    mine.canvasSync.undo();
    await mine.canvasSync.whenIdle();

    mine.canvasSync.pushLocalChanges();

    expect(mine.project.read().models.get(1)?.name).toBe('Car');
    expect(mine.canvas.state.models.get(1)?.name).toBe('Car');
  });

  it('first writes what the user changed on the canvas a moment ago, so that this is what is taken back', async () => {
    const mine = await started();
    mine.canvas.state.models.get(1)!.name = 'Vehicle';

    mine.canvasSync.undo();
    await mine.canvasSync.whenIdle();

    expect(mine.project.read().models.get(1)?.name).toBe('Car');
    expect(mine.canvas.state.models.get(1)?.name).toBe('Car');
  });

  it('brings back what was taken back with redo', async () => {
    const mine = await started();
    mine.canvas.addModel(4, 'Tire', 9, 9);
    mine.canvasSync.pushLocalChanges();
    mine.canvasSync.undo();
    await mine.canvasSync.whenIdle();
    expect(mine.canvas.state.models.has(4)).toBe(false);

    expect(mine.canvasSync.redo()).toBe(true);
    await mine.canvasSync.whenIdle();

    expect(mine.canvas.state.models.get(4)).toEqual({ sourceId: 4, name: 'Tire', position: { x: 9, y: 9 } });
  });

  it('reaches other users, and leaves what they did as it is', async () => {
    const server = serverDocument();
    const mine = await started(client(server));
    const theirs = await started(client(server));
    mine.canvas.state.models.get(1)!.name = 'Vehicle';
    mine.canvasSync.pushLocalChanges();
    theirs.canvas.state.models.get(2)!.position = { x: 500, y: 5 };
    theirs.canvasSync.pushLocalChanges();
    sync(mine.doc, theirs.doc);
    sync(theirs.doc, mine.doc);

    mine.canvasSync.undo();
    sync(mine.doc, theirs.doc);
    await Promise.all([mine.canvasSync.whenIdle(), theirs.canvasSync.whenIdle()]);

    expect(theirs.canvas.state.models.get(1)?.name).toBe('Car');
    expect(mine.canvas.state.models.get(2)?.position).toEqual({ x: 500, y: 5 });
  });

  it('does not undo what other users did', async () => {
    const server = serverDocument();
    const mine = await started(client(server));
    const theirs = await started(client(server));
    theirs.canvas.state.models.get(1)!.name = 'Vehicle';
    theirs.canvasSync.pushLocalChanges();
    sync(theirs.doc, mine.doc);
    await mine.canvasSync.whenIdle();

    expect(mine.canvasSync.history()).toEqual({ canUndo: false, canRedo: false });
    expect(mine.canvasSync.undo()).toBe(false);
    expect(mine.canvas.state.models.get(1)?.name).toBe('Vehicle');
  });

  it('takes back a whole drag in one step, however often its position was written', async () => {
    const mine = await started();
    for (const x of [10, 20, 30]) {
      mine.canvas.state.models.get(1)!.position = { x, y: 0 };
      mine.canvasSync.pushLocalChanges({ dragging: true });
    }
    mine.canvas.state.models.get(1)!.position = { x: 31, y: 0 };
    mine.canvasSync.pushLocalChanges({ dragging: false });

    mine.canvasSync.undo();
    await mine.canvasSync.whenIdle();

    expect(mine.canvas.state.models.get(1)?.position).toEqual({ x: 0, y: 0 });
    expect(mine.canvasSync.history().canUndo).toBe(false);
  });

  it('tells when there is something to undo or redo', async () => {
    const mine = await started();
    const listener = vi.fn();
    const stop = mine.canvasSync.onHistoryChange(listener);

    mine.canvas.state.models.get(1)!.name = 'Vehicle';
    mine.canvasSync.pushLocalChanges();
    expect(listener).toHaveBeenLastCalledWith({ canUndo: true, canRedo: false });

    mine.canvasSync.undo();
    expect(listener).toHaveBeenLastCalledWith({ canUndo: false, canRedo: true });

    stop();
  });

  it('does nothing before it has started and after it has stopped', async () => {
    const before = client();
    expect(before.canvasSync.undo()).toBe(false);

    const mine = await started();
    mine.canvas.state.models.get(1)!.name = 'Vehicle';
    mine.canvasSync.pushLocalChanges();
    mine.canvasSync.stop();

    expect(mine.canvasSync.undo()).toBe(false);
    expect(mine.project.read().models.get(1)?.name).toBe('Vehicle');
  });
});

describe('the VSUM circle', () => {
  const CIRCLE = { cx: 1, cy: 2, r: 300 };
  afterEach(() => vi.useRealTimers());

  function serverWithCircle(circle: VsumCircle = CIRCLE) {
    const server = serverDocument();
    server.getMap(LAYOUT).set(LAYOUT_VSUM_CIRCLE, circle);
    return server;
  }

  it('seeded by two users at once ends up the same for both, and only the shared one is confirmed', async () => {
    vi.useFakeTimers();
    const server = serverDocument();
    const mine = await started(client(server));
    const theirs = await started(client(server));
    // They see the models in different places when they open the project.
    theirs.project.moveModels(new Map([[3, { x: 900, y: 900 }]]));

    mine.canvasSync.seedVsumCircle();
    theirs.canvasSync.seedVsumCircle();
    sync(mine.doc, theirs.doc);
    sync(theirs.doc, mine.doc);
    await mine.canvasSync.whenIdle();
    await theirs.canvasSync.whenIdle();
    vi.advanceTimersByTime(SEED_CONFIRM_MS);

    const shared = mine.project.read().vsumCircle!;
    expect(theirs.project.read().vsumCircle).toEqual(shared);
    for (const { canvas } of [mine, theirs]) {
      const confirmed = canvas.circles.filter(([, isConfirmed]) => isConfirmed).map(([circle]) => circle);
      expect(confirmed).toEqual([shared]);
    }
  });

  it('a change reaches other users', async () => {
    const server = serverWithCircle();
    const mine = await started(client(server));
    const theirs = await started(client(server));

    mine.canvasSync.pushVsumCircle({ ...CIRCLE, r: 500 });
    sync(mine.doc, theirs.doc);
    await theirs.canvasSync.whenIdle();

    expect(theirs.canvas.circles.at(-1)).toEqual([{ ...CIRCLE, r: 500 }, true]);
  });
});
