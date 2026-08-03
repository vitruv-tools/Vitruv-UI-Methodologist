import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { Node } from 'reactflow';
import type { CanvasMode } from '../components/flow/FlowCanvas';
import { readStoredCanvasMode, writeStoredCanvasMode } from '../utils/canvasModeStorage';

interface UseCanvasModeStateOptions {
  projectId?: number;
  isViewOnly: boolean;
  getCanvasNodes: () => Node[];
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
  handleCanvasModeChange: (mode: CanvasMode) => void;
}

export function useCanvasModeState({
  projectId,
  isViewOnly,
  getCanvasNodes,
}: UseCanvasModeStateOptions): UseCanvasModeStateResult {
  const [canvasMode, setCanvasMode] = useState<CanvasMode>(() => readStoredCanvasMode(projectId));
  const canvasModeRef = useRef<CanvasMode>(canvasMode);
  const [constraintsNodes, setConstraintsNodes] = useState<Node[]>([]);
  const [constraintHighlightNodeId, setConstraintHighlightNodeId] = useState<string | null>(null);
  const [constraintFilterNodeId, setConstraintFilterNodeId] = useState<string | null>(null);

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
    } else {
      setConstraintHighlightNodeId(null);
      setConstraintFilterNodeId(null);
    }
    canvasModeRef.current = mode;
    setCanvasMode(mode);
    writeStoredCanvasMode(projectId, mode);
  }, [getCanvasNodes, isViewOnly, projectId]);

  return {
    canvasMode,
    canvasModeRef,
    constraintsNodes,
    setConstraintsNodes,
    constraintHighlightNodeId,
    setConstraintHighlightNodeId,
    constraintFilterNodeId,
    setConstraintFilterNodeId,
    handleCanvasModeChange,
  };
}
