import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { Edge, Node } from 'reactflow';
import type { CanvasMode } from '../components/flow/FlowCanvas';
import type { ViewType } from './useViewTypes';
import { readStoredCanvasMode, writeStoredCanvasMode } from '../utils/canvasModeStorage';

interface UseCanvasModeStateOptions {
  projectId?: number;
  isViewOnly: boolean;
  getCanvasNodes: () => Node[];
  getCanvasEdges?: () => Edge[];
  getViewTypes?: () => ViewType[];
}

interface UseCanvasModeStateResult {
  canvasMode: CanvasMode;
  canvasModeRef: RefObject<CanvasMode>;
  constraintsNodes: Node[];
  setConstraintsNodes: Dispatch<SetStateAction<Node[]>>;
  constraintHighlightNodeId: string | null;
  setConstraintHighlightNodeId: Dispatch<SetStateAction<string | null>>;
  constraintFilterNodeId: string | null;
  setConstraintFilterNodeId: Dispatch<SetStateAction<string | null>>;
  metricsNodes: Node[];
  setMetricsNodes: Dispatch<SetStateAction<Node[]>>;
  metricsEdges: Edge[];
  setMetricsEdges: Dispatch<SetStateAction<Edge[]>>;
  metricsViewTypes: ViewType[];
  setMetricsViewTypes: Dispatch<SetStateAction<ViewType[]>>;
  handleCanvasModeChange: (mode: CanvasMode) => void;
}

function snapshotMetricsWorkspace(
  getCanvasNodes: () => Node[],
  getCanvasEdges: (() => Edge[]) | undefined,
  getViewTypes: (() => ViewType[]) | undefined,
): { nodes: Node[]; edges: Edge[]; viewTypes: ViewType[] } {
  return {
    nodes: getCanvasNodes(),
    edges: getCanvasEdges?.() ?? [],
    viewTypes: getViewTypes?.() ?? [],
  };
}

export function useCanvasModeState({
  projectId,
  isViewOnly,
  getCanvasNodes,
  getCanvasEdges,
  getViewTypes,
}: UseCanvasModeStateOptions): UseCanvasModeStateResult {
  const [canvasMode, setCanvasMode] = useState<CanvasMode>(() => readStoredCanvasMode(projectId));
  const canvasModeRef = useRef<CanvasMode>(canvasMode);
  const [constraintsNodes, setConstraintsNodes] = useState<Node[]>([]);
  const [constraintHighlightNodeId, setConstraintHighlightNodeId] = useState<string | null>(null);
  const [constraintFilterNodeId, setConstraintFilterNodeId] = useState<string | null>(null);
  const [metricsNodes, setMetricsNodes] = useState<Node[]>([]);
  const [metricsEdges, setMetricsEdges] = useState<Edge[]>([]);
  const [metricsViewTypes, setMetricsViewTypes] = useState<ViewType[]>([]);

  useEffect(() => {
    if (isViewOnly && canvasMode === 'constraints') {
      setCanvasMode('modeling');
      canvasModeRef.current = 'modeling';
      writeStoredCanvasMode(projectId, 'modeling');
    }
  }, [projectId, isViewOnly, canvasMode]);

  useEffect(() => {
    if (!projectId) return;
    const storedMode = readStoredCanvasMode(projectId);
    const nextMode = isViewOnly && storedMode === 'constraints' ? 'modeling' : storedMode;
    canvasModeRef.current = nextMode;
    setCanvasMode(nextMode);
    if (nextMode !== storedMode) writeStoredCanvasMode(projectId, nextMode);
  }, [projectId, isViewOnly]);

  const handleCanvasModeChange = useCallback((mode: CanvasMode) => {
    if (mode === 'constraints' && isViewOnly) return;
    if (mode === 'constraints') {
      setConstraintsNodes(getCanvasNodes());
    } else if (mode === 'metrics') {
      const snapshot = snapshotMetricsWorkspace(getCanvasNodes, getCanvasEdges, getViewTypes);
      setMetricsNodes(snapshot.nodes);
      setMetricsEdges(snapshot.edges);
      setMetricsViewTypes(snapshot.viewTypes);
    } else {
      setConstraintHighlightNodeId(null);
      setConstraintFilterNodeId(null);
    }
    canvasModeRef.current = mode;
    setCanvasMode(mode);
    writeStoredCanvasMode(projectId, mode);
  }, [getCanvasEdges, getCanvasNodes, getViewTypes, isViewOnly, projectId]);

  return {
    canvasMode,
    canvasModeRef,
    constraintsNodes,
    setConstraintsNodes,
    constraintHighlightNodeId,
    setConstraintHighlightNodeId,
    constraintFilterNodeId,
    setConstraintFilterNodeId,
    metricsNodes,
    setMetricsNodes,
    metricsEdges,
    setMetricsEdges,
    metricsViewTypes,
    setMetricsViewTypes,
    handleCanvasModeChange,
  };
}
