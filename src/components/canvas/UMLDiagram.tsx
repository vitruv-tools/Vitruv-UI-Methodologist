import React, { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { ecoreToUml, UMLRelationship, UMLModel } from '../../utils/ecoreToUml';
import { saveMetaModelEcore, MetaModelSaveMetadata } from '../../utils/saveMetaModelEcore';
import { umlSemanticSnapshot, umlToEcore } from '../../utils/umlToEcore';
import { validateUmlModel } from '../../utils/umlValidation';
import { useUmlEditHistory, UmlEditSnapshot } from '../../hooks/useUmlEditHistory';
import {
  applyLayoutToUmlClasses,
  positionsFromUmlClasses,
  sanitizeUmlClassId,
} from '../../utils/umlLayoutStorage';
import { assignParallelRelMeta } from '../../utils/umlClassLayout';
import { UMLDiagramMinimap } from './UMLDiagramMinimap';
import { UMLDiagramToolbar } from './UMLDiagramToolbar';
import { DIAGRAM_HINT_TOP, UML } from './umlDiagramTheme';
import { ClassEditPanel, RelationshipEditPanel } from './UMLDiagramEditPanels';
import { UMLClassBox } from './UMLClassBox';
import {
  UMLRelationshipBaseLayer,
  UMLRelationshipOverlayLayers,
} from './UMLRelationshipLayers';
import type { UmlDiagramClass } from './umlDiagramTypes';
import {
  type UmlDiagramRelationshipLayout,
} from './umlDiagramLayoutGeometry';
import { useUmlDiagramViewport } from '../../hooks/useUmlDiagramViewport';
import { useUmlRelationshipLayers } from '../../hooks/useUmlRelationshipLayers';
import { useUmlDiagramPrimaryEditing } from '../../hooks/useUmlDiagramPrimaryEditing';

// ── constants ────────────────────────────────────────────────────────────────

/** Dotted workspace background — matches canvas / HomePage grid */
export const WORKSPACE_DOT_BACKGROUND: React.CSSProperties = {
  backgroundColor: '#f3f4f6',
  backgroundImage: 'radial-gradient(circle, #d1d5db 0.75px, transparent 0.75px)',
  backgroundSize: '24px 24px',
};

// ── helpers ──────────────────────────────────────────────────────────────────

function isEmptyCanvasTarget(target: HTMLElement): boolean {
  return !target.closest('[data-classbox]')
    && !target.closest('[data-rel-hit-line]')
    && !target.closest('[data-rel-direction-marker]')
    && !target.closest('[data-uml-toolbar]')
    && !target.closest('[data-rel-edit-panel]')
    && !target.closest('[data-class-edit-panel]')
    && !target.closest('[data-uml-connect-banner]')
    && !target.closest('[data-uml-validation]');
}

/** `library` persists to the metamodel library API; `workspace` only updates the open project/session copy. */
export type UmlDiagramSaveTarget = 'library' | 'workspace';

export interface UmlDiagramSaveContext {
  metaModelId: string;
  ecoreFileId: number;
  modelName: string;
  /** Defaults to `library` (Model Library / drawer). Canvas UML uses `workspace`. */
  saveTarget?: UmlDiagramSaveTarget;
  /** Passed to library save so relink works when GET /meta-models/{id} is unavailable. */
  metaModelMetadata?: MetaModelSaveMetadata;
  onSaved?: (result: { ecoreContent: string; ecoreFileId: number }) => void;
  onError?: (message: string) => void;
}

// ── UMLDiagram ────────────────────────────────────────────────────────────────

export interface UMLDiagramHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitToView: () => void;
  flushLayout: () => void;
  getModel: () => UMLModel;
  isDirty: () => boolean;
  save: () => Promise<void>;
  reload: (ecoreContent: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  /** Cancel connect mode / clear selection. Returns true if handled. */
  tryEscape: () => boolean;
}

interface UMLDiagramProps {
  ecoreContent: string;
  fileName?: string;
  layoutScopeId?: string;
  /** When false, diagram is view-only (no create/delete/edit). Defaults to true. */
  interactive?: boolean;
  /** When set, enables persisting semantic UML edits back to the metamodel ecore file. */
  saveContext?: UmlDiagramSaveContext;
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
}
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
function isKeyboardInputField(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function tryHandleUndoRedoShortcut(
  e: KeyboardEvent,
  inField: boolean,
  handleUndo: () => void,
  handleRedo: () => void,
): boolean {
  if (!((e.ctrlKey || e.metaKey) && !inField)) return false;
  const key = e.key.toLowerCase();
  if (key === 'z') {
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey) handleRedo();
    else handleUndo();
    return true;
  }
  if (key === 'y') {
    e.preventDefault();
    e.stopPropagation();
    handleRedo();
    return true;
  }
  return false;
}

function tryHandleEscapeShortcut(e: KeyboardEvent, tryEscape: () => boolean): void {
  if (e.key !== 'Escape') return;
  if (tryEscape()) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function tryHandleDeleteShortcut(
  e: KeyboardEvent,
  inField: boolean,
  selectedRelId: string | null,
  selectedClassId: string | null,
  handleDeleteSelected: () => void,
): void {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return;
  if (inField) return;
  if (!selectedRelId && !selectedClassId) return;
  e.preventDefault();
  handleDeleteSelected();
}

function getDiagramCursor(panning: boolean, connectMode: boolean): React.CSSProperties['cursor'] {
  if (panning) return 'grabbing';
  if (connectMode) return 'crosshair';
  return 'default';
}

function getSaveButtonTitle(hasUnsavedChanges: boolean, saveContext: UmlDiagramSaveContext): string {
  if (!hasUnsavedChanges) return 'No unsaved changes';
  if (saveContext.saveTarget === 'workspace') return 'Save changes to project';
  return 'Save metamodel changes';
}

function getConnectModeHint(connectSourceId: string | null): string {
  if (connectSourceId) {
    return 'Click the target class to create a connection';
  }
  return 'Click the source class, then the target class';
}

function getValidationBannerInset(
  selectedClass: UmlDiagramClass | null | undefined,
  selectedRel: UMLRelationship | null | undefined,
): { left: number; right: number } {
  return {
    left: selectedClass ? 288 : 12,
    right: selectedRel ? 320 : 12,
  };
}

function isSaveMessageSuccess(message: string): boolean {
  return message === 'Saved' || message === 'Saved to project';
}

const UmlEmptyDiagram: React.FC<{ interactive: boolean; onAddClass: () => void }> = ({
  interactive,
  onAddClass,
}) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    height: '100%', color: '#9ca3af', fontSize: 13, gap: 12,
    ...WORKSPACE_DOT_BACKGROUND,
  }}>
    <span>No UML content found.</span>
    {interactive && (
      <button
        type="button"
        onClick={onAddClass}
        style={{
          padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8,
          background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}
      >
        + Add class
      </button>
    )}
  </div>
);

const UmlSaveMessageBanner: React.FC<{ message: string }> = ({ message }) => {
  const success = isSaveMessageSuccess(message);
  return (
    <div style={{
      position: 'absolute',
      top: 14,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      padding: '8px 16px',
      borderRadius: 8,
      background: success ? '#ecfdf5' : '#fef2f2',
      border: `1px solid ${success ? '#86efac' : '#fecaca'}`,
      color: success ? '#15803d' : '#dc2626',
      fontSize: 13,
      fontWeight: 600,
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      maxWidth: 'min(480px, 90vw)',
      textAlign: 'center',
      pointerEvents: 'none',
    }}>
      {message}
    </div>
  );
};
export const UMLDiagram = forwardRef<UMLDiagramHandle, UMLDiagramProps>(({
  ecoreContent,
  fileName,
  layoutScopeId = 'default',
  interactive = true,
  saveContext,
  onHistoryChange,
}, ref) => {
  const parsed = useMemo(() => {
    const model = ecoreToUml(ecoreContent);
    return {
      ...model,
      classes: model.classes.map(c => ({ ...c, operations: c.operations ?? [] })),
    };
  }, [ecoreContent]);
  const [classes, setClasses] = useState<UmlDiagramClass[]>(() => {
    const base = fileName ? applyLayoutToUmlClasses(layoutScopeId, fileName, parsed.classes) : parsed.classes;
    return base.map(c => ({ ...c, operations: c.operations ?? [] }));
  });
  const [relationships, setRelationships] = useState<UMLRelationship[]>(() => parsed.relationships);
  const [originalEcore, setOriginalEcore] = useState(ecoreContent);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const initialSnapshotRef = useRef('');
  const skipNextEcoreResetRef = useRef(false);
const rels = useMemo(
  () => assignParallelRelMeta(relationships) as UmlDiagramRelationshipLayout[],
  [relationships],
);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedRelId, setSelectedRelId] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const classesRef = useRef(classes);
  classesRef.current = classes;
  const relationshipsRef = useRef(relationships);
  relationshipsRef.current = relationships;
  const flushPendingEditRef = useRef<() => void>(() => {});
  const cancelPrimaryEditRef = useRef<() => void>(() => {});
  const persistViewportLayoutRef = useRef<
  (classesOverride?: UmlDiagramClass[]) => void
  >(() => {});

  const {
    canUndo: historyCanUndo,
    canRedo: historyCanRedo,
    recordBeforeChange,
    undo: undoHistory,
    redo: redoHistory,
    clearHistory,
  } = useUmlEditHistory();

  const takeSnapshot = useCallback((): UmlEditSnapshot => ({
    classes: structuredClone(classesRef.current),
    relationships: structuredClone(relationshipsRef.current),
  }), []);

  const applySnapshot = useCallback((snapshot: UmlEditSnapshot) => {
    setClasses(snapshot.classes);
    setRelationships(snapshot.relationships);
    cancelPrimaryEditRef.current();
    setSelectedClassId(null);
    setSelectedRelId(null);
    setConnectMode(false);
    setConnectSourceId(null);
  }, []);

  const notifyHistoryChange = useCallback(() => {
    onHistoryChange?.({
      canUndo: historyCanUndo,
      canRedo: historyCanRedo,
    });
  }, [onHistoryChange, historyCanUndo, historyCanRedo]);

  useEffect(() => {
    notifyHistoryChange();
  }, [notifyHistoryChange, historyCanUndo, historyCanRedo]);

  const recordChange = useCallback(() => {
    if (!interactive) return;
    recordBeforeChange(takeSnapshot());
  }, [interactive, recordBeforeChange, takeSnapshot]);

  const handleUndo = useCallback(() => {
    if (!interactive || !historyCanUndo) return;
    const restored = undoHistory(takeSnapshot());
    if (restored) applySnapshot(restored);
  }, [interactive, historyCanUndo, undoHistory, takeSnapshot, applySnapshot]);

  const handleRedo = useCallback(() => {
    if (!interactive || !historyCanRedo) return;
    const restored = redoHistory(takeSnapshot());
    if (restored) applySnapshot(restored);
  }, [interactive, historyCanRedo, redoHistory, takeSnapshot, applySnapshot]);

  const handleToggleConnect = useCallback(() => {
    setConnectMode(value => !value);
    setConnectSourceId(null);
  }, []);

  const getModel = useCallback((): UMLModel => ({
    classes: classesRef.current,
    relationships: relationshipsRef.current,
  }), []);

  const resetFromEcore = useCallback((content: string, preserveLivePositions = false) => {
    const livePositions = preserveLivePositions
      ? positionsFromUmlClasses(classesRef.current)
      : null;
    const next = ecoreToUml(content);
    let baseClasses = fileName
      ? applyLayoutToUmlClasses(layoutScopeId, fileName, next.classes)
      : next.classes;
    if (livePositions) {
      baseClasses = baseClasses.map(c => {
        const live = livePositions[c.id] ?? livePositions[sanitizeUmlClassId(c.name)];
        return live ? { ...c, x: live.x, y: live.y } : c;
      });
    }
    setOriginalEcore(content);
    setClasses(baseClasses.map(c => ({ ...c, operations: c.operations ?? [] })));
    setRelationships(next.relationships);
    setSelectedClassId(null);
    setSelectedRelId(null);
    setConnectMode(false);
    setConnectSourceId(null);
    cancelPrimaryEditRef.current();
    initialSnapshotRef.current = umlSemanticSnapshot({
      classes: baseClasses,
      relationships: next.relationships,
    });
    setSaveMessage('');
    if (preserveLivePositions && fileName) {
      persistViewportLayoutRef.current(baseClasses);
    }
    clearHistory();
  }, [fileName, layoutScopeId, clearHistory]);

  // Re-apply saved layout when ecore content or file changes
  useEffect(() => {
    if (skipNextEcoreResetRef.current) {
      skipNextEcoreResetRef.current = false;
      return;
    }
    resetFromEcore(ecoreContent);
  }, [ecoreContent, fileName, layoutScopeId, resetFromEcore]);

  // ── viewport (pan + zoom) ──────────────────────────────────────────────────
  const handleBeforeCanvasPan = useCallback(() => {
    flushPendingEditRef.current();
  }, []);
  const isCanvasPanBlocked = useCallback(
    () => false,
    [],
  );
  const isCanvasPanTarget = useCallback(
    (target: EventTarget | null) => isEmptyCanvasTarget(target as HTMLElement),
    [],
  );
  const {
    containerRef,
    vx,
    vy,
    vscale,
    panning,
    layout: { totalW, totalH, offsetX, offsetY },
    zoomIn,
    zoomOut,
    fitToView,
    handleMinimapPan,
    persistLayout,
    scheduleLayoutSave,
    scheduleDebouncedLayoutSave,
    getCurrentViewport,
    restoreViewportAfterReload,
    getCurrentLayoutOffset,
  } = useUmlDiagramViewport({
    classes,
    allClasses: classes,
    diagramIdentity: ecoreContent,
    fileName,
    layoutScopeId,
    onBeforePan: handleBeforeCanvasPan,
    isPanBlocked: isCanvasPanBlocked,
    isPanTarget: isCanvasPanTarget,
  });
  persistViewportLayoutRef.current = persistLayout;

  const {
    edit,
    startNameEdit,
    startAttributeEdit,
    startOperationEdit,
    changeEdit,
    cancelEdit,
    flushPendingEdit,
    saveName,
    saveAttribute: saveAttr,
    saveOperation: saveOp,
    addAttribute: addAttr,
    deleteAttribute: deleteAttr,
    addOperation: addOp,
    deleteOperation: deleteOp,
    addClass,
    deleteClass,
    updateClass,
    getInheritanceParentId,
    setInheritanceParent,
    beginClassDrag,
    moveClass,
    finishClassDrag,
    addRelationship,
    deleteRelationship,
    updateRelationship,
  } = useUmlDiagramPrimaryEditing({
    classes,
    relationships,
    setClasses,
    setRelationships,
    setSelectedClassId,
    setSelectedRelationshipId: setSelectedRelId,
    setConnectSourceId,
    recordChange,
    containerRef,
    getCurrentViewport,
    getCurrentLayoutOffset,
    scheduleDebouncedLayoutSave,
    scheduleLayoutSave,
  });
  flushPendingEditRef.current = flushPendingEdit;
  cancelPrimaryEditRef.current = cancelEdit;

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
  }, [cancelEdit, flushPendingEdit]);

  const handleCanvasDoubleClick = useCallback((e: MouseEvent) => {
    if (!interactive) return;
    if (!isEmptyCanvasTarget(e.target as HTMLElement)) return;
    e.preventDefault();
    e.stopPropagation();
    dismissClassSelection();
  }, [interactive, dismissClassSelection]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('dblclick', handleCanvasDoubleClick);
    return () => {
      el.removeEventListener('dblclick', handleCanvasDoubleClick);
    };
  }, [handleCanvasDoubleClick, classes.length, containerRef]);

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
    if (edit) {
      cancelEdit();
      return true;
    }
    if (selectedRelId) {
      setSelectedRelId(null);
      return true;
    }
    if (selectedClassId) {
      dismissClassSelection();
      return true;
    }
    return false;
  }, [cancelEdit, connectMode, connectSourceId, edit, selectedRelId, selectedClassId, dismissClassSelection]);

  const handleRelationshipClick = useCallback((relId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.detail >= 2 && interactive) {
      cycleRelationshipType(relId);
    }
    setSelectedRelId(relId);
  }, [interactive, cycleRelationshipType]);

  const isDirty = useCallback(() => {
    return umlSemanticSnapshot(getModel()) !== initialSnapshotRef.current;
  }, [getModel]);

  const handleSave = useCallback(async () => {
    if (!saveContext || saving) return;
    setSaving(true);
    setSaveMessage('');
    try {
      persistLayout();
      const result =
        saveContext.saveTarget === 'workspace'
          ? {
              ecoreContent: umlToEcore(getModel(), originalEcore),
              ecoreFileId: saveContext.ecoreFileId,
            }
          : await saveMetaModelEcore({
              metaModelId: saveContext.metaModelId,
              ecoreFileId: saveContext.ecoreFileId,
              modelName: saveContext.modelName,
              model: getModel(),
              originalEcore,
              metaModelMetadata: saveContext.metaModelMetadata,
            });
      resetFromEcore(result.ecoreContent, true);
      skipNextEcoreResetRef.current = true;
      saveContext.onSaved?.(result);
      setSaveMessage(saveContext.saveTarget === 'workspace' ? 'Saved to project' : 'Saved');
      clearHistory();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setSaveMessage(message);
      saveContext.onError?.(message);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(''), 4000);
    }
  }, [saveContext, saving, getModel, originalEcore, resetFromEcore, persistLayout, clearHistory]);

  // ── imperative handle ──────────────────────────────────────────────────────
  useImperativeHandle(ref, () => {
    return {
      zoomIn,
      zoomOut,
      fitToView,
      flushLayout: persistLayout,
      getModel,
      isDirty,
      save: handleSave,
      reload: (content: string) => {
        skipNextEcoreResetRef.current = true;
        resetFromEcore(content, false);
        restoreViewportAfterReload();
      },
      undo: handleUndo,
      redo: handleRedo,
      canUndo: () => historyCanUndo,
      canRedo: () => historyCanRedo,
      tryEscape,
    };
  }, [
    fitToView,
    getModel,
    handleRedo,
    handleSave,
    handleUndo,
    historyCanRedo,
    historyCanUndo,
    isDirty,
    persistLayout,
    resetFromEcore,
    restoreViewportAfterReload,
    tryEscape,
    zoomIn,
    zoomOut,
  ]);

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
  }, [interactive, connectMode, connectSourceId, addRelationship, flushPendingEdit]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedRelId) {
      deleteRelationship(selectedRelId);
      return;
    }
    if (selectedClassId) {
      deleteClass(selectedClassId);
    }
  }, [selectedRelId, selectedClassId, deleteRelationship, deleteClass]);

  useEffect(() => {
    if (!interactive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const inField = isKeyboardInputField(e.target);
      if (tryHandleUndoRedoShortcut(e, inField, handleUndo, handleRedo)) return;
      tryHandleEscapeShortcut(e, tryEscape);
      if (e.key === 'Escape') return;
      tryHandleDeleteShortcut(e, inField, selectedRelId, selectedClassId, handleDeleteSelected);
    };
    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [interactive, selectedRelId, selectedClassId, handleDeleteSelected, tryEscape, handleUndo, handleRedo]);

  const handleRelationshipBackgroundClick = useCallback(() => {
    if (connectMode) {
      setConnectMode(false);
      setConnectSourceId(null);
    }
  }, [connectMode]);

  const {
    edgeLayouts,
    multiplicityBadges,
    hoveredRelationshipId,
    handleRelationshipMouseEnter,
    handleRelationshipMouseLeave,
  } = useUmlRelationshipLayers({
    parallelRelationships: rels,
    classes,
    offsetX,
    offsetY,
  });

  const validationIssues = useMemo(
    () => validateUmlModel({ classes, relationships }),
    [classes, relationships],
  );

  if (classes.length === 0) {
    return <UmlEmptyDiagram interactive={interactive} onAddClass={addClass} />;
  }

  const canDelete = !!(selectedRelId || selectedClassId);
  const selectedRel = selectedRelId ? relationships.find(r => r.id === selectedRelId) : null;
  const selectedClass = selectedClassId ? classes.find(c => c.id === selectedClassId) : null;
  const hasUnsavedChanges = isDirty();
  const validationInset = getValidationBannerInset(selectedClass, selectedRel);
  const diagramCursor = getDiagramCursor(panning, connectMode);
  const saveButtonTitle = saveContext
    ? getSaveButtonTitle(hasUnsavedChanges, saveContext)
    : '';

  return (
    <section
      ref={containerRef}
      aria-label="UML diagram canvas"
      style={{
        width: '100%', height: '100%',
        overflow: 'hidden', position: 'relative',
        cursor: diagramCursor,
        ...WORKSPACE_DOT_BACKGROUND,
        userSelect: 'none',
      }}
    >
    <div style={{
      position: 'absolute',
      transform: `translate(${vx}px, ${vy}px) scale(${vscale})`,
      transformOrigin: '0 0',
      width: totalW,
      height: totalH,
    }}>
    {/* SVG: relationship lines */}
    <div style={{ position: 'relative', width: totalW, height: totalH }}>
      <UMLRelationshipBaseLayer
        totalWidth={totalW}
        totalHeight={totalH}
        edgeLayouts={edgeLayouts}
        selectedRelationshipId={selectedRelId}
        hoveredRelationshipId={hoveredRelationshipId}
        onBackgroundClick={handleRelationshipBackgroundClick}
      />

      {/* Class boxes */}
      {classes.map(cls => (
        <UMLClassBox
          key={cls.id}
          cls={cls}
          offsetX={offsetX}
          offsetY={offsetY}
          scale={vscale}
          selected={selectedClassId === cls.id}
          connectSource={connectSourceId === cls.id}
          interactive={interactive}
          edit={edit?.classId === cls.id ? edit : null}
          onSelect={() => handleClassSelect(cls.id)}
          onDragStart={beginClassDrag}
          onMove={moveClass}
          onDragEnd={finishClassDrag}
          onStartEditName={() => {
            if (!interactive) return;
            startNameEdit(cls.id);
          }}
          onSaveName={name => saveName(cls.id, name)}
          onStartEditAttr={attrId => {
            if (!interactive) return;
            startAttributeEdit(cls.id, attrId);
          }}
          onSaveAttr={(attrId, n, t, v) => saveAttr(cls.id, attrId, n, t, v)}
          onCancelEdit={cancelEdit}
          onAddAttr={() => interactive && addAttr(cls.id)}
          onDeleteAttr={attrId => deleteAttr(cls.id, attrId)}
          onStartEditOp={opId => {
            if (!interactive) return;
            startOperationEdit(cls.id, opId);
          }}
          onSaveOp={(opId, n, rt, v) => saveOp(cls.id, opId, n, rt, v)}
          onAddOp={() => interactive && addOp(cls.id)}
          onDeleteOp={opId => deleteOp(cls.id, opId)}
          onDelete={() => deleteClass(cls.id)}
          onEditChange={changeEdit}
        />
      ))}

      <UMLRelationshipOverlayLayers
        totalWidth={totalW}
        totalHeight={totalH}
        edgeLayouts={edgeLayouts}
        multiplicityBadges={multiplicityBadges}
        selectedRelationshipId={selectedRelId}
        hoveredRelationshipId={hoveredRelationshipId}
        onRelationshipClick={handleRelationshipClick}
        onRelationshipMouseEnter={handleRelationshipMouseEnter}
        onRelationshipMouseLeave={handleRelationshipMouseLeave}
      />
    </div>
    </div>
      {interactive && connectMode && (
        <div
          data-uml-connect-banner
          style={{
            position: 'absolute',
            top: DIAGRAM_HINT_TOP,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 32,
            padding: '6px 14px',
            borderRadius: 10,
            background: UML.surface,
            border: `1px solid ${UML.primaryBorder}`,
            color: UML.ink,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: UML.fontSans,
            boxShadow: `0 4px 14px ${UML.primaryRing}`,
            pointerEvents: 'none',
            maxWidth: 'min(420px, calc(100vw - 320px))',
            textAlign: 'center',
            lineHeight: 1.35,
          }}
        >
          {getConnectModeHint(connectSourceId)}
        </div>
      )}
      {interactive && (
        <UMLDiagramToolbar
          connectMode={connectMode}
          canUndo={historyCanUndo}
          canRedo={historyCanRedo}
          canDelete={canDelete}
          showSave={Boolean(saveContext)}
          hasUnsavedChanges={hasUnsavedChanges}
          saving={saving}
          saveButtonTitle={saveButtonTitle}
          onAddClass={addClass}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onToggleConnect={handleToggleConnect}
          onDelete={handleDeleteSelected}
          onSave={() => { void handleSave(); }}
        />
      )}
      {saveMessage && <UmlSaveMessageBanner message={saveMessage} />}
      {interactive && validationIssues.length > 0 && (
        <div
          data-uml-validation
          style={{
            position: 'absolute',
            top: DIAGRAM_HINT_TOP,
            left: validationInset.left,
            right: validationInset.right,
            zIndex: 31,
            padding: '8px 12px',
            borderRadius: 8,
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            color: '#92400e',
            fontSize: 11,
            fontFamily: UML.fontSans,
            lineHeight: 1.45,
            maxHeight: 72,
            overflowY: 'auto',
          }}
        >
          {validationIssues.slice(0, 4).map((issue, idx) => (
            <div key={`${issue.message}-${idx}`}>
              {issue.severity === 'error' ? '⛔' : '⚠'} {issue.message}
            </div>
          ))}
          {validationIssues.length > 4 && (
            <div style={{ marginTop: 4, fontStyle: 'italic' }}>
              +{validationIssues.length - 4} more issue(s)
            </div>
          )}
        </div>
      )}
      {interactive && selectedClass && (
        <ClassEditPanel
          cls={selectedClass}
          classes={classes}
          parentId={getInheritanceParentId(selectedClass.id)}
          onUpdate={patch => updateClass(selectedClass.id, patch)}
          onSetParent={parentId => setInheritanceParent(selectedClass.id, parentId)}
          onDelete={() => deleteClass(selectedClass.id)}
          onClose={() => setSelectedClassId(null)}
        />
      )}
      {interactive && selectedRel && (
        <RelationshipEditPanel
          rel={selectedRel}
          classes={classes}
          onUpdate={patch => updateRelationship(selectedRel.id, patch)}
          onClose={() => setSelectedRelId(null)}
          onSwapEndpoints={() => updateRelationship(selectedRel.id, {
            sourceId: selectedRel.targetId,
            targetId: selectedRel.sourceId,
            sourceMultiplicity: selectedRel.targetMultiplicity,
            targetMultiplicity: selectedRel.sourceMultiplicity,
          })}
        />
      )}
      <UMLDiagramMinimap
        classes={classes}
        relationships={rels}
        offsetX={offsetX}
        offsetY={offsetY}
        vx={vx}
        vy={vy}
        vscale={vscale}
        containerRef={containerRef}
        onViewportChange={handleMinimapPan}
      />
    </section>
  );
});

UMLDiagram.displayName = 'UMLDiagram';
