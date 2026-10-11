import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import {
  createUmlClassSnapshot,
  pasteUmlClassSnapshot,
  type UmlPastePosition,
} from '../components/canvas/umlClassClipboard';
import {
  isKeyboardInputField,
  tryHandleClipboardShortcut,
} from '../components/canvas/umlDiagramKeyboardUtils';
import type { UmlDiagramClass } from '../components/canvas/umlDiagramTypes';
import {
  isActiveUmlEditor,
  useUmlClassClipboardStore,
  type UmlClassSnapshot,
} from '../store/UmlClassClipboard';
import type { UMLModel, UMLRelationship } from '../utils/ecoreToUml';

export interface UseUmlClassClipboardOptions {
  /** False in read-only mode: nothing can be copied, pasted or duplicated. */
  interactive: boolean;
  containerRef: RefObject<HTMLElement | null>;
  /** Re-attaches the listeners once the canvas element exists. */
  classCount: number;
  getModel: () => UMLModel;
  getSelectedClassIds: () => string[];
  recordChange: () => void;
  setClasses: Dispatch<SetStateAction<UmlDiagramClass[]>>;
  setRelationships: Dispatch<SetStateAction<UMLRelationship[]>>;
  /** Selects the pasted classes. */
  selectClasses: (classIds: string[]) => void;
  /** Converts a mouse position on screen to class coordinates. */
  clientToClassPosition: (clientX: number, clientY: number) => UmlPastePosition;
  /** True for clicks on the diagram itself, false for toolbar, panels and overlays. */
  isPastePositionTarget: (target: EventTarget | null) => boolean;
}

export interface UseUmlClassClipboardResult {
  /** Stores the selected classes in the app-level clipboard. */
  copySelection: () => boolean;
  /** Pastes the clipboard at the spot last clicked in this diagram. */
  pasteClipboard: () => boolean;
  /**
   * Copies and pastes the selected classes in one step (Ctrl/Cmd+D), slightly
   * offset from the originals; the clipboard is unchanged.
   */
  duplicateSelection: () => boolean;
}

/**
 * Copy, paste and duplicate of classes in one UML editor.
 *
 * Ctrl/Cmd+V pastes where the user last clicked in the diagram: the pasted
 * classes are centered on that spot. Before the first click they are centered
 * in the visible canvas.
 *
 * Several editors can be open at once (e.g. the drawer preview and the
 * full-screen editor), so the keyboard shortcuts only act in the editor the
 * user opened, clicked or focused last.
 */
export function useUmlClassClipboard({
  interactive,
  containerRef,
  classCount,
  getModel,
  getSelectedClassIds,
  recordChange,
  setClasses,
  setRelationships,
  selectClasses,
  clientToClassPosition,
  isPastePositionTarget,
}: UseUmlClassClipboardOptions): UseUmlClassClipboardResult {
  const editorId = useId();
  const hasCanvas = classCount > 0;
  /** Spot of the last click in the diagram, in class coordinates. */
  const pastePositionRef = useRef<UmlPastePosition | null>(null);

  const copySelectedClasses = useCallback((): UmlClassSnapshot | null => {
    const { classes, relationships } = getModel();
    return createUmlClassSnapshot(classes, relationships, getSelectedClassIds());
  }, [getModel, getSelectedClassIds]);

  const pasteSnapshot = useCallback((
    snapshot: UmlClassSnapshot | null,
    position?: UmlPastePosition,
  ): boolean => {
    if (!interactive || !snapshot || snapshot.classes.length === 0) return false;
    const { classes, relationships } = getModel();
    const pasted = pasteUmlClassSnapshot(snapshot, classes, relationships, position);
    recordChange();
    setClasses(previousClasses => [...previousClasses, ...pasted.classes]);
    setRelationships(previousRelationships => [
      ...previousRelationships,
      ...pasted.relationships,
    ]);
    selectClasses(pasted.classes.map(classItem => classItem.id));
    return true;
  }, [getModel, interactive, recordChange, selectClasses, setClasses, setRelationships]);

  const copySelection = useCallback((): boolean => {
    if (!interactive) return false;
    const snapshot = copySelectedClasses();
    if (!snapshot) return false;
    useUmlClassClipboardStore.getState().setSnapshot(snapshot);
    return true;
  }, [copySelectedClasses, interactive]);

  const getPastePosition = useCallback((): UmlPastePosition | undefined => {
    if (pastePositionRef.current) return pastePositionRef.current;
    const element = containerRef.current;
    if (!element) return undefined;
    const rect = element.getBoundingClientRect();
    return clientToClassPosition(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [clientToClassPosition, containerRef]);

  const pasteClipboard = useCallback(
    () => pasteSnapshot(useUmlClassClipboardStore.getState().snapshot, getPastePosition()),
    [getPastePosition, pasteSnapshot],
  );

  const duplicateSelection = useCallback(
    () => interactive && pasteSnapshot(copySelectedClasses()),
    [copySelectedClasses, interactive, pasteSnapshot],
  );

  // The editor opened last is the active one until another one is used.
  useEffect(() => {
    const { activateEditor, releaseEditor } = useUmlClassClipboardStore.getState();
    activateEditor(editorId);
    return () => releaseEditor(editorId);
  }, [editorId]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !hasCanvas) return;
    const activate = () => useUmlClassClipboardStore.getState().activateEditor(editorId);
    const onMouseDown = (event: MouseEvent) => {
      activate();
      if (event.button === 0 && isPastePositionTarget(event.target)) {
        pastePositionRef.current = clientToClassPosition(event.clientX, event.clientY);
      }
    };
    element.addEventListener('mousedown', onMouseDown, true);
    element.addEventListener('focusin', activate);
    return () => {
      element.removeEventListener('mousedown', onMouseDown, true);
      element.removeEventListener('focusin', activate);
    };
  }, [clientToClassPosition, containerRef, editorId, hasCanvas, isPastePositionTarget]);

  useEffect(() => {
    if (!interactive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isActiveUmlEditor(editorId)) return;
      tryHandleClipboardShortcut(event, isKeyboardInputField(event.target), {
        onCopy: copySelection,
        onPaste: pasteClipboard,
        onDuplicate: duplicateSelection,
      });
    };
    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [copySelection, duplicateSelection, editorId, interactive, pasteClipboard]);

  return { copySelection, pasteClipboard, duplicateSelection };
}
