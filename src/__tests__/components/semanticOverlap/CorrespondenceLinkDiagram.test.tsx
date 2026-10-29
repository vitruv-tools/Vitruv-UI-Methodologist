import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CorrespondenceLinkDiagram } from '../../../components/semanticOverlap/CorrespondenceLinkDiagram';
import { ScoreEdge, INSTANCE_DASH } from '../../../components/semanticOverlap/ScoreEdge';
import { correspondenceFor, sampleImprovedResult, sampleResult } from './sampleResult';

const flowProps = vi.hoisted(() => ({ current: null as any }));

vi.mock('reactflow', () => ({
  __esModule: true,
  default: (props: any) => {
    flowProps.current = props;
    return <div data-testid="reactflow">{props.children}</div>;
  },
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
  EdgeLabelRenderer: ({ children }: any) => <>{children}</>,
  getBezierPath: () => ['M0 0', 0, 0],
}));

const result = sampleResult();

const renderDiagram = (props: Partial<React.ComponentProps<typeof CorrespondenceLinkDiagram>> = {}) => {
  const handlers = { onSelect: vi.fn(), onToggleUnmatched: vi.fn(), onToggleExpand: vi.fn() };
  render(<CorrespondenceLinkDiagram result={result} minScore={0} selectedId={null} collapsedUnmatched={false} expandedIds={[]} {...handlers} {...props} />);
  return handlers;
};

describe('CorrespondenceLinkDiagram', () => {
  it('renders a read-only React Flow graph with culling', () => {
    renderDiagram();
    const props = flowProps.current;
    expect(props.nodes).toHaveLength(6);
    expect(props.edges.length).toBeGreaterThanOrEqual(3);
    expect(props).toMatchObject({ onlyRenderVisibleElements: true, nodesDraggable: false, nodesConnectable: false, fitView: true });
    expect(Object.keys(props.nodeTypes)).toEqual(['overlapClass']);
    expect(Object.keys(props.edgeTypes)).toEqual(['score']);
  });

  it('selects the correspondence of a clicked edge or node', () => {
    const handlers = renderDiagram();
    const property = correspondenceFor(result, 'EAttribute');
    const edge = flowProps.current.edges.find((e: any) => e.data.correspondenceId === property.id);
    flowProps.current.onEdgeClick({}, edge);
    expect(handlers.onSelect).toHaveBeenLastCalledWith(property.id);
    const association = flowProps.current.nodes.find((n: any) => n.data.label === 'Association');
    flowProps.current.onNodeClick({}, association);
    expect(handlers.onSelect).toHaveBeenLastCalledWith(null);
  });

  it('toggles unmatched classes', () => {
    const handlers = renderDiagram();
    fireEvent.click(screen.getByLabelText('Show unmatched classes'));
    expect(handlers.onToggleUnmatched).toHaveBeenCalledWith(true);
  });

  it('passes the expand toggle to the nodes and shows features of expanded correspondences', () => {
    const eclass = correspondenceFor(result, 'EClass');
    const handlers = renderDiagram({ expandedIds: [eclass.id] });
    const classNode = flowProps.current.nodes.find((n: any) => n.data.label === 'EClass');
    expect(classNode.data).toMatchObject({ expandable: true, expanded: true });
    classNode.data.onToggleExpand(eclass.id);
    expect(handlers.onToggleExpand).toHaveBeenCalledWith(eclass.id);
    expect(flowProps.current.nodes.some((n: any) => n.data.level === 'feature')).toBe(true);
  });

  describe('class ↔ instance correspondences', () => {
    const improved = sampleImprovedResult();
    const bolt = correspondenceFor(improved, 'Bolt');

    it('labels instance edges and leaves same-concept edges unlabelled', () => {
      renderDiagram({ result: improved, expandedIds: [bolt.id] });
      const edges = flowProps.current.edges;
      const boltEdge = edges.find((e: any) => e.data.correspondenceId === bolt.id);
      expect(boltEdge.data.instanceLabel).toBe('instance of ProductKind');
      const part = correspondenceFor(improved, 'Part');
      expect(edges.find((e: any) => e.data.correspondenceId === part.id).data.instanceLabel).toBeUndefined();
      const child = edges.find((e: any) => e.data.level === 'feature' && e.data.instanceLabel?.includes('(definition)'));
      expect(child.data.instanceLabel).toMatch(/^instance of \w+Feature \(definition\)$/);
    });

    it('draws instance edges dashed with their label', () => {
      const props = {
        id: 'e', sourceX: 0, sourceY: 0, targetX: 10, targetY: 10, sourcePosition: 'right', targetPosition: 'left',
        data: { correspondenceId: 'c-1', level: 'class', score: 1, selected: true, instanceLabel: 'instance of ProductKind' },
      } as any;
      const { container } = render(<svg><ScoreEdge {...props} /></svg>);
      expect(container.querySelector('path')?.getAttribute('stroke-dasharray')).toBe(INSTANCE_DASH);
      expect(screen.getByText('instance of ProductKind · 100 %')).toBeInTheDocument();
      const { container: solid } = render(<svg><ScoreEdge {...props} data={{ ...props.data, instanceLabel: undefined }} /></svg>);
      expect(solid.querySelector('path')?.getAttribute('stroke-dasharray')).toBeNull();
    });
  });
});

