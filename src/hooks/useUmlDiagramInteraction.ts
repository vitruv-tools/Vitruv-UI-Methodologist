import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  type SetStateAction,
} from 'react';
import {
  isKeyboardInputField,
  tryHandleDeleteShortcut,
  tryHandleEscapeShortcut,
  tryHandleUndoRedoShortcut,
} from '../components/canvas/umlDiagramKeyboardUtils';
import type { UMLRelationship } from '../utils/ecoreToUml';

const REL_TYPE_CYCLE: UMLRelationship['type'][] = [
  'association',
  'composition',
  'inheritance',
];

function nextRelationshipType(
  current: UMLRelationship['type'],
): UMLRelationship['type'] {
  const index = REL_TYPE_CYCLE.indexOf(current);
  return REL_TYPE_CYCLE[(index + 1) % REL_TYPE_CYCLE.length];
}

type NullableIdSetter = Dispatch<SetStateAction<string | null>>;
type BooleanSetter = Dispatch<SetStateAction<boolean>>;

export interface UseUmlDiagramInteractionOptions {
  interactive: boolean;
  classCount: number;
  containerRef: RefObject<HTMLElement | null>;
  isEmptyCanvasTarget: (target: HTMLElement) => boolean;
  relationships: UMLRelationship[];
  selectedClassId: string | null;
  setSelectedClassId: NullableIdSetter;
  /** All selected classes. Defaults to `selectedClassId` when omitted. */
  selectedClassIds?: string[];
  /** Adds a class to the selection or removes it (Shift/Cmd+click). */
  toggleClassSelection?: (classId: string) => void;
  selectedRelationshipId: string | null;
  setSelectedRelationshipId: NullableIdSetter;
  connectMode: boolean;
  setConnectMode: BooleanSetter;
  connectSourceId: string | null;
  setConnectSourceId: NullableIdSetter;
  editActive: boolean;
  flushPendingEdit: () => void;
  cancelEdit: () => void;
  addRelationship: (sourceId: string, targetId: string) => boolean;
  updateRelationship: (
    relationshipId: string,
    patch: Partial<UMLRelationship>,
  ) => void;
  deleteRelationship: (relationshipId: string) => void;
  deleteClass: (classId: string) => void;
  /** Deletes several selected classes as one undo step. */
  deleteClasses?: (classIds: string[]) => void;
  handleUndo: () => void;
  handleRedo: () => void;
}

export interface UseUmlDiagramInteractionResult {
  handleToggleConnect: () => void;
  /** `additive` (Shift/Cmd+click) adds the class to the selection or removes it. */
  handleClassSelect: (classId: string, additive?: boolean) => void;
  handleRelationshipClick: (
    relationshipId: string,
    event: ReactMouseEvent,
  ) => void;
  handleDeleteSelected: () => void;
  handleRelationshipBackgroundClick: () => void;
  tryEscape: () => boolean;
}

export function useUmlDiagramInteraction({
  interactive,
  classCount,
  containerRef,
  isEmptyCanvasTarget,
  relationships,
  selectedClassId,
  setSelectedClassId,
  selectedClassIds,
  toggleClassSelection,
  selectedRelationshipId,
  setSelectedRelationshipId,
  connectMode,
  setConnectMode,
  connectSourceId,
  setConnectSourceId,
  editActive,
  flushPendingEdit,
  cancelEdit,
  addRelationship,
  updateRelationship,
  deleteRelationship,
  deleteClass,
  deleteClasses,
  handleUndo,
  handleRedo,
}: UseUmlDiagramInteractionOptions): UseUmlDiagramInteractionResult {
  const relationshipsRef = useRef(relationships);
  relationshipsRef.current = relationships;
  const selectedIds = useMemo(
    () => selectedClassIds ?? (selectedClassId ? [selectedClassId] : []),
    [selectedClassId, selectedClassIds],
  );

  const handleToggleConnect = useCallback(() => {
    setConnectMode(value => !value);
    setConnectSourceId(null);
  }, [setConnectMode, setConnectSourceId]);

  const cycleRelationshipType = useCallback((relationshipId: string) => {
    const relationship = relationshipsRef.current.find(
      candidate => candidate.id === relationshipId,
    );
    if (!relationship) return;
    updateRelationship(relationshipId, {
      type: nextRelationshipType(relationship.type),
    });
  }, [updateRelationship]);

  const dismissClassSelection = useCallback(() => {
    flushPendingEdit();
    setSelectedClassId(null);
    cancelEdit();
  }, [cancelEdit, flushPendingEdit, setSelectedClassId]);

  const handleCanvasDoubleClick = useCallback((event: MouseEvent) => {
    if (!interactive) return;
    if (!isEmptyCanvasTarget(event.target as HTMLElement)) return;
    event.preventDefault();
    event.stopPropagation();
    dismissClassSelection();
  }, [interactive, isEmptyCanvasTarget, dismissClassSelection]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    element.addEventListener('dblclick', handleCanvasDoubleClick);
    return () => {
      element.removeEventListener('dblclick', handleCanvasDoubleClick);
    };
  }, [handleCanvasDoubleClick, classCount, containerRef]);

  const tryEscape = useCallback(() => {
    if (connectMode) {
      setConnectMode(false);
      setConnectSourceId(null);
      return true;
    }
    if (connectSourceId) {
      setConnectSourceId(null);
      return true;
    }
    if (editActive) {
      cancelEdit();
      return true;
    }
    if (selectedRelationshipId) {
      setSelectedRelationshipId(null);
      return true;
    }
    if (selectedIds.length > 0) {
      dismissClassSelection();
      return true;
    }
    return false;
  }, [
    cancelEdit,
    connectMode,
    connectSourceId,
    dismissClassSelection,
    editActive,
    selectedIds,
    selectedRelationshipId,
    setConnectMode,
    setConnectSourceId,
    setSelectedRelationshipId,
  ]);

  const handleRelationshipClick = useCallback((
    relationshipId: string,
    event: ReactMouseEvent,
  ) => {
    event.stopPropagation();
    if (interactive) flushPendingEdit();
    if (event.detail >= 2 && interactive) {
      cycleRelationshipType(relationshipId);
    }
    setSelectedRelationshipId(relationshipId);
  }, [interactive, cycleRelationshipType, flushPendingEdit, setSelectedRelationshipId]);

  const handleClassSelect = useCallback((classId: string, additive = false) => {
    if (!interactive) return;
    flushPendingEdit();
    if (additive && !connectMode && toggleClassSelection) {
      toggleClassSelection(classId);
      return;
    }
    if (connectMode) {
      if (!connectSourceId) {
        setConnectSourceId(classId);
        setSelectedClassId(classId);
        return;
      }
      if (connectSourceId !== classId) {
        const connected = addRelationship(connectSourceId, classId);
        if (!connected) {
          setSelectedClassId(classId);
          return;
        }
      }
      setConnectMode(false);
      setConnectSourceId(null);
      setSelectedClassId(classId);
      return;
    }
    setSelectedClassId(classId);
  }, [
    addRelationship,
    connectMode,
    connectSourceId,
    flushPendingEdit,
    interactive,
    setConnectMode,
    setConnectSourceId,
    setSelectedClassId,
    toggleClassSelection,
  ]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedRelationshipId) {
      deleteRelationship(selectedRelationshipId);
      return;
    }
    if (selectedIds.length === 1) {
      deleteClass(selectedIds[0]);
      return;
    }
    if (selectedIds.length > 1) {
      if (deleteClasses) deleteClasses(selectedIds);
      else selectedIds.forEach(classId => deleteClass(classId));
    }
  }, [
    deleteClass,
    deleteClasses,
    deleteRelationship,
    selectedIds,
    selectedRelationshipId,
  ]);

  useEffect(() => {
    if (!interactive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const inField = isKeyboardInputField(event.target);
      if (tryHandleUndoRedoShortcut(event, inField, handleUndo, handleRedo)) return;
      tryHandleEscapeShortcut(event, tryEscape);
      if (event.key === 'Escape') return;
      tryHandleDeleteShortcut(
        event,
        inField,
        selectedRelationshipId,
        selectedIds[0] ?? null,
        handleDeleteSelected,
      );
    };
    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [
    handleDeleteSelected,
    handleRedo,
    handleUndo,
    interactive,
    selectedIds,
    selectedRelationshipId,
    tryEscape,
  ]);

  const handleRelationshipBackgroundClick = useCallback(() => {
    if (connectMode) {
      setConnectMode(false);
      setConnectSourceId(null);
    }
  }, [connectMode, setConnectMode, setConnectSourceId]);

  return {
    handleToggleConnect,
    handleClassSelect,
    handleRelationshipClick,
    handleDeleteSelected,
    handleRelationshipBackgroundClick,
    tryEscape,
  };
}
