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

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 420 }}>
      <div style={{ position: 'absolute', top: 8, left: 8, right: 8, zIndex: 5, display: 'flex', justifyContent: 'space-between', pointerEvents: 'none' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: themeVars.textMuted }}>{result.source.name}</span>
        <label style={{ fontSize: 12, color: themeVars.textSecondary, pointerEvents: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={!collapsedUnmatched}
            onChange={event => onToggleUnmatched(!event.target.checked)}
          />
          Show unmatched classes
        </label>
        <span style={{ fontSize: 12, fontWeight: 600, color: themeVars.textMuted }}>{result.target.name}</span>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
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
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
};
