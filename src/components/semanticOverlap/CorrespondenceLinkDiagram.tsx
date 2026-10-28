import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap, type Edge, type Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { themeVars } from '../../theme/theme';
import {
  buildLinkDiagram,
  OVERLAP_CLASS_NODE,
  SCORE_EDGE,
  type OverlapClassNodeData,
  type ScoreEdgeData,
} from '../../utils/semanticOverlap/linkDiagramLayout';
import type { OverlapResult } from '../../utils/semanticOverlap/types';
import { OverlapClassNode } from './OverlapClassNode';
import { ScoreEdge } from './ScoreEdge';

const nodeTypes = { [OVERLAP_CLASS_NODE]: OverlapClassNode };
const edgeTypes = { [SCORE_EDGE]: ScoreEdge };

interface CorrespondenceLinkDiagramProps {
  result: OverlapResult;
  minScore: number;
  selectedId: string | null;
  collapsedUnmatched: boolean;
  expandedIds: readonly string[];
  onSelect: (correspondenceId: string | null) => void;
  onToggleUnmatched: (collapsed: boolean) => void;
  onToggleExpand: (correspondenceId: string) => void;
}

/** Read-only React Flow view: source classes left, target classes right, score-weighted links. */
export const CorrespondenceLinkDiagram: React.FC<CorrespondenceLinkDiagramProps> = ({
  result, minScore, selectedId, collapsedUnmatched, expandedIds, onSelect, onToggleUnmatched, onToggleExpand,
}) => {
  const { nodes, edges } = useMemo(() => {
    const diagram = buildLinkDiagram(result, { minScore, selectedId, collapsedUnmatched, expandedIds });
    return {
      edges: diagram.edges,
      nodes: diagram.nodes.map(node => ({ ...node, data: { ...node.data, onToggleExpand } })),
    };
  }, [result, minScore, selectedId, collapsedUnmatched, expandedIds, onToggleExpand]);

  // Fit the view to the matched classes (usually at the top); unmatched ones stay reachable by
  // scrolling or zooming out. Computed once per result, as the view is fitted on mount only.
  const fitViewOptions = useMemo(() => {
    const matched = buildLinkDiagram(result, { minScore: 0, selectedId: null, collapsedUnmatched: true })
      .nodes.map(node => ({ id: node.id }));
    return { padding: 0.1, maxZoom: 1, nodes: matched.length > 0 ? matched : undefined };
  }, [result]);

  return (
    <div className="semantic-overlap-diagram" style={{ height: '100%', minHeight: 420, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 12px',
        borderBottom: `1px solid ${themeVars.borderSubtle}`, background: themeVars.surface,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: themeVars.textMuted }}>{result.source.name}</span>
        <label style={{ fontSize: 12, color: themeVars.textSecondary, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={!collapsedUnmatched}
            onChange={event => onToggleUnmatched(!event.target.checked)}
          />
          Show unmatched classes
        </label>
        <span style={{ fontSize: 12, fontWeight: 600, color: themeVars.textMuted }}>{result.target.name}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <ReactFlow
          // Remount per result so the new graph is fitted into view.
          key={result.id}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={fitViewOptions}
          minZoom={0.2}
          onlyRenderVisibleElements
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_event: React.MouseEvent, node: Node<OverlapClassNodeData>) =>
            onSelect(node.data.correspondenceIds[0] ?? null)}
          onEdgeClick={(_event: React.MouseEvent, edge: Edge<ScoreEdgeData>) =>
            onSelect(edge.data?.correspondenceId ?? null)}
          onPaneClick={() => onSelect(null)}
        >
          <Background gap={24} size={1} color={themeVars.workspaceDot} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable style={{ width: 120, height: 90 }} />
        </ReactFlow>
      </div>
    </div>
  );
};
