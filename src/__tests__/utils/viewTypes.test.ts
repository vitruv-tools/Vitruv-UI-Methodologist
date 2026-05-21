import { Node } from 'reactflow';
import { computeBestAngle, mapBackendViewsToViewTypes } from '../../utils/viewTypes';
import { VsumView } from '../../types/vsum';

const makeNode = (id: string, sourceId: number): Node => ({
  id,
  type: 'ecoreFile',
  position: { x: 0, y: 0 },
  data: { metaModelSourceId: sourceId },
});

describe('computeBestAngle', () => {
  it('returns top position when no existing angles', () => {
    expect(computeBestAngle([])).toBeCloseTo(-Math.PI / 2);
  });

  it('returns a finite angle when other views already exist', () => {
    const angle = computeBestAngle([0, Math.PI / 2]);
    expect(Number.isFinite(angle)).toBe(true);
    expect(angle).toBeGreaterThanOrEqual(-Math.PI);
    expect(angle).toBeLessThanOrEqual(Math.PI);
  });
});

describe('mapBackendViewsToViewTypes', () => {
  it('maps assignedModels sourceIds to canvas node ids', () => {
    const nodes = [makeNode('node-a', 10), makeNode('node-b', 20)];
    const views: VsumView[] = [
      {
        id: 5,
        fileStorageId: 99,
        assignedModels: [
          { id: 1, name: 'A', sourceId: 10 } as any,
          { id: 2, name: 'B', sourceId: 20 } as any,
        ],
      },
    ];

    const result = mapBackendViewsToViewTypes(views, nodes);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('view-5');
    expect(result[0].backendId).toBe(5);
    expect(result[0].fileStorageId).toBe(99);
    expect(result[0].scope).toBe('multi');
    expect(result[0].linkedNodeIds).toEqual(expect.arrayContaining(['node-a', 'node-b']));
  });

  it('uses single scope when one model is linked', () => {
    const nodes = [makeNode('node-a', 10)];
    const views: VsumView[] = [
      {
        id: 1,
        fileStorageId: 0,
        assignedModels: [{ id: 1, name: 'A', sourceId: 10 } as any],
      },
    ];

    const result = mapBackendViewsToViewTypes(views, nodes);

    expect(result[0].scope).toBe('single');
    expect(result[0].linkedNodeIds).toEqual(['node-a']);
  });

  it('skips models without matching nodes', () => {
    const nodes = [makeNode('node-a', 10)];
    const views: VsumView[] = [
      {
        id: 2,
        fileStorageId: 1,
        assignedModels: [{ id: 1, name: 'X', sourceId: 999 } as any],
      },
    ];

    const result = mapBackendViewsToViewTypes(views, nodes);

    expect(result[0].linkedNodeIds).toEqual([]);
    expect(result[0].scope).toBe('single');
  });
});
