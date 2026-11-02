import type { Edge, Node } from 'reactflow';
import {
  findMetaModelNodeByFileId,
  findReactionEdgeByFileId,
} from '../../../components/flow/flowCanvasProblemNavigation';

describe('flowCanvasProblemNavigation', () => {
  const edges = [
    { id: 'uml', source: 'a', target: 'b', type: 'uml', data: { reactionFileId: 7 } },
    { id: 'fine', source: 'a', target: 'b', type: 'fine-granular-reaction', data: { reactionFileId: 7 } },
    { id: 'coarse', source: 'a', target: 'b', type: 'reactions', data: { reactionFileId: '7' } },
  ] as Edge[];

  it('finds the coarse reaction edge of a reaction file, also with string ids', () => {
    expect(findReactionEdgeByFileId(edges, 7)?.id).toBe('coarse');
    expect(findReactionEdgeByFileId(edges, 8)).toBeUndefined();
  });

  const nodes = [
    { id: 'n1', type: 'editable', position: { x: 0, y: 0 }, data: { ecoreFileId: 3 } },
    { id: 'n2', type: 'ecoreFile', position: { x: 0, y: 0 }, data: { ecoreFileId: 3, genModelFileId: 4 } },
    { id: 'n3', type: 'ecoreFile', position: { x: 0, y: 0 }, data: {} },
  ] as Node[];

  it('finds the metamodel box by its ecore or genmodel file id', () => {
    expect(findMetaModelNodeByFileId(nodes, 3)?.id).toBe('n2');
    expect(findMetaModelNodeByFileId(nodes, 4)?.id).toBe('n2');
    expect(findMetaModelNodeByFileId(nodes, 5)).toBeUndefined();
  });
});
