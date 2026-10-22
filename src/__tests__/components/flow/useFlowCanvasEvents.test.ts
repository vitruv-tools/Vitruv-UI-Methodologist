import { Edge, Node } from 'reactflow';
import {
  deselectAllNodes,
  normalizeMetaModelRelations,
  selectOnlyEdge,
} from '../../../components/flow/useFlowCanvasEvents';

const edge = (id: string, selected = false): Edge => ({ id, source: 'a', target: 'b', selected } as Edge);
const node = (id: string, selected = false): Node =>
  ({ id, position: { x: 0, y: 0 }, data: {}, selected } as Node);

describe('selectOnlyEdge', () => {
  it('selects a previously unselected edge', () => {
    const result = selectOnlyEdge([edge('a'), edge('b')], 'a', false);

    expect(result[0].selected).toBe(true);
  });

  it('deselects the edge when it was already selected', () => {
    const result = selectOnlyEdge([edge('a', true)], 'a', true);

    expect(result[0].selected).toBe(false);
  });

  it('clears every other edge', () => {
    const result = selectOnlyEdge([edge('a'), edge('b', true), edge('c', true)], 'a', false);

    expect(result.map(e => e.selected)).toEqual([true, false, false]);
  });

  it('leaves the list unchanged in length and order', () => {
    const result = selectOnlyEdge([edge('a'), edge('b')], 'missing', false);

    expect(result.map(e => e.id)).toEqual(['a', 'b']);
    expect(result.every(e => e.selected === false)).toBe(true);
  });
});

describe('deselectAllNodes', () => {
  it('clears the selection flag on every node', () => {
    const result = deselectAllNodes([node('a', true), node('b')]);

    expect(result.every(n => n.selected === false)).toBe(true);
  });

  it('preserves the other node fields', () => {
    const result = deselectAllNodes([node('a', true)]);

    expect(result[0]).toMatchObject({ id: 'a', position: { x: 0, y: 0 } });
  });
});

describe('normalizeMetaModelRelations', () => {
  it('returns an empty list for missing input', () => {
    expect(normalizeMetaModelRelations(undefined)).toEqual([]);
  });

  it('reads the canonical field names', () => {
    expect(normalizeMetaModelRelations([
      { id: 1, sourceId: 10, targetId: 20, reactionFileId: 30 },
    ])).toEqual([{ id: 1, sourceId: 10, targetId: 20, reactionFileId: 30 }]);
  });

  it('accepts the older metamodel-suffixed field names', () => {
    expect(normalizeMetaModelRelations([
      { id: 2, sourceMetaModelId: 11, targetMetaModelId: 21, reactionFileStorageId: 31 },
    ])).toEqual([{ id: 2, sourceId: 11, targetId: 21, reactionFileId: 31 }]);
  });

  it('prefers the canonical name when both spellings are present', () => {
    const [relation] = normalizeMetaModelRelations([
      { id: 3, sourceId: 1, sourceMetaModelId: 99, targetId: 2, targetMetaModelId: 98 },
    ]);

    expect(relation.sourceId).toBe(1);
    expect(relation.targetId).toBe(2);
  });

  it('defaults a missing reaction file id to null', () => {
    expect(normalizeMetaModelRelations([{ id: 4, sourceId: 1, targetId: 2 }])[0].reactionFileId)
      .toBeNull();
  });

  it('defaults a non-numeric id to zero', () => {
    expect(normalizeMetaModelRelations([{ sourceId: 1, targetId: 2 }])[0].id).toBe(0);
  });

  it('drops relations without a usable source or target', () => {
    expect(normalizeMetaModelRelations([
      { id: 1, sourceId: 1 },
      { id: 2, targetId: 2 },
      { id: 3, sourceId: 1, targetId: 2 },
    ]).map(r => r.id)).toEqual([3]);
  });
});
