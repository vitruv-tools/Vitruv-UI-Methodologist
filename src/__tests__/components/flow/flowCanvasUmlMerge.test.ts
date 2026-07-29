import { Edge, Node } from 'reactflow';
import {
  calculateAverageSourcePosition,
  calculateMergePoint,
  computeUmlMergeData,
} from '../../../components/flow/flowCanvasUmlMerge';
import { NODE_DIMENSIONS } from '../../../components/flow/flowCanvasConstants';

const node = (id: string, x = 0, y = 0): Node =>
  ({ id, position: { x, y }, data: {}, type: 'editable' } as Node);

const inheritance = (id: string, source: string, target: string): Edge =>
  ({ id, source, target, type: 'uml', data: { relationshipType: 'inheritance' } } as Edge);

describe('calculateAverageSourcePosition', () => {
  it('averages the centres of the source boxes', () => {
    const nodes = [node('a', 0, 0), node('b', 200, 400)];
    const edges = [inheritance('e1', 'a', 'z'), inheritance('e2', 'b', 'z')];

    expect(calculateAverageSourcePosition(edges, nodes)).toEqual({
      x: 100 + NODE_DIMENSIONS.width / 2,
      y: 200 + NODE_DIMENSIONS.height / 2,
    });
  });

  it('falls back to the origin when no source node resolves', () => {
    expect(calculateAverageSourcePosition([inheritance('e', 'ghost', 'z')], [])).toEqual({ x: 0, y: 0 });
  });
});

describe('calculateMergePoint', () => {
  it('aligns horizontally with the target centre', () => {
    const target = node('t', 300, 900);
    const point = calculateMergePoint({ x: 0, y: 100 }, target);

    expect(point.x).toBe(300 + NODE_DIMENSIONS.width / 2);
  });

  it('sits 40% of the way from the sources toward the target', () => {
    const target = node('t', 0, 1000);
    const targetCenterY = 1000 + NODE_DIMENSIONS.height / 2;
    const point = calculateMergePoint({ x: 0, y: 0 }, target);

    expect(point.y).toBeCloseTo(targetCenterY * 0.4);
  });
});

describe('computeUmlMergeData', () => {
  const nodes = [node('sub1', 0, 0), node('sub2', 400, 0), node('sub3', 800, 0), node('super', 400, 600)];

  it('returns empty maps when there are no inheritance edges', () => {
    const result = computeUmlMergeData([{ id: 'e', source: 'a', target: 'b', type: 'uml' } as Edge], nodes);

    expect(result.mergePointsMap.size).toBe(0);
  });

  it('does not merge a lone subclass', () => {
    const result = computeUmlMergeData([inheritance('e1', 'sub1', 'super')], nodes);

    expect(result.mergePointsMap.size).toBe(0);
  });

  it('merges two or more subclasses sharing a superclass', () => {
    const edges = [inheritance('e1', 'sub1', 'super'), inheritance('e2', 'sub2', 'super')];
    const result = computeUmlMergeData(edges, nodes);

    expect(result.mergePointsMap.size).toBe(2);
    expect(result.mergePointsMap.get('e1')!.mergeGroupId).toBe('merge-super');
    expect(result.mergeGroupSourceNodesMap.get('merge-super')).toEqual(['sub1', 'sub2']);
  });

  it('nominates the first edge of the group deterministically by source id', () => {
    const edges = [inheritance('later', 'sub2', 'super'), inheritance('earlier', 'sub1', 'super')];
    const result = computeUmlMergeData(edges, nodes);

    expect(result.firstInGroupMap.get('merge-super')).toBe('earlier');
  });

  it('excludes a subclass that reaches the superclass more than once', () => {
    const edges = [
      inheritance('e1', 'sub1', 'super'),
      inheritance('e2', 'sub1', 'super'),
      inheritance('e3', 'sub2', 'super'),
    ];
    const result = computeUmlMergeData(edges, nodes);

    // Only sub2 remains eligible, which is fewer than the two needed to merge.
    expect(result.mergePointsMap.size).toBe(0);
  });

  it('skips groups whose superclass node is missing', () => {
    const edges = [inheritance('e1', 'sub1', 'ghost'), inheritance('e2', 'sub2', 'ghost')];

    expect(computeUmlMergeData(edges, nodes).mergePointsMap.size).toBe(0);
  });

  it('ignores non-inheritance relationships', () => {
    const association = (id: string, source: string) =>
      ({ id, source, target: 'super', type: 'uml', data: { relationshipType: 'association' } } as Edge);
    const edges = [association('a1', 'sub1'), association('a2', 'sub2')];

    expect(computeUmlMergeData(edges, nodes).mergePointsMap.size).toBe(0);
  });
});
