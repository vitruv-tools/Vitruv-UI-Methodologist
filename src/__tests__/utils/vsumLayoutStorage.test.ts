import type { Node } from 'reactflow';
import {
  captureVsumLayout,
  loadVsumLayout,
  loadVsumLayoutPosition,
  lookupVsumLayoutPosition,
  persistVsumLayoutFromNodes,
  saveVsumLayout,
  sanitizeVsumLayoutMap,
  upsertVsumLayoutPosition,
  vsumLayoutKeys,
  vsumLayoutStorageKey,
} from '../../utils/vsumLayoutStorage';

describe('vsumLayoutStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const ecore = (
    id: string,
    x: number,
    y: number,
    data: Record<string, unknown> = {},
  ): Node =>
    ({
      id,
      type: 'ecoreFile',
      position: { x, y },
      data,
    }) as Node;

  it('namespaces storage keys by project id', () => {
    expect(vsumLayoutStorageKey(7)).toBe('vitruv.vsum.layout.v1.7');
  });

  it('captures ecoreFile positions under stable aliases', () => {
    const layout = captureVsumLayout([
      ecore('ecore-12', 40, 80, {
        metaModelId: 12,
        metaModelSourceId: 12,
        nsUri: 'http://pcm',
        fileName: 'pcm.ecore',
      }),
      { id: 'bbox-x', type: 'boundingBox', position: { x: 1, y: 2 }, data: {} } as Node,
    ]);
    expect(layout['mm:12']).toEqual({ x: 40, y: 80 });
    expect(layout['ns:http://pcm']).toEqual({ x: 40, y: 80 });
    expect(layout['file:pcm.ecore']).toEqual({ x: 40, y: 80 });
    expect(layout['id:ecore-12']).toEqual({ x: 40, y: 80 });
  });

  it('round-trips through localStorage', () => {
    persistVsumLayoutFromNodes(3, [
      ecore('ecore-1', 120, 340, { metaModelId: 1, nsUri: 'http://a' }),
    ]);
    expect(loadVsumLayoutPosition(3, { metaModelId: 1 })).toEqual({ x: 120, y: 340 });
    expect(loadVsumLayoutPosition(3, { nsUri: 'http://a' })).toEqual({ x: 120, y: 340 });
    expect(loadVsumLayout(9)).toEqual({});
  });

  it('looks up a saved box by any identity alias', () => {
    const layout = { 'mm:4': { x: 9, y: 8 }, 'ns:http://pcm': { x: 9, y: 8 } };
    expect(lookupVsumLayoutPosition(layout, { nsUri: 'http://pcm' })).toEqual({ x: 9, y: 8 });
    expect(lookupVsumLayoutPosition(layout, { metaModelId: 4 })).toEqual({ x: 9, y: 8 });
    expect(lookupVsumLayoutPosition(layout, { fileName: 'missing.ecore' })).toBeUndefined();
  });

  it('merges a newly added model without dropping others', () => {
    saveVsumLayout(2, { 'mm:1': { x: 10, y: 20 } });
    upsertVsumLayoutPosition(2, { metaModelId: 2, fileName: 'b.ecore' }, { x: 50, y: 60 });
    const stored = loadVsumLayout(2);
    expect(stored['mm:1']).toEqual({ x: 10, y: 20 });
    expect(stored['mm:2']).toEqual({ x: 50, y: 60 });
    expect(stored['file:b.ecore']).toEqual({ x: 50, y: 60 });
  });

  it('merges persist of the current canvas without dropping unloaded models', () => {
    saveVsumLayout(4, { 'mm:2': { x: 1, y: 2 } });
    persistVsumLayoutFromNodes(4, [
      ecore('ecore-1', 9, 8, { metaModelId: 1 }),
    ]);
    const stored = loadVsumLayout(4);
    expect(stored['mm:1']).toEqual({ x: 9, y: 8 });
    expect(stored['mm:2']).toEqual({ x: 1, y: 2 });
  });

  it('does not write when the captured map is empty', () => {
    persistVsumLayoutFromNodes(5, [
      { id: 'bbox', type: 'boundingBox', position: { x: 1, y: 2 }, data: {} } as Node,
    ]);
    expect(loadVsumLayout(5)).toEqual({});
  });

  it('drops invalid coords when sanitizing', () => {
    expect(sanitizeVsumLayoutMap({
      'mm:1': { x: 1, y: Number.NaN },
      'mm:2': { x: 4, y: 5 },
      '': { x: 1, y: 2 },
    })).toEqual({
      'mm:2': { x: 4, y: 5 },
    });
  });

  it('does not let two versions of one package overwrite each other nsURI slot', () => {
    const layout = captureVsumLayout([
      ecore('ecore-10', 10, 20, { metaModelId: 10, nsUri: 'http://pcm', fileName: 'pcm (1.0).ecore' }),
      ecore('ecore-11', 300, 20, { metaModelId: 11, nsUri: 'http://pcm', fileName: 'pcm (2.0).ecore' }),
    ]);
    expect(layout['mm:10']).toEqual({ x: 10, y: 20 });
    expect(layout['mm:11']).toEqual({ x: 300, y: 20 });
    expect(layout['ns:http://pcm']).toBeUndefined();
  });

  it('builds mm/ns/file/id keys in lookup order', () => {
    expect(vsumLayoutKeys({
      metaModelId: 3,
      metaModelSourceId: 9,
      nsUri: 'http://x',
      fileName: 'x.ecore',
      nodeId: 'ecore-3',
    })).toEqual(['mm:3', 'mm:9', 'ns:http://x', 'file:x.ecore', 'id:ecore-3']);
  });
});
