import { Edge, Node } from 'reactflow';
import {
  mapEcoreFlowNode,
  mapEditableFlowNode,
  mapFlowCanvasEdge,
  type MapFlowEdgeContext,
} from '../../../components/flow/flowCanvasRenderUtils';
import { FINE_REACTION_SEPARATION } from '../../../utils/reactionEdgeGeometry';

const ecoreNode = (id = 'ecore-1'): Node =>
  ({ id, position: { x: 0, y: 0 }, data: { fileName: 'A.ecore' }, type: 'ecoreFile' } as Node);

const editableNode = (id = 'uml-1'): Node =>
  ({ id, position: { x: 0, y: 0 }, data: { label: 'Class' }, type: 'editable' } as Node);

const ecoreOptions = (overrides: Record<string, unknown> = {}) => ({
  readOnly: false,
  expandedFileId: null,
  selectedFileId: null,
  connectionDragState: null,
  addReactionMode: false,
  reactionSourceId: null,
  constraintHighlightNodeId: null,
  constraintFilterNodeId: null,
  edgeDistribution: undefined,
  handleEcoreFileExpand: jest.fn(),
  handleEcoreFileSelect: jest.fn(),
  onEcoreFileDelete: jest.fn(),
  handleRequestDelete: jest.fn(),
  onEcoreFileRename: jest.fn(),
  handleShowDetails: jest.fn(),
  handleConnectionStart: jest.fn(),
  ...overrides,
});

describe('mapEcoreFlowNode', () => {
  it('is draggable for an editor', () => {
    expect(mapEcoreFlowNode(ecoreNode(), ecoreOptions()).draggable).toBe(true);
  });

  it('is draggable for a viewer, so large models can be rearranged locally', () => {
    expect(mapEcoreFlowNode(ecoreNode(), ecoreOptions({ readOnly: true })).draggable).toBe(true);
  });

  it('freezes while a connection is being dragged', () => {
    const options = ecoreOptions({ connectionDragState: { isActive: true } });

    expect(mapEcoreFlowNode(ecoreNode(), options).draggable).toBe(false);
  });

  it('freezes in add-reaction mode, where a drag would fight the click gesture', () => {
    const options = ecoreOptions({ addReactionMode: true });

    expect(mapEcoreFlowNode(ecoreNode(), options).draggable).toBe(false);
  });

  it('still withholds delete and rename from a viewer', () => {
    const mapped = mapEcoreFlowNode(ecoreNode(), ecoreOptions({ readOnly: true }));

    expect(mapped.data.onDelete).toBeUndefined();
    expect(mapped.data.onRequestDelete).toBeUndefined();
    expect(mapped.data.onRename).toBeUndefined();
    expect(mapped.data.readOnly).toBe(true);
  });

  it('still withholds connection starting from a viewer', () => {
    const mapped = mapEcoreFlowNode(
      ecoreNode(),
      ecoreOptions({ readOnly: true, handleConnectionStart: jest.fn() }),
    );

    expect(mapped.data.onConnectionStart).toBeUndefined();
  });

  it('keeps delete and rename available to an editor', () => {
    const mapped = mapEcoreFlowNode(ecoreNode(), ecoreOptions());

    expect(mapped.data.onDelete).toBeDefined();
    expect(mapped.data.onRename).toBeDefined();
  });
});

describe('mapEditableFlowNode', () => {
  const labelChange = jest.fn();
  const removeNode = jest.fn();

  it('is draggable for an editor', () => {
    expect(mapEditableFlowNode(editableNode(), false, labelChange, removeNode).draggable).toBe(true);
  });

  it('is draggable for a viewer', () => {
    expect(mapEditableFlowNode(editableNode(), true, labelChange, removeNode).draggable).toBe(true);
  });

  it('still withholds label editing and deletion from a viewer', () => {
    const mapped = mapEditableFlowNode(editableNode(), true, labelChange, removeNode);

    expect(mapped.data.onLabelChange).toBeUndefined();
    expect(mapped.data.onDelete).toBeUndefined();
  });

  it('keeps label editing and deletion available to an editor', () => {
    const mapped = mapEditableFlowNode(editableNode(), false, labelChange, removeNode);

    expect(mapped.data.onLabelChange).toBe(labelChange);
    expect(mapped.data.onDelete).toBe(removeNode);
  });
});

const emptyMerge = {
  mergePoint: undefined,
  hasMerge: false,
  isFirstInMergeGroup: false,
  mergeGroupSourceNodes: [] as string[],
};

function mapContext(overrides: Partial<MapFlowEdgeContext> = {}): MapFlowEdgeContext {
  return {
    readOnly: false,
    routingStyle: 'orthogonal',
    hoveredMergeGroup: null,
    getDistribution: () => ({}),
    getUmlMerge: () => emptyMerge,
    handleMergeGroupHover: jest.fn(),
    handleEdgeDoubleClick: jest.fn(),
    handleEdgeDragStart: jest.fn(),
    handleEdgeDrag: jest.fn(),
    handleEdgeDragEnd: jest.fn(),
    handleEdgeHandleChange: jest.fn(),
    handleEdgeReorderRequest: jest.fn(),
    ...overrides,
  };
}

describe('mapFlowCanvasEdge fine-granular parallel meta', () => {
  it('stamps parallelCount from the fine-edge indexer', () => {
    const edge = {
      id: 'fg-1',
      source: 'a',
      target: 'b',
      type: 'fine-granular-reaction',
      sourceHandle: 'reaction-source-http://a#A',
      targetHandle: 'reaction-target-http://b#B',
    } as Edge;

    const mapped = mapFlowCanvasEdge(edge, mapContext({
      getFineParallel: () => ({ index: 1, total: 2 }),
    }));

    expect(mapped.data.fineGranular).toBe(true);
    expect(mapped.data.sourceHandleId).toBe('reaction-source-http://a#A');
    expect(mapped.data.targetHandleId).toBe('reaction-target-http://b#B');
    expect(mapped.data.parallelIndex).toBe(1);
    expect(mapped.data.parallelCount).toBe(2);
    expect(mapped.data.separation).toBe(FINE_REACTION_SEPARATION);
    expect(mapped.data.routingStyle).toBe('curved');
  });
});
