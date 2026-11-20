import type { Edge, Node } from 'reactflow';
import { createCanvasPort, type CanvasHandle, type CanvasPortDeps } from '../../collaboration/canvasPort';
import { pairKey, type ProjectChanges } from '../../collaboration/projectState';
import type { EditableVsumMetaModelRelation } from '../../types/EditableVsumDetails';

const noChanges = (): ProjectChanges => ({
  addedModels: [],
  removedModels: [],
  renamedModels: [],
  movedModels: [],
  upsertedRelations: [],
  removedRelations: [],
  reactionLayout: undefined,
});

/** A canvas that records what it is told. */
function fakeCanvas(nodes: Node[] = [], snapshot = { metaModelIds: [] as number[], metaModelRelationRequests: [] as any[] }) {
  const calls: string[] = [];
  const handle: CanvasHandle = {
    getNodes: () => nodes,
    getEdges: () => [] as Edge[],
    getWorkspaceSnapshot: () => snapshot,
    addEcoreFile: vi.fn((fileName: string, _content: string, meta?: any) => { calls.push(`add ${meta?.metaModelSourceId}`); }),
    removeEcoreFileBySourceId: vi.fn((id: number) => { calls.push(`remove model ${id}`); }),
    updateEcoreDisplayName: vi.fn((id: number, name: string) => { calls.push(`rename ${id} ${name}`); }),
    setEcorePositions: vi.fn(() => { calls.push('move'); }),
    upsertReactionRelation: vi.fn((r: any) => { calls.push(`upsert ${r.sourceId}->${r.targetId}`); }),
    removeReactionRelation: vi.fn((s: number, t: number) => { calls.push(`remove relation ${s}->${t}`); }),
  };
  return { handle, calls };
}

function port(overrides: Partial<CanvasPortDeps> = {}, canvas = fakeCanvas()) {
  let relations: EditableVsumMetaModelRelation[] = [];
  const saved: Record<string, unknown>[] = [];
  const deps: CanvasPortDeps = {
    getCanvas: () => canvas.handle,
    resolveMetaModel: vi.fn(async (sourceId: number) => ({
      fileName: `M${sourceId}.ecore`,
      fileContent: `<ecore ${sourceId}/>`,
      meta: { metaModelId: sourceId, metaModelSourceId: sourceId, ecoreFileId: sourceId + 500 },
    })),
    loadReactionLayout: () => ({ 'ns:a': { bbox: { x: 1, y: 1 } } }),
    saveReactionLayout: (layout) => saved.push(layout),
    updateRelations: (update) => { relations = update(relations); },
    settle: async () => { canvas.calls.push('settle'); },
    ...overrides,
  };
  return { port: createCanvasPort(deps), deps, canvas, saved, relations: () => relations };
}

describe('reading the canvas', () => {
  it('describes its metamodels and relations in the terms of the shared project', () => {
    const nodes: Node[] = [
      { id: 'ecore-1', type: 'ecoreFile', position: { x: 5, y: 6 }, data: { metaModelSourceId: 1, displayName: 'Car', fileName: 'Car.ecore' } },
      { id: 'ecore-2', type: 'ecoreFile', position: { x: 7, y: 8 }, data: { metaModelSourceId: 2, displayName: 'Brake', fileName: 'Brake.ecore' } },
    ];
    const canvas = fakeCanvas(nodes, { metaModelIds: [1, 2], metaModelRelationRequests: [{ sourceId: 1, targetId: 2, reactionFileId: 30 }] });

    const state = port({}, canvas).port.read();

    expect([...state.models.values()].map((m) => [m.sourceId, m.name, m.position])).toEqual([
      [1, 'Car', { x: 5, y: 6 }],
      [2, 'Brake', { x: 7, y: 8 }],
    ]);
    expect(state.relations.get(pairKey(1, 2))).toMatchObject({ reactionFileId: 30 });
    expect(state.reactionLayout).toEqual({ 'ns:a': { bbox: { x: 1, y: 1 } } });
  });

  it('is empty without a canvas', () => {
    const state = port({ getCanvas: () => null }).port.read();

    expect(state.models.size).toBe(0);
    expect(state.relations.size).toBe(0);
  });
});

describe('showing changes of the shared project', () => {
  it('removes deleted relations and metamodels first', async () => {
    const t = port();

    await t.port.apply({ ...noChanges(), removedRelations: [{ sourceId: 1, targetId: 2 }], removedModels: [3] });

    expect(t.canvas.calls).toEqual(['remove relation 1->2', 'remove model 3']);
  });

  it('adds a metamodel that is new exactly where the other user put it, without taking over the selection', async () => {
    const t = port();

    await t.port.apply({ ...noChanges(), addedModels: [{ sourceId: 4, name: 'Tire', position: { x: 9, y: 9 } }] });

    expect(t.canvas.handle.addEcoreFile).toHaveBeenCalledWith('M4.ecore', '<ecore 4/>', {
      metaModelId: 4,
      metaModelSourceId: 4,
      ecoreFileId: 504,
      displayName: 'Tire',
      fromServerLoad: true,
      keepSelection: true,
      position: { x: 9, y: 9 },
      exactPosition: true,
    });
  });

  it('adds a metamodel without position where the canvas finds a place for it', async () => {
    const t = port();

    await t.port.apply({ ...noChanges(), addedModels: [{ sourceId: 4, name: 'Tire', position: null }] });

    const meta = (t.canvas.handle.addEcoreFile as any).mock.calls[0][2];
    expect(meta.exactPosition).toBe(false);
    expect(meta.position).toBeUndefined();
  });

  it('adds metamodels one after the other, and carries on if one cannot be found', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const resolveMetaModel = vi.fn(async (id: number) => (id === 4 ? null : { fileName: `M${id}.ecore`, fileContent: '', meta: { metaModelSourceId: id } }));
    const t = port({ resolveMetaModel });

    await t.port.apply({
      ...noChanges(),
      addedModels: [{ sourceId: 4, name: 'Gone', position: null }, { sourceId: 5, name: 'Seat', position: null }],
    });

    expect(t.canvas.calls.filter((c) => c.startsWith('add'))).toEqual(['add 5']);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('4'));
    error.mockRestore();
  });

  it('carries on if a metamodel cannot be loaded', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const resolveMetaModel = vi.fn(async (id: number) => {
      if (id === 4) throw new Error('offline');
      return { fileName: `M${id}.ecore`, fileContent: '', meta: { metaModelSourceId: id } };
    });
    const t = port({ resolveMetaModel });

    await t.port.apply({ ...noChanges(), addedModels: [{ sourceId: 4, name: 'A', position: null }, { sourceId: 5, name: 'B', position: null }] });

    expect(t.canvas.calls.filter((c) => c.startsWith('add'))).toEqual(['add 5']);
    error.mockRestore();
  });

  it('renames and moves metamodels', async () => {
    const t = port();

    await t.port.apply({
      ...noChanges(),
      renamedModels: [{ sourceId: 1, name: 'Vehicle' }],
      movedModels: [{ sourceId: 2, position: { x: 3, y: 4 } }, { sourceId: 3, position: { x: 5, y: 6 } }],
    });

    expect(t.canvas.calls).toEqual(['rename 1 Vehicle', 'move']);
    expect(t.canvas.handle.setEcorePositions).toHaveBeenCalledWith(new Map([[2, { x: 3, y: 4 }], [3, { x: 5, y: 6 }]]));
  });

  it('waits until new metamodels are on the canvas before it adds relations to them', async () => {
    const t = port();

    await t.port.apply({
      ...noChanges(),
      addedModels: [{ sourceId: 4, name: 'Tire', position: { x: 0, y: 0 } }],
      upsertedRelations: [{ key: 'k', sourceId: 1, targetId: 4, reactionFileId: 30, fineGranular: [] }],
    });

    expect(t.canvas.calls).toEqual(['add 4', 'settle', 'upsert 1->4']);
  });

  it('does not wait if no metamodel was added or removed', async () => {
    const t = port();

    await t.port.apply({ ...noChanges(), upsertedRelations: [{ key: 'k', sourceId: 1, targetId: 2, reactionFileId: 30, fineGranular: [] }] });

    expect(t.canvas.calls).toEqual(['upsert 1->2']);
  });

  it('shows relations on the canvas and in the Low Code store, also their mappings', async () => {
    const LOW_CODE = { id: 5, sourceId: 'a', targetId: 'b', lowCodeReactionRequestBase: { name: 'x' } };
    const t = port();

    await t.port.apply({ ...noChanges(), upsertedRelations: [{ key: 'k', sourceId: 1, targetId: 2, reactionFileId: 30, fineGranular: [LOW_CODE] }] });

    expect(t.canvas.handle.upsertReactionRelation).toHaveBeenCalledWith({ sourceId: 1, targetId: 2, reactionFileId: 30 });
    expect(t.relations()).toHaveLength(1);
    expect(t.relations()[0]).toMatchObject({ sourceId: 1, targetId: 2, reactionFileId: 30 });
    expect(t.relations()[0].fineGranularMetaModelRelationSet).toEqual([LOW_CODE]);
  });

  it('removes a relation from the canvas and from the Low Code store', async () => {
    const t = port();
    await t.port.apply({ ...noChanges(), upsertedRelations: [{ key: 'k', sourceId: 1, targetId: 2, reactionFileId: 30, fineGranular: [] }] });

    await t.port.apply({ ...noChanges(), removedRelations: [{ sourceId: 1, targetId: 2 }] });

    expect(t.relations()).toEqual([]);
  });

  it('keeps the reaction layout of the project', async () => {
    const t = port();

    await t.port.apply({ ...noChanges(), reactionLayout: { 'ns:car': { bbox: { x: 1, y: 2 } } } });

    expect(t.saved).toEqual([{ 'ns:car': { bbox: { x: 1, y: 2 } } }]);
  });

  it('does nothing if the canvas is gone', async () => {
    const t = port({ getCanvas: () => null });

    await expect(t.port.apply({ ...noChanges(), removedModels: [1], addedModels: [{ sourceId: 2, name: 'x', position: null }] })).resolves.toBeUndefined();
    expect(t.deps.resolveMetaModel).not.toHaveBeenCalled();
  });
});
