import { Node } from 'reactflow';
import type { ExpandedMetaModelResult } from '../../../utils/expandMetaModel';
import {
  collapseReactionGraph,
  expandedBoxesOverlap,
  resolveExpandOverlaps,
  shiftExpandedResult,
  storeReactionOffsets,
  type ExpandResultEntry,
} from '../../../components/flow/flowCanvasReactionMode';

const box = (
  id: string,
  x: number,
  y: number,
  width = 400,
  height = 300,
): Node => ({
  id,
  type: 'boundingBox',
  position: { x, y },
  data: {},
  style: { width, height },
});

const classNode = (id: string, x: number, y: number): Node => ({
  id,
  type: 'eobject',
  position: { x, y },
  data: {},
});

function entry(
  ecoreId: string,
  bbox: Node,
  classes: Node[],
  restored = false,
): ExpandResultEntry {
  return {
    ecoreId,
    restored,
    result: {
      boundingBox: bbox,
      eObjectNodes: classes,
      ghostNodes: [],
      umlEdges: [],
      modelNsUri: ecoreId,
    } as ExpandedMetaModelResult,
  };
}

describe('expandedBoxesOverlap', () => {
  it('detects overlapping bounding boxes with padding', () => {
    expect(expandedBoxesOverlap(box('a', 0, 0), box('b', 50, 50))).toBe(true);
  });

  it('allows boxes that sit beside each other with a gap', () => {
    expect(expandedBoxesOverlap(box('a', 0, 0), box('b', 450, 0))).toBe(false);
  });
});

describe('resolveExpandOverlaps', () => {
  it('shifts an unrestored model to the right of the previous box', () => {
    const first = entry('a', box('bbox-a', 0, 0), [classNode('c1', 10, 10)]);
    const second = entry('b', box('bbox-b', 20, 0), [classNode('c2', 30, 10)]);
    resolveExpandOverlaps([first, second]);
    expect(second.result.boundingBox.position.x).toBe(430);
    expect(second.result.eObjectNodes[0].position.x).toBe(440);
  });

  it('leaves a restored layout in place', () => {
    const first = entry('a', box('bbox-a', 0, 0), []);
    const second = entry('b', box('bbox-b', 20, 0), [], true);
    resolveExpandOverlaps([first, second]);
    expect(second.result.boundingBox.position.x).toBe(20);
  });
});

describe('shiftExpandedResult', () => {
  it('moves the bbox, classes, and ghosts by the same x delta', () => {
    const result = {
      boundingBox: box('bbox-a', 0, 5),
      eObjectNodes: [classNode('c1', 10, 15)],
      ghostNodes: [classNode('g1', 20, 25)],
      umlEdges: [],
      modelNsUri: 'a',
    } as ExpandedMetaModelResult;
    shiftExpandedResult(result, 40);
    expect(result.boundingBox.position).toEqual({ x: 40, y: 5 });
    expect(result.eObjectNodes[0].position).toEqual({ x: 50, y: 15 });
    expect(result.ghostNodes[0].position).toEqual({ x: 60, y: 25 });
  });
});

describe('storeReactionOffsets', () => {
  it('stores bbox minus original VSUM position', () => {
    const offsets = new Map();
    const vsum = new Map([['ecore-a', { x: 10, y: 20 }]]);
    storeReactionOffsets(
      [entry('ecore-a', box('bbox-http://a', 40, 50), [])],
      vsum,
      offsets,
    );
    expect(offsets.get('bbox-http://a')).toEqual({ dx: 30, dy: 30 });
  });
});

describe('collapseReactionGraph', () => {
  it('drops expanded nodes and restores ecore files using the stored offset', () => {
    const vsum = new Map<string, { x: number; y: number }>();
    const offsets = new Map([['bbox-http://a', { dx: 5, dy: 7 }]]);
    const collapsed = collapseReactionGraph(
      [
        {
          id: 'ecore-a',
          type: 'ecoreFile',
          position: { x: 0, y: 0 },
          hidden: true,
          data: { nsUri: 'http://a' },
        } as Node,
        box('bbox-http://a', 100, 80),
        classNode('eobj', 110, 90),
      ],
      offsets,
      vsum,
    );
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]).toMatchObject({
      id: 'ecore-a',
      hidden: false,
      position: { x: 95, y: 73 },
    });
    expect(vsum.get('ecore-a')).toEqual({ x: 95, y: 73 });
  });
});
