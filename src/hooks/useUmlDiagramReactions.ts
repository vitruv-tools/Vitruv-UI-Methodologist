import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { CodeEditorState } from '../components/flow/flowCanvasTypes';
import {
  buildDefaultUmlReactionConfig,
  getUmlReactionPortPosition,
  resolveUmlReactionClassContext,
  type UmlReactionDragState,
  type UmlReactionPortSide,
} from '../components/canvas/umlDiagramReactionUtils';
import type { UmlDiagramClass } from '../components/canvas/umlDiagramTypes';
import type {
  ReactionConfig,
  ReactionEdge,
  ReactionsModel,
} from '../types/reactions';
import type { UMLRelationship } from '../utils/ecoreToUml';
import { buildInitialReactionCodeFromConfig } from '../utils/reactionCode';
import {
  fetchReactionCode,
  persistReactionCode,
} from '../utils/reactionFile';

type ReactionDragCleanup = () => void;

export interface UseUmlDiagramReactionsOptions {
  classes: UmlDiagramClass[];
  relationships: UMLRelationship[];
  primaryEcore: string;
  primaryModelName: string;
  primaryModelId: number;
  reactionModels: ReactionsModel[];
  interactive: boolean;
  reactionsMode: 'uml' | 'reactions';
  selectedRelationshipId: string | null;
  offsetX: number;
  offsetY: number;
  clientToDiagram: (clientX: number, clientY: number) => {
    x: number;
    y: number;
  };
  onRecordChange: () => void;
  onAppendRenderedRelationship: (
    relationship: UMLRelationship,
  ) => void;
  onUpdateRenderedRelationship: (
    relationshipId: string,
    patch: Partial<UMLRelationship>,
  ) => void;
  onRemoveRenderedRelationship: (relationshipId: string) => void;
  onSelectRelationship: (relationshipId: string | null) => void;
  onSelectClass: (classId: string | null) => void;
  onResetConnectionMode: () => void;
}

export interface UseUmlDiagramReactionsResult {
  reactionEdges: ReactionEdge[];
  reactionDrag: UmlReactionDragState | null;
  editingReactionId: string | null;
  reactionEditorState: CodeEditorState | null;
  editingReaction: ReactionEdge | null;
  selectedRelationshipIsReaction: boolean;
  addReactionConnection: (
    sourceClassId: string,
    targetClassId: string,
  ) => void;
  updateReactionConfig: (
    reactionId: string,
    config: ReactionConfig,
  ) => void;
  deleteReaction: (reactionId: string) => void;
  openReactionEditor: (reactionId: string) => Promise<void>;
  closeReactionEditor: () => void;
  saveReactionCode: (code: string) => Promise<void>;
  deleteReactionFromEditor: () => void;
  closeReactionConfiguration: () => void;
  handleReactionPortMouseDown: (
    event: ReactMouseEvent,
    classId: string,
    side: UmlReactionPortSide,
  ) => void;
  handleReactionRelationshipClick: (
    relationshipId: string,
    clickDetail: number,
  ) => boolean;
  cancelReactionInteraction: () => boolean;
  isReactionDragActive: () => boolean;
}

function getReactionPortTargetClassId(
  hit: HTMLElement | null,
  sourceClassId: string,
): string | null {
  const port = hit?.closest('[data-reaction-port]') as HTMLElement | null;
  const targetClassId = port?.dataset.classId;
  if (!targetClassId || targetClassId === sourceClassId) return null;
  return targetClassId;
}

export function useUmlDiagramReactions({
  classes,
  relationships,
  primaryEcore,
  primaryModelName,
  primaryModelId,
  reactionModels,
  interactive,
  reactionsMode,
  selectedRelationshipId,
  offsetX,
  offsetY,
  clientToDiagram,
  onRecordChange,
  onAppendRenderedRelationship,
  onUpdateRenderedRelationship,
  onRemoveRenderedRelationship,
  onSelectRelationship,
  onSelectClass,
  onResetConnectionMode,
}: UseUmlDiagramReactionsOptions): UseUmlDiagramReactionsResult {
  const [reactionEdges, setReactionEdges] = useState<ReactionEdge[]>([]);
  const [reactionDrag, setReactionDrag] = useState<
    UmlReactionDragState | null
  >(null);
  const [editingReactionId, setEditingReactionId] = useState<string | null>(
    null,
  );
  const [reactionEditorState, setReactionEditorState] = useState<
    CodeEditorState | null
  >(null);
  const reactionDragActiveRef = useRef(false);
  const reactionDragCleanupRef = useRef<ReactionDragCleanup | null>(null);

  const cleanupReactionDragListeners = useCallback(() => {
    reactionDragCleanupRef.current?.();
    reactionDragCleanupRef.current = null;
  }, []);

  const stopReactionDrag = useCallback(() => {
    reactionDragActiveRef.current = false;
    cleanupReactionDragListeners();
    setReactionDrag(null);
  }, [cleanupReactionDragListeners]);

  useEffect(() => () => {
    reactionDragActiveRef.current = false;
    cleanupReactionDragListeners();
  }, [cleanupReactionDragListeners]);

  useEffect(() => {
    const visibleClassIds = new Set(classes.map(umlClass => umlClass.id));
    const removedEdges = reactionEdges.filter(
      edge => !visibleClassIds.has(edge.sourceClassId)
        || !visibleClassIds.has(edge.targetClassId),
    );
    if (removedEdges.length === 0) return;

    const removedIds = new Set(removedEdges.map(edge => edge.id));
    setReactionEdges(current => current.filter(
      edge => !removedIds.has(edge.id),
    ));
    removedEdges.forEach(edge => {
      onRemoveRenderedRelationship(edge.id);
    });
    setEditingReactionId(current => (
      current && removedIds.has(current) ? null : current
    ));
    setReactionEditorState(current => (
      current?.edgeId && removedIds.has(current.edgeId) ? null : current
    ));
    if (
      selectedRelationshipId
      && removedIds.has(selectedRelationshipId)
    ) {
      onSelectRelationship(null);
    }
  }, [
    classes,
    reactionEdges,
    selectedRelationshipId,
    onRemoveRenderedRelationship,
    onSelectRelationship,
  ]);

  const addReactionConnection = useCallback((
    sourceClassId: string,
    targetClassId: string,
  ) => {
    if (sourceClassId === targetClassId) return;

    const sourceClass = classes.find(
      umlClass => umlClass.id === sourceClassId,
    );
    const targetClass = classes.find(
      umlClass => umlClass.id === targetClassId,
    );
    if (!sourceClass || !targetClass) return;

    const exists = relationships.some(
      relationship => relationship.sourceId === sourceClassId
        && relationship.targetId === targetClassId,
    );
    if (exists) {
      const existing = reactionEdges.find(
        edge => edge.sourceClassId === sourceClassId
          && edge.targetClassId === targetClassId,
      );
      if (existing) {
        setEditingReactionId(existing.id);
        onSelectRelationship(existing.id);
      }
      return;
    }

    onRecordChange();
    const reactionId = `reaction-${Date.now()}`;
    const sourceContext = resolveUmlReactionClassContext(
      sourceClassId,
      sourceClass.name,
      primaryEcore,
      primaryModelName,
      primaryModelId,
      reactionModels,
    );
    const targetContext = resolveUmlReactionClassContext(
      targetClassId,
      targetClass.name,
      primaryEcore,
      primaryModelName,
      primaryModelId,
      reactionModels,
    );
    const reactionEdge: ReactionEdge = {
      id: reactionId,
      sourceModelId: sourceContext.modelId,
      sourceClassId,
      sourceClassName: sourceClass.name,
      targetModelId: targetContext.modelId,
      targetClassId,
      targetClassName: targetClass.name,
      config: buildDefaultUmlReactionConfig(
        sourceContext,
        targetContext,
      ),
    };

    onAppendRenderedRelationship({
      id: reactionId,
      sourceId: sourceClassId,
      targetId: targetClassId,
      type: 'association',
      label: reactionEdge.config.reactionName,
    });
    setReactionEdges(current => [...current, reactionEdge]);
    onSelectRelationship(reactionId);
    setEditingReactionId(reactionId);
    onSelectClass(null);
  }, [
    classes,
    relationships,
    reactionEdges,
    onRecordChange,
    primaryEcore,
    primaryModelName,
    primaryModelId,
    reactionModels,
    onAppendRenderedRelationship,
    onSelectRelationship,
    onSelectClass,
  ]);

  const updateReactionConfig = useCallback((
    reactionId: string,
    config: ReactionConfig,
  ) => {
    setReactionEdges(current => current.map(edge => (
      edge.id === reactionId ? { ...edge, config } : edge
    )));
    onUpdateRenderedRelationship(reactionId, {
      label: config.reactionName,
    });
  }, [onUpdateRenderedRelationship]);

  const deleteReaction = useCallback((reactionId: string) => {
    onRecordChange();
    setReactionEdges(current => current.filter(
      edge => edge.id !== reactionId,
    ));
    onRemoveRenderedRelationship(reactionId);
    setEditingReactionId(current => (
      current === reactionId ? null : current
    ));
    if (selectedRelationshipId === reactionId) {
      onSelectRelationship(null);
    }
    setReactionEditorState(current => (
      current?.edgeId === reactionId ? null : current
    ));
  }, [
    onRecordChange,
    onRemoveRenderedRelationship,
    selectedRelationshipId,
    onSelectRelationship,
  ]);

  const openReactionEditor = useCallback(async (reactionId: string) => {
    const edge = reactionEdges.find(
      reactionEdge => reactionEdge.id === reactionId,
    );
    if (!edge) return;

    const initialCode = await fetchReactionCode(
      edge.code,
      edge.reactionFileId,
      () => buildInitialReactionCodeFromConfig(edge.config),
    );
    setReactionEditorState({
      isOpen: true,
      edgeId: reactionId,
      initialCode,
      sourceFileName: edge.config.model1Alias,
      targetFileName: edge.config.model2Alias,
      reactionFileId: edge.reactionFileId ?? null,
    });
    onSelectRelationship(reactionId);
    onSelectClass(null);
  }, [reactionEdges, onSelectRelationship, onSelectClass]);

  const closeReactionEditor = useCallback(() => {
    setReactionEditorState(null);
  }, []);

  const saveReactionCode = useCallback(async (code: string) => {
    if (!reactionEditorState?.edgeId) return;
    const reactionId = reactionEditorState.edgeId;
    try {
      const reactionFileId = await persistReactionCode(
        code,
        reactionEditorState.reactionFileId,
      );
      setReactionEdges(current => current.map(edge => (
        edge.id === reactionId
          ? { ...edge, code, reactionFileId }
          : edge
      )));
      setReactionEditorState(current => (
        current ? { ...current, reactionFileId } : current
      ));
    } catch (error) {
      console.error('Failed to save reaction file', error);
      throw error;
    }
  }, [reactionEditorState]);

  const deleteReactionFromEditor = useCallback(() => {
    if (reactionEditorState?.edgeId) {
      deleteReaction(reactionEditorState.edgeId);
    }
  }, [reactionEditorState, deleteReaction]);

  const closeReactionConfiguration = useCallback(() => {
    setEditingReactionId(null);
  }, []);

  const handleReactionPortMouseDown = useCallback((
    event: ReactMouseEvent,
    classId: string,
    side: UmlReactionPortSide,
  ) => {
    if (!interactive || reactionsMode !== 'reactions') return;
    event.stopPropagation();
    event.preventDefault();

    const umlClass = classes.find(
      classItem => classItem.id === classId,
    );
    if (!umlClass) return;

    cleanupReactionDragListeners();
    reactionDragActiveRef.current = true;
    const { x: startX, y: startY } = getUmlReactionPortPosition(
      umlClass,
      offsetX,
      offsetY,
      side,
    );
    const cursor = clientToDiagram(event.clientX, event.clientY);
    setReactionDrag({
      sourceClassId: classId,
      sourceSide: side,
      startX,
      startY,
      cursorX: cursor.x,
      cursorY: cursor.y,
    });

    const handleMouseMove = (mouseEvent: MouseEvent) => {
      mouseEvent.preventDefault();
      const next = clientToDiagram(
        mouseEvent.clientX,
        mouseEvent.clientY,
      );
      setReactionDrag(current => current
        ? { ...current, cursorX: next.x, cursorY: next.y }
        : null);
    };

    function handleMouseUp(mouseEvent: MouseEvent) {
      reactionDragActiveRef.current = false;
      const targetClassId = getReactionPortTargetClassId(
        document.elementFromPoint(
          mouseEvent.clientX,
          mouseEvent.clientY,
        ) as HTMLElement | null,
        classId,
      );
      if (targetClassId) {
        addReactionConnection(classId, targetClassId);
      }
      setReactionDrag(null);
      cleanup();
    }

    const cleanup = () => {
      globalThis.removeEventListener('mousemove', handleMouseMove);
      globalThis.removeEventListener('mouseup', handleMouseUp);
      if (reactionDragCleanupRef.current === cleanup) {
        reactionDragCleanupRef.current = null;
      }
    };

    reactionDragCleanupRef.current = cleanup;
    globalThis.addEventListener('mousemove', handleMouseMove);
    globalThis.addEventListener('mouseup', handleMouseUp);
  }, [
    interactive,
    reactionsMode,
    classes,
    cleanupReactionDragListeners,
    offsetX,
    offsetY,
    clientToDiagram,
    addReactionConnection,
  ]);

  const cancelReactionInteraction = useCallback(() => {
    if (reactionDrag || reactionDragActiveRef.current) {
      stopReactionDrag();
      return true;
    }
    if (editingReactionId) {
      setEditingReactionId(null);
      return true;
    }
    return false;
  }, [reactionDrag, editingReactionId, stopReactionDrag]);

  useEffect(() => {
    stopReactionDrag();
    setEditingReactionId(null);
    if (reactionsMode === 'reactions') {
      onResetConnectionMode();
    }
  }, [reactionsMode, stopReactionDrag, onResetConnectionMode]);

  const handleReactionRelationshipClick = useCallback((
    relationshipId: string,
    clickDetail: number,
  ) => {
    const isReactionEdge = reactionEdges.some(
      edge => edge.id === relationshipId,
    );
    if (reactionsMode === 'reactions' && isReactionEdge) {
      if (clickDetail >= 2) {
        setEditingReactionId(null);
        void openReactionEditor(relationshipId);
        return true;
      }
      setEditingReactionId(relationshipId);
      onSelectRelationship(relationshipId);
      onSelectClass(null);
      return true;
    }
    setEditingReactionId(null);
    return false;
  }, [
    reactionsMode,
    reactionEdges,
    openReactionEditor,
    onSelectRelationship,
    onSelectClass,
  ]);

  const isReactionDragActive = useCallback(
    () => reactionDragActiveRef.current,
    [],
  );

  const editingReaction = useMemo(
    () => editingReactionId
      ? reactionEdges.find(edge => edge.id === editingReactionId) ?? null
      : null,
    [editingReactionId, reactionEdges],
  );
  const selectedRelationshipIsReaction = Boolean(
    selectedRelationshipId
    && reactionEdges.some(edge => edge.id === selectedRelationshipId),
  );

  return {
    reactionEdges,
    reactionDrag,
    editingReactionId,
    reactionEditorState,
    editingReaction,
    selectedRelationshipIsReaction,
    addReactionConnection,
    updateReactionConfig,
    deleteReaction,
    openReactionEditor,
    closeReactionEditor,
    saveReactionCode,
    deleteReactionFromEditor,
    closeReactionConfiguration,
    handleReactionPortMouseDown,
    handleReactionRelationshipClick,
    cancelReactionInteraction,
    isReactionDragActive,
  };
}
