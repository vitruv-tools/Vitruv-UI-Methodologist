import { Node } from 'reactflow';
import { collectIdentifierMapFromCanvasNodes } from '../../utils/ReactionUtils';

const ecore = (id: string, data: Record<string, unknown>): Node =>
  ({ id, type: 'ecoreFile', position: { x: 0, y: 0 }, data }) as Node;

describe('collectIdentifierMapFromCanvasNodes', () => {
  it('maps nsURI and file name to the backend source id', () => {
    const map = collectIdentifierMapFromCanvasNodes([
      ecore('a', {
        nsUri: 'http://families',
        fileName: 'families.ecore',
        metaModelSourceId: 10,
      }),
      { id: 'other', type: 'eobject', position: { x: 0, y: 0 }, data: {} } as Node,
    ]);
    expect(map.get('http://families')).toBe(10);
    expect(map.get('families.ecore')).toBe(10);
    expect(map.get('families')).toBe(10);
  });

  it('falls back to metaModelId when source id is absent', () => {
    const map = collectIdentifierMapFromCanvasNodes([
      ecore('a', { nsUri: 'http://persons', metaModelId: 22 }),
    ]);
    expect(map.get('http://persons')).toBe(22);
  });
});
