import type { Node } from 'reactflow';
import { projectCanvasState } from '../../collaboration/canvasProjection';
import { pairKey } from '../../collaboration/projectState';

const ecore = (id: string, data: Record<string, unknown>, extra: Partial<Node> = {}): Node => ({
  id,
  type: 'ecoreFile',
  position: { x: 10, y: 20 },
  data: { fileName: 'Car (1.0).ecore', ...data },
  ...extra,
});

const project = (nodes: Node[], relationRequests: Parameters<typeof projectCanvasState>[0]['relationRequests'] = null, reactionLayout = {}) =>
  projectCanvasState({ nodes, relationRequests, reactionLayout });

describe('projectCanvasState: metamodels', () => {
  it('has one metamodel per ecore box, by its library ID, with its title and position', () => {
    const state = project([
      ecore('ecore-101', { metaModelId: 101, metaModelSourceId: 1, displayName: 'Car' }),
      ecore('ecore-2', { metaModelId: 2, metaModelSourceId: 2, displayName: 'Brake' }, { position: { x: 5, y: 6 } }),
    ]);

    expect([...state.models.values()]).toEqual([
      { sourceId: 1, name: 'Car', position: { x: 10, y: 20 } },
      { sourceId: 2, name: 'Brake', position: { x: 5, y: 6 } },
    ]);
  });

  it('uses the ID of the metamodel itself if the box has no library ID, like the rest of the canvas', () => {
    const state = project([ecore('ecore-7', { metaModelId: 7, displayName: 'Seat' })]);

    expect([...state.models.keys()]).toEqual([7]);
  });

  it('titles a box like the canvas does: the display name, else the file name without its extension', () => {
    const state = project([
      ecore('a', { metaModelSourceId: 1, displayName: '' , fileName: 'Car (1.0).ecore' }),
      ecore('b', { metaModelSourceId: 2, fileName: 'Brake.ecore' }),
    ]);

    expect(state.models.get(1)?.name).toBe('Car (1.0)');
    expect(state.models.get(2)?.name).toBe('Brake');
  });

  it('has the position of a box that is being dragged, so that others see it move while it is dragged', () => {
    const state = project([ecore('a', { metaModelSourceId: 1, displayName: 'Car' }, { dragging: true, position: { x: 77, y: 88 } })]);

    expect(state.models.get(1)?.position).toEqual({ x: 77, y: 88 });
  });

  it('keeps boxes that are hidden, like those of a metamodel expanded in the reaction view', () => {
    const state = project([ecore('a', { metaModelSourceId: 1, displayName: 'Car' }, { hidden: true })]);

    expect(state.models.has(1)).toBe(true);
  });

  it('leaves out other nodes, boxes without an ID, and a second box of the same metamodel', () => {
    const state = project([
      { id: 'n', type: 'editable', position: { x: 0, y: 0 }, data: { metaModelId: 5 } },
      { id: 'bbox', type: 'boundingBox', position: { x: 0, y: 0 }, data: { metaModelSourceId: 6 } },
      ecore('no-id', { displayName: 'Anonymous' }),
      ecore('string-id', { metaModelSourceId: '3', displayName: 'String' }),
      ecore('first', { metaModelSourceId: 1, displayName: 'First' }),
      ecore('second', { metaModelSourceId: 1, displayName: 'Second' }),
    ]);

    expect([...state.models.values()].map((m) => m.name)).toEqual(['First']);
  });
});

describe('projectCanvasState: relations', () => {
  const nodes = [ecore('a', { metaModelSourceId: 1, displayName: 'Car' }), ecore('b', { metaModelSourceId: 2, displayName: 'Brake' })];
  const LOW_CODE = { id: 5, sourceId: 'a', targetId: 'b', lowCodeReactionRequestBase: { name: 'x' } };

  it('takes the relations of the sync request, with their reaction file and mappings', () => {
    const state = project(nodes, [
      { sourceId: 1, targetId: 2, reactionFileId: 30 },
      { sourceId: 2, targetId: 1, reactionFileId: null, fineGranularMetaModelRelationSet: [LOW_CODE] },
    ]);

    expect(state.relations.get(pairKey(1, 2))).toEqual({ key: '', sourceId: 1, targetId: 2, reactionFileId: 30, fineGranular: [] });
    expect(state.relations.get(pairKey(2, 1))).toEqual({ key: '', sourceId: 2, targetId: 1, reactionFileId: null, fineGranular: [LOW_CODE] });
  });

  it('leaves out a relation to a metamodel that is not on the canvas', () => {
    const state = project(nodes, [{ sourceId: 1, targetId: 9, reactionFileId: 30 }]);

    expect(state.relations.size).toBe(0);
  });

  it('has no relations if the request has none', () => {
    expect(project(nodes, null).relations.size).toBe(0);
  });
});

describe('projectCanvasState: reaction layout', () => {
  it('passes the reaction layout on', () => {
    const layout = { 'ns:car': { bbox: { x: 1, y: 2 }, classes: {} } };

    expect(project([], null, layout).reactionLayout).toEqual(layout);
  });
});
