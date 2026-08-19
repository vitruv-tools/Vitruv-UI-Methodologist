import type { Node } from 'reactflow';
import {
  applyReactionLayout,
  captureReactionLayout,
  loadReactionLayout,
  reactionLayoutStorageKey,
  saveReactionLayout,
  sanitizeReactionLayoutMap,
} from '../../utils/reactionLayoutStorage';

describe('reactionLayoutStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const bbox = (nsUri: string, x: number, y: number, w = 400, h = 300): Node =>
    ({
      id: `bbox-${nsUri}`,
      type: 'boundingBox',
      position: { x, y },
      data: { nsUri, isBoundingBox: true, width: w, height: h },
      style: { width: w, height: h },
    }) as Node;

  const eobject = (nsUri: string, name: string, x: number, y: number): Node =>
    ({
      id: `eobject-${nsUri}-${name}`,
      type: 'eobject',
      position: { x, y },
      data: {
        className: name,
        group: `bbox-${nsUri}`,
        ecore: { model: nsUri, eObjectId: `${nsUri}#${name}` },
      },
    }) as Node;

  it('namespaces storage keys by project id', () => {
    expect(reactionLayoutStorageKey(7)).toBe('vitruv.reactions.layout.v1.7');
  });

  it('captures bbox and class positions by nsURI', () => {
    const layout = captureReactionLayout([
      bbox('http://pcm', 10, 20),
      eobject('http://pcm', 'Component', 40, 80),
      { id: 'ecore-1', type: 'ecoreFile', position: { x: 0, y: 0 }, data: {} } as Node,
    ]);
    expect(layout['http://pcm'].bbox).toMatchObject({ x: 10, y: 20, width: 400, height: 300 });
    expect(layout['http://pcm'].classes['http://pcm#Component']).toEqual({ x: 40, y: 80 });
  });

  it('round-trips through localStorage', () => {
    const captured = captureReactionLayout([
      bbox('http://pcm', 12, 34),
      eobject('http://pcm', 'Component', 50, 60),
    ]);
    saveReactionLayout(3, captured);
    expect(loadReactionLayout(3)['http://pcm'].classes['http://pcm#Component']).toEqual({
      x: 50,
      y: 60,
    });
    expect(loadReactionLayout(9)).toEqual({});
  });

  it('applies saved class positions and moves unsaved classes with the bbox', () => {
    const target = {
      modelNsUri: 'http://pcm',
      boundingBox: bbox('http://pcm', 0, 0),
      eObjectNodes: [
        eobject('http://pcm', 'Component', 50, 70),
        eobject('http://pcm', 'Interface', 80, 90),
      ],
      ghostNodes: [],
      umlEdges: [],
    };
    const applied = applyReactionLayout(target, {
      bbox: { x: 100, y: 200, width: 420, height: 310 },
      classes: { 'http://pcm#Component': { x: 130, y: 240 } },
    });
    expect(applied).toBe(true);
    expect(target.boundingBox.position).toEqual({ x: 100, y: 200 });
    expect(target.eObjectNodes[0].position).toEqual({ x: 130, y: 240 });
    expect(target.eObjectNodes[1].position).toEqual({ x: 180, y: 290 });
  });

  it('drops invalid coords when sanitizing', () => {
    expect(sanitizeReactionLayoutMap({
      'http://pcm': { bbox: { x: 1, y: Number.NaN }, classes: {} },
      'http://ok': { bbox: { x: 2, y: 3 }, classes: { A: { x: 4, y: 5 } } },
    })).toEqual({
      'http://ok': { bbox: { x: 2, y: 3 }, classes: { A: { x: 4, y: 5 } } },
    });
  });
});
