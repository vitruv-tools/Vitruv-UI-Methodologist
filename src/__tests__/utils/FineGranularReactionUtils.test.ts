import { Node } from 'reactflow';
import {
  createExistingFineGranularReactionEdge,
  mergeFineGranularEdges,
  resolveFineGranularEndpointNodeId,
} from '../../utils/FineGranularReactionUtils';

const eobject = (
  id: string,
  model: string,
  eObjectId: string,
  eAttributeIds: string[] = [],
): Node =>
  ({
    id,
    type: 'eobject',
    position: { x: 0, y: 0 },
    data: { ecore: { model, eObjectId, eAttributeIds } },
  }) as Node;

describe('resolveFineGranularEndpointNodeId', () => {
  const nodes = [
    eobject('n1', 'http://families', 'http://families#Member', [
      'http://families#Member.lastName',
    ]),
    eobject('n2', 'http://persons', 'http://persons#Person'),
  ];

  it('matches a class-level EObject id', () => {
    expect(resolveFineGranularEndpointNodeId(nodes, 'http://families#Member', 'http://families'))
      .toBe('n1');
  });

  it('matches an attribute id on the parent class node', () => {
    expect(
      resolveFineGranularEndpointNodeId(
        nodes,
        'http://families#Member.lastName',
        'http://families',
      ),
    ).toBe('n1');
  });

  it('matches a class-level EObject id even when the model hint is a file name', () => {
    expect(
      resolveFineGranularEndpointNodeId(nodes, 'http://families#Member', 'families.ecore'),
    ).toBe('n1');
  });

  it('returns null when no node owns the id', () => {
    expect(resolveFineGranularEndpointNodeId(nodes, 'http://other#X', 'http://families'))
      .toBeNull();
  });
});

describe('createExistingFineGranularReactionEdge', () => {
  it('sets reaction source and target handles from the EObject ids', () => {
    const edge = createExistingFineGranularReactionEdge(
      { id: 1, sourceId: 'http://a#A', targetId: 'http://b#B.x' },
      'http://a',
      'http://b',
      'node-a',
      'node-b',
    );
    expect(edge.sourceHandle).toBe('reaction-source-http://a#A');
    expect(edge.targetHandle).toBe('reaction-target-http://b#B.x');
  });

  it('embeds the persisted FG id and generated file id on the edge', () => {
    const edge = createExistingFineGranularReactionEdge(
      {
        id: 42,
        sourceId: 'http://a#A',
        targetId: 'http://b#B',
        reactionFileStorageId: 88,
      },
      'http://a',
      'http://b',
      'node-a',
      'node-b',
    );
    expect(edge.data?.fineRelationId).toBe(42);
    expect(edge.data?.reactionFileId).toBe(88);
  });
});

describe('mergeFineGranularEdges', () => {
  it('skips pairs that are already present', () => {
    const existing = [
      createExistingFineGranularReactionEdge(
        { id: 1, sourceId: 'a', targetId: 'b' },
        'm1',
        'm2',
        'n1',
        'n2',
      ),
    ];
    const incoming = [
      createExistingFineGranularReactionEdge(
        { id: 1, sourceId: 'a', targetId: 'b' },
        'm1',
        'm2',
        'n1',
        'n2',
      ),
      createExistingFineGranularReactionEdge(
        { id: 2, sourceId: 'c', targetId: 'd' },
        'm1',
        'm2',
        'n3',
        'n4',
      ),
    ];
    const merged = mergeFineGranularEdges(existing, incoming);
    expect(merged).toHaveLength(2);
    expect(merged[1].data?.ecore?.eObjectSourceId).toBe('c');
  });
});
