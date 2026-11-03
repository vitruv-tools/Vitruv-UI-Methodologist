import React, { useMemo } from 'react';
import type { Node } from 'reactflow';
import { useProjectOverlapRun, type ProjectOverlapRunDeps } from '../../hooks/useProjectOverlapRun';
import { useProjectSemanticOverlapStore } from '../../store/ProjectSemanticOverlap';
import { ProjectOverlapOverview } from '../semanticOverlap/ProjectOverlapOverview';
import { ProjectPairDetail } from '../semanticOverlap/ProjectPairDetail';

export interface CanvasSemanticOverlapOverlayProps {
  projectId?: number;
  projectName?: string | null;
  visible: boolean;
  canvasNodes: Node[];
  /** For tests: worker factory and pool size of the analysis runs. */
  runDeps?: ProjectOverlapRunDeps;
}

/**
 * Semantic overlap mode of a project: the all-pairs overview, or the closer look at one pair. Stays
 * mounted while hidden, so a running analysis continues in the other modes. Only reads the nodes.
 */
export const CanvasSemanticOverlapOverlay: React.FC<CanvasSemanticOverlapOverlayProps> = ({
  projectId,
  projectName,
  visible,
  canvasNodes,
  runDeps,
}) => {
  // Mounted for as long as the project is open: leaving the project cancels a running analysis.
  const { start, cancel } = useProjectOverlapRun(projectId, runDeps);
  const overview = useProjectSemanticOverlapStore(state => (projectId === undefined ? undefined : state.overviews[projectId]));
  const names = useMemo(() => new Map((overview?.metamodels ?? []).map(m => [m.key, m.name])), [overview?.metamodels]);
  const selectedPair = overview?.selectedPairId ? overview.pairs.find(pair => pair.id === overview.selectedPairId) : undefined;
  const { closePair, setDetailDirection } = useProjectSemanticOverlapStore.getState();

  let content: React.ReactNode = null;
  if (projectId !== undefined && selectedPair && overview) {
    content = (
      <ProjectPairDetail
        pair={selectedPair}
        names={names}
        direction={overview.detailDirection}
        onDirectionChange={direction => setDetailDirection(projectId, direction)}
        onBack={() => closePair(projectId)}
      />
    );
  } else if (projectId !== undefined) {
    content = (
      <ProjectOverlapOverview
        vsumId={projectId}
        projectName={projectName ?? null}
        nodes={canvasNodes}
        onStart={start}
        onCancel={cancel}
      />
    );
  }

  return (
    <div
      data-testid="canvas-semantic-overlap-overlay"
      style={{
        position: 'absolute', top: 72, left: 0, right: 0, bottom: 0,
        display: visible ? 'flex' : 'none', alignItems: 'stretch', justifyContent: 'center',
        zIndex: 100, pointerEvents: 'none', padding: '8px 16px 16px', boxSizing: 'border-box',
      }}
    >
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 1280, height: '100%', display: 'flex', pointerEvents: 'auto', minWidth: 0, minHeight: 0 }}>
        {content}
      </div>
    </div>
  );
};
