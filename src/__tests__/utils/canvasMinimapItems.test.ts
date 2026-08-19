import type { Edge, Node } from 'reactflow';
import { ECORE_FILE_BOX_SIZE } from '../../components/flow/flowCanvasConstants';
import {
  buildMinimapEndpointIndex,
  collectCanvasMinimapItems,
  minimapEdgeSegments,
} from '../../utils/canvasMinimapItems';
import { metaModelDisplayColor } from '../../utils/metaModelColors';

const pcmColor = metaModelDisplayColor('pcm', 'pcm.ecore');
const familiesColor = metaModelDisplayColor(undefined, 'families.ecore');

function ecoreFile(
  id: string,
  fileName: string,
  opts?: { domain?: string; nsUri?: string; hidden?: boolean },
): Node {
  return {
    id,
    type: 'ecoreFile',
    position: { x: 10, y: 20 },
    hidden: opts?.hidden,
    data: {
      fileName,
      domain: opts?.domain,
      nsUri: opts?.nsUri ?? `http://${fileName}`,
    },
  } as Node;
}

describe('collectCanvasMinimapItems', () => {
  it('draws VSUM ecoreFile cards with matching display colors', () => {
    const items = collectCanvasMinimapItems([
      ecoreFile('pcm', 'pcm.ecore', { domain: 'pcm' }),
      ecoreFile('fam', 'families.ecore'),
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: 'pcm',
      kind: 'ecoreFile',
      width: ECORE_FILE_BOX_SIZE.width,
      height: ECORE_FILE_BOX_SIZE.height,
      color: pcmColor,
    });
    expect(items[1].color).toBe(familiesColor);
  });

  it('skips hidden ecoreFile cards', () => {
    const items = collectCanvasMinimapItems([
      ecoreFile('pcm', 'pcm.ecore', { domain: 'pcm', hidden: true }),
    ]);
    expect(items).toEqual([]);
  });

  it('in reactions mode draws bounding boxes and EObjects instead of hidden cards', () => {
    const nodes: Node[] = [
      ecoreFile('pcm', 'pcm.ecore', { domain: 'pcm', hidden: true }),
      {
        id: 'bbox-http://pcm',
        type: 'boundingBox',
        position: { x: 50, y: 80 },
        data: {
          label: 'pcm',
          color: pcmColor,
          domain: 'pcm',
          nsUri: 'http://pcm',
          width: 400,
          height: 300,
        },
      },
      {
        id: 'eobject-pcm-Component',
        type: 'eobject',
        position: { x: 80, y: 140 },
        data: {
          label: 'pcm',
          group: 'bbox-http://pcm',
          color: pcmColor,
          attributes: [{ name: 'id' }, { name: 'name' }],
        },
      },
    ];

    const items = collectCanvasMinimapItems(nodes);
    expect(items.map(i => i.kind)).toEqual(['boundingBox', 'eobject']);
    expect(items[0]).toMatchObject({
      id: 'bbox-http://pcm',
      color: pcmColor,
    });
    expect(items[1]).toMatchObject({
      kind: 'eobject',
      color: pcmColor,
      width: 200,
      height: 32 + 2 * 24 + 4,
    });
    expect(items[1].x).toBeGreaterThanOrEqual(items[0].x);
    expect(items[1].y).toBeGreaterThanOrEqual(items[0].y);
    expect(items[1].x + items[1].width).toBeLessThanOrEqual(items[0].x + items[0].width);
    expect(items[1].y + items[1].height).toBeLessThanOrEqual(items[0].y + items[0].height);
  });

  it('refits the bounding box when EObjects are dragged outside the original box', () => {
    const nodes: Node[] = [
      {
        id: 'bbox-a',
        type: 'boundingBox',
        position: { x: 0, y: 0 },
        data: { label: 'a', color: '#fca5a5', width: 200, height: 150 },
      },
      {
        id: 'e1',
        type: 'eobject',
        position: { x: 400, y: 300 },
        data: { group: 'bbox-a', color: '#fca5a5', attributes: [] },
      },
    ];

    const items = collectCanvasMinimapItems(nodes);
    const box = items.find(i => i.kind === 'boundingBox')!;
    const child = items.find(i => i.kind === 'eobject')!;

    expect(box.x).toBeGreaterThan(0);
    expect(box.y).toBeGreaterThan(0);
    expect(child.x).toBeGreaterThanOrEqual(box.x);
    expect(child.y).toBeGreaterThanOrEqual(box.y);
    expect(child.x + child.width).toBeLessThanOrEqual(box.x + box.width);
    expect(child.y + child.height).toBeLessThanOrEqual(box.y + box.height);
  });
});

describe('minimap edges in reactions mode', () => {
  const bboxA: Node = {
    id: 'bbox-http://a',
    type: 'boundingBox',
    position: { x: 0, y: 0 },
    data: { label: 'a', color: '#fca5a5', nsUri: 'http://a', width: 200, height: 100 },
  };
  const bboxB: Node = {
    id: 'bbox-http://b',
    type: 'boundingBox',
    position: { x: 400, y: 0 },
    data: { label: 'b', color: '#86efac', nsUri: 'http://b', width: 200, height: 100 },
  };
  const eobjA: Node = {
    id: 'eobj-a',
    type: 'eobject',
    position: { x: 20, y: 40 },
    data: { group: 'bbox-http://a', color: '#fca5a5', attributes: [] },
  };
  const eobjB: Node = {
    id: 'eobj-b',
    type: 'eobject',
    position: { x: 420, y: 40 },
    data: { group: 'bbox-http://b', color: '#86efac', attributes: [] },
  };

  it('draws fine-granular reaction edges between EObject nodes', () => {
    const nodes = [bboxA, bboxB, eobjA, eobjB];
    const items = collectCanvasMinimapItems(nodes);
    const index = buildMinimapEndpointIndex(nodes, items);
    const edges: Edge[] = [
      { id: 'fg-1', source: 'eobj-a', target: 'eobj-b' },
    ];
    const segs = minimapEdgeSegments(edges, items, index);
    expect(segs).toHaveLength(1);
    expect(segs[0].x1).toBe(20 + 100);
    expect(segs[0].x2).toBe(420 + 100);
  });

  it('maps coarse ecoreFile reaction edges onto bounding boxes', () => {
    const nodes = [
      bboxA,
      bboxB,
      eobjA,
      eobjB,
      ecoreFile('ecore-a', 'a.ecore', { nsUri: 'http://a', hidden: true }),
      ecoreFile('ecore-b', 'b.ecore', { nsUri: 'http://b', hidden: true }),
    ];
    const items = collectCanvasMinimapItems(nodes);
    const index = buildMinimapEndpointIndex(nodes, items);
    const edges: Edge[] = [
      { id: 'coarse-1', source: 'ecore-a', target: 'ecore-b' },
    ];
    const segs = minimapEdgeSegments(edges, items, index);
    const boxA = items.find(i => i.id === 'bbox-http://a')!;
    const boxB = items.find(i => i.id === 'bbox-http://b')!;
    expect(segs).toHaveLength(1);
    expect(segs[0].x1).toBe(boxA.x + boxA.width / 2);
    expect(segs[0].x2).toBe(boxB.x + boxB.width / 2);
  });
});
