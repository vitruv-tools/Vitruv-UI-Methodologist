import {
  useCallback,
  useEffect,
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
  handleUndo: () => void;
  handleRedo: () => void;
}

export interface UseUmlDiagramInteractionResult {
  handleToggleConnect: () => void;
  handleClassSelect: (classId: string) => void;
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
  handleUndo,
  handleRedo,
}: UseUmlDiagramInteractionOptions): UseUmlDiagramInteractionResult {
  const relationshipsRef = useRef(relationships);
  relationshipsRef.current = relationships;

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
    if (selectedClassId) {
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
    selectedClassId,
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
    if (event.detail >= 2 && interactive) {
      cycleRelationshipType(relationshipId);
    }
    setSelectedRelationshipId(relationshipId);
  }, [interactive, cycleRelationshipType, setSelectedRelationshipId]);

  const handleClassSelect = useCallback((classId: string) => {
    if (!interactive) return;
    flushPendingEdit();
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
  ]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedRelationshipId) {
      deleteRelationship(selectedRelationshipId);
      return;
    }
    if (selectedClassId) {
      deleteClass(selectedClassId);
    }
  }, [
    deleteClass,
    deleteRelationship,
    selectedClassId,
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
        selectedClassId,
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
    selectedClassId,
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
