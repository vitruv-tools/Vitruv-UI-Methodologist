import { Node } from 'reactflow';
import {
  ECORE_DROP_SNAP_DISTANCE,
  findEcoreTargetAtPosition,
  findNodeByMetaModelId,
  getBackendMetaModelId,
  getMetaModelSourceId,
  isPositionInsideNode,
} from '../../../components/flow/flowCanvasNodeLookup';
import { ECORE_FILE_BOX_SIZE } from '../../../components/flow/flowCanvasConstants';

const ecore = (id: string, x = 0, y = 0, data: Record<string, unknown> = {}): Node =>
  ({ id, position: { x, y }, data, type: 'ecoreFile' } as Node);

describe('getMetaModelSourceId / getBackendMetaModelId', () => {
  const nodes = [
    ecore('both', 0, 0, { metaModelId: 10, metaModelSourceId: 20 }),
    ecore('backendOnly', 0, 0, { metaModelId: 30 }),
    ecore('sourceOnly', 0, 0, { metaModelSourceId: 40 }),
    ecore('neither'),
  ];

  it('prefers its own id flavour when both are present', () => {
    expect(getMetaModelSourceId(nodes, 'both')).toBe(20);
    expect(getBackendMetaModelId(nodes, 'both')).toBe(10);
  });

  it('falls back to the other flavour when only one is present', () => {
    expect(getMetaModelSourceId(nodes, 'backendOnly')).toBe(30);
    expect(getBackendMetaModelId(nodes, 'sourceOnly')).toBe(40);
  });

  it('returns undefined for a node without ids, an unknown id, or no id at all', () => {
    expect(getMetaModelSourceId(nodes, 'neither')).toBeUndefined();
    expect(getMetaModelSourceId(nodes, 'ghost')).toBeUndefined();
    expect(getMetaModelSourceId(nodes, null)).toBeUndefined();
  });

  it('ignores non-numeric ids', () => {
    const odd = [ecore('odd', 0, 0, { metaModelId: 'not-a-number' })];

    expect(getBackendMetaModelId(odd, 'odd')).toBeUndefined();
  });
});

describe('findNodeByMetaModelId', () => {
  const nodes = [
    ecore('a', 0, 0, { metaModelId: 1 }),
    ecore('b', 0, 0, { metaModelSourceId: 2 }),
    { id: 'editable', position: { x: 0, y: 0 }, data: { metaModelId: 3 }, type: 'editable' } as Node,
  ];

  it('matches on either id flavour', () => {
    expect(findNodeByMetaModelId(nodes, 1)!.id).toBe('a');
    expect(findNodeByMetaModelId(nodes, 2)!.id).toBe('b');
  });

  it('only considers ecoreFile nodes', () => {
    expect(findNodeByMetaModelId(nodes, 3)).toBeUndefined();
  });
});

describe('isPositionInsideNode', () => {
  const box = ecore('a', 100, 100);

  it('accepts a point within the footprint, including the edges', () => {
    expect(isPositionInsideNode({ x: 110, y: 110 }, box)).toBe(true);
    expect(isPositionInsideNode({ x: 100, y: 100 }, box)).toBe(true);
    expect(isPositionInsideNode(
      { x: 100 + ECORE_FILE_BOX_SIZE.width, y: 100 + ECORE_FILE_BOX_SIZE.height },
      box,
    )).toBe(true);
  });

  it('rejects a point outside the footprint', () => {
    expect(isPositionInsideNode({ x: 99, y: 110 }, box)).toBe(false);
    expect(isPositionInsideNode({ x: 10_000, y: 110 }, box)).toBe(false);
  });
});

describe('findEcoreTargetAtPosition', () => {
  const nodes = [ecore('source', 0, 0), ecore('target', 1000, 1000)];

  it('never returns the source node itself', () => {
    expect(findEcoreTargetAtPosition(nodes, { x: 10, y: 10 }, 'source')).toBeNull();
  });

  it('returns the box the point lands inside', () => {
    expect(findEcoreTargetAtPosition(nodes, { x: 1010, y: 1010 }, 'source')!.id).toBe('target');
  });

  it('snaps to a box just outside it, measuring from the box centre', () => {
    // Level with the centre and 5px clear of the left edge, so the point is
    // outside the footprint but well inside the snap radius of the centre.
    const nearby = { x: 1000 - 5, y: 1000 + ECORE_FILE_BOX_SIZE.height / 2 };
    const distanceToCentre = ECORE_FILE_BOX_SIZE.width / 2 + 5;

    expect(isPositionInsideNode(nearby, nodes[1])).toBe(false);
    expect(distanceToCentre).toBeLessThan(ECORE_DROP_SNAP_DISTANCE);
    expect(findEcoreTargetAtPosition(nodes, nearby, 'source')!.id).toBe('target');
  });

  it('returns null when nothing is within snapping distance', () => {
    expect(findEcoreTargetAtPosition(nodes, { x: 500, y: 500 }, 'source')).toBeNull();
  });

  it('picks the closest candidate when two are within range', () => {
    // Centres at x=259 and x=409; the probe at x=330 is outside both boxes and
    // within the snap radius of each, but 71px from the first and 79px from the second.
    const crowded = [ecore('source', 0, 0), ecore('nearer', 200, 0), ecore('farther', 350, 0)];
    const probe = { x: 330, y: ECORE_FILE_BOX_SIZE.height / 2 };

    expect(isPositionInsideNode(probe, crowded[1])).toBe(false);
    expect(isPositionInsideNode(probe, crowded[2])).toBe(false);
    expect(findEcoreTargetAtPosition(crowded, probe, 'source')!.id).toBe('nearer');
  });
});
