import React, { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { ecoreToUml, UMLAttribute, UMLRelationship, UMLModel, UMLVisibility, UMLOperation, normalizeAttributeTypeDisplay, normalizeOperationReturnType, nextUniqueAttributeName, nextUniqueOperationName } from '../../utils/ecoreToUml';
import { saveMetaModelEcore, MetaModelSaveMetadata } from '../../utils/saveMetaModelEcore';
import { umlSemanticSnapshot, umlToEcore } from '../../utils/umlToEcore';
import { validateUmlModel } from '../../utils/umlValidation';
import { extractNsUriFromEcore } from '../../utils/ecoreParser';
import { ReactionConfigPopup } from './ReactionConfigPopup';
import { ReactionConfig, ReactionEdge, ReactionsModel } from '../../types/reactions';
import { ReactionEditorModal } from '../flow/ReactionEditorModal';
import { CodeEditorState } from '../flow/flowCanvasTypes';
import { buildInitialReactionCodeFromConfig } from '../../utils/reactionCode';
import { fetchReactionCode, persistReactionCode } from '../../utils/reactionFile';
import { useUmlEditHistory, UmlEditSnapshot } from '../../hooks/useUmlEditHistory';
import {
  applyLayoutToUmlClasses,
  buildUmlLayoutPayload,
  hasSavedUmlLayout,
  loadUmlViewport,
  positionsFromUmlClasses,
  sanitizeUmlClassId,
  saveUmlLayout,
  type UmlViewport,
} from '../../utils/umlLayoutStorage';
import { assignParallelRelMeta } from '../../utils/umlClassLayout';
import {
  computeLineBridges,
  optimizeMultiplicityBadges,
  resolveMultiplicityBadgeCollisions,
  type MultiplicityBadge,
} from '../../utils/umlDiagramGeometry';
import { UMLDiagramMinimap } from './UMLDiagramMinimap';
import { computeUmlModelGroups } from '../../utils/umlModelGroups';
import { UMLDiagramToolbar } from './UMLDiagramToolbar';
import { DIAGRAM_HINT_TOP, UML } from './umlDiagramTheme';
import {
  getUmlRelationDirectionMarkerSide,
  getUmlRelationEdgeState,
  UMLMultiplicityBadge,
  UMLRelationDirectionMarker,
  UMLRelationHitTarget,
  UMLRelationLine,
  UML_REACTION_EDGE_COLORS,
  UML_RELATION_EDGE_COLORS,
} from './UMLRelationVisuals';
import { ClassEditPanel, RelationshipEditPanel } from './UMLDiagramEditPanels';
import { UMLClassBox } from './UMLClassBox';
import {
  UML_CLASS_BOX_EDIT_WIDTH,
  UML_CLASS_BOX_WIDTH,
} from './umlDiagramClassMetrics';
import type {
  UmlDiagramClass,
  UmlDiagramEditState,
} from './umlDiagramTypes';
import {
  applyWrapperDragToClass,
  mergeAdditionalClassesWithPositions,
  nextUniqueClassName,
  removeAttributeFromClass,
  removeOperationFromClass,
  renameClassInList,
  renameClassInRelationships,
  updateClassAttribute,
  updateClassById,
  updateClassOperation,
} from './umlDiagramClassTransforms';
import {
  buildUmlClassObstacleRects,
  getUmlClassBoxHeight,
  getUmlDiagramLayoutMetrics,
  getUmlMultiplicityPosition,
  getUmlRelationshipEndpoints,
  insetUmlRelationshipEndpoints,
  UML_DIAGRAM_CANVAS_PADDING,
  UML_MULTIPLICITY_ALONG_OFFSET,
  UML_MULTIPLICITY_BADGE_HALF_HEIGHT,
  UML_MULTIPLICITY_BADGE_HALF_WIDTH,
  UML_MULTIPLICITY_PERPENDICULAR_OFFSET,
  type UmlDiagramRelationshipLayout,
} from './umlDiagramLayoutGeometry';

// ── constants ────────────────────────────────────────────────────────────────

const MAX_ZOOM = 3;
const MIN_ZOOM = 0.35;

/** Dotted workspace background — matches canvas / HomePage grid */
export const WORKSPACE_DOT_BACKGROUND: React.CSSProperties = {
  backgroundColor: '#f3f4f6',
  backgroundImage: 'radial-gradient(circle, #d1d5db 0.75px, transparent 0.75px)',
  backgroundSize: '24px 24px',
};

// ── helpers ──────────────────────────────────────────────────────────────────

function getInheritanceParentId(
  relationships: UMLRelationship[],
  classId: string,
): string | null {
  return relationships.find(
    relationship => relationship.type === 'inheritance'
      && relationship.sourceId === classId,
  )?.targetId ?? null;
}

type ReactionPortSide = 'left' | 'right';

interface ReactionDragState {
  sourceClassId: string;
  sourceSide: ReactionPortSide;
  startX: number;
  startY: number;
  cursorX: number;
  cursorY: number;
}

function getReactionPortPosition(
  cls: UmlDiagramClass,
  offsetX: number,
  offsetY: number,
  side: ReactionPortSide,
): { x: number; y: number } {
  const h = getUmlClassBoxHeight(cls);
  return {
    x: side === 'left'
      ? cls.x + offsetX
      : cls.x + offsetX + UML_CLASS_BOX_WIDTH,
    y: cls.y + offsetY + h / 2,
  };
}

interface ReactionClassContext {
  modelId: number;
  modelName: string;
  modelUrl: string;
  className: string;
}

function parseAdditionalModelId(classId: string): number | null {
  const match = /^addl-(\d+)-/.exec(classId);
  return match ? Number(match[1]) : null;
}

function resolveReactionClassContext(
  classId: string,
  className: string,
  primaryEcore: string,
  primaryName: string,
  primaryModelId: number,
  reactionModels: ReactionsModel[],
): ReactionClassContext {
  const additionalModelId = parseAdditionalModelId(classId);
  if (additionalModelId != null) {
    const model = reactionModels.find(m => m.id === additionalModelId);
    if (model) {
      return {
        modelId: model.id,
        modelName: model.name,
        modelUrl: extractNsUriFromEcore(model.ecoreContent) ?? `http://vitruv.tools/${model.name}`,
        className,
      };
    }
  }

  const primaryModel = reactionModels.find(m => m.name === primaryName) ?? reactionModels[0];
  return {
    modelId: primaryModel?.id ?? primaryModelId,
    modelName: primaryName,
    modelUrl: extractNsUriFromEcore(primaryEcore) ?? `http://vitruv.tools/${primaryName}`,
    className,
  };
}

function buildDefaultReactionConfig(
  source: ReactionClassContext,
  target: ReactionClassContext,
): ReactionConfig {
  return {
    bidirectional: false,
    reactionName: `${source.className}_${target.className}`,
    model1Url: source.modelUrl,
    model2Url: target.modelUrl,
    model1Alias: source.modelName,
    model2Alias: target.modelName,
    model1RootType: source.className,
    model2RootType: target.className,
    model1RootVal: source.className,
  };
}

function isEmptyCanvasTarget(target: HTMLElement): boolean {
  return !target.closest('[data-classbox]')
    && !target.closest('[data-rel-hit-line]')
    && !target.closest('[data-rel-direction-marker]')
    && !target.closest('[data-uml-toolbar]')
    && !target.closest('[data-rel-edit-panel]')
    && !target.closest('[data-class-edit-panel]')
    && !target.closest('[data-uml-connect-banner]')
    && !target.closest('[data-uml-validation]')
    && !target.closest('[data-wrapper-header]')
    && !target.closest('[data-reaction-port]')
    && !target.closest('[data-reaction-edit-panel]');
}

type EditState = UmlDiagramEditState;

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

function getReactionPortTargetClassId(hit: HTMLElement | null, sourceClassId: string): string | null {
  const port = hit?.closest('[data-reaction-port]') as HTMLElement | null;
  const targetClassId = port?.dataset.classId;
  if (!targetClassId || targetClassId === sourceClassId) return null;
  return targetClassId;
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
  /** Additional models to render in the same canvas with colored wrapper groups. */
  additionalModels?: { id: number; name: string; ecoreContent: string; color: string; fill: string }[];
  /** Called when the user removes an added (non-primary) meta model from the view. */
  onRemoveAdditionalModel?: (modelName: string) => void;
  /** When 'reactions', elements show connection indicators. */
  reactionsMode?: 'uml' | 'reactions';
  /** Models available in the reactions view for resolving URLs and aliases. */
  reactionModels?: ReactionsModel[];
  /** VSUM project id for Reaction Editor LSP connection. */
  vsumId?: string;
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

function classesShareModel(
  classIdA: string,
  classIdB: string,
  classModelMap: Map<string, { name: string; color: string; fill: string }>,
): boolean {
  const modelA = classModelMap.get(classIdA)?.name;
  const modelB = classModelMap.get(classIdB)?.name;
  if (!modelA || !modelB) return false;
  return modelA === modelB;
}

function getConnectModeHint(connectSourceId: string | null, multiModel: boolean): string {
  if (connectSourceId) {
    return multiModel
      ? 'Click a target class in the same model'
      : 'Click the target class to create a connection';
  }
  return multiModel
    ? 'Click the source class, then another class in the same model'
    : 'Click the source class, then the target class';
}

function getValidationBannerInset(
  selectedClass: UmlDiagramClass | null | undefined,
  selectedRel: UMLRelationship | null | undefined,
  reactionPanelOpen = false,
): { left: number; right: number } {
  return {
    left: selectedClass ? 288 : 12,
    right: (selectedRel || reactionPanelOpen) ? 320 : 12,
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
  additionalModels = [],
  onRemoveAdditionalModel,
  reactionsMode = 'uml',
  reactionModels = [],
  vsumId,
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

  // Additional models: parse and track classes per model group
  const additionalParsed = useMemo(() => {
    return additionalModels.map((m, i) => {
      try {
        const model = ecoreToUml(m.ecoreContent);
        return {
          ...m,
          classes: model.classes.map(c => ({
            ...c,
            operations: c.operations ?? [],
            id: `addl-${m.id}-${c.id}`,
            x: c.x + (i + 1) * 450,
            y: c.y,
          })),
          relationships: model.relationships.map(r => ({
            ...r,
            id: `addl-${m.id}-${r.id}`,
            sourceId: `addl-${m.id}-${r.sourceId}`,
            targetId: `addl-${m.id}-${r.targetId}`,
          })),
        };
      } catch { return { ...m, classes: [] as UmlDiagramClass[], relationships: [] as UMLRelationship[] }; }
    });
  }, [additionalModels]);

  const [additionalClasses, setAdditionalClasses] = useState<UmlDiagramClass[]>(() =>
    additionalParsed.flatMap(m => m.classes)
  );
  const [additionalRels, setAdditionalRels] = useState<UMLRelationship[]>(() =>
    additionalParsed.flatMap(m => m.relationships)
  );

  useEffect(() => {
    const newCls = additionalParsed.flatMap(m => m.classes);
    setAdditionalClasses(prev => mergeAdditionalClassesWithPositions(prev, newCls));
    setAdditionalRels(additionalParsed.flatMap(m => m.relationships));
  }, [additionalParsed]);

  // Map classId -> model color info for wrapper rendering
  const classModelMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string; fill: string }>();
    // Primary model classes
    for (const cls of classes) {
      if (additionalModels.length > 0) {
        map.set(cls.id, { name: fileName?.replace(/\.ecore$/, '') || 'Primary', color: '#2563eb', fill: 'rgba(37,99,235,0.06)' });
      }
    }
    // Additional model classes
    for (const m of additionalParsed) {
      for (const cls of m.classes) {
        map.set(cls.id, { name: m.name, color: m.color, fill: m.fill });
      }
    }
    return map;
  }, [classes, additionalParsed, additionalModels.length, fileName]);

  // Combined classes and relationships for rendering
  const allClasses = useMemo(() => [...classes, ...additionalClasses], [classes, additionalClasses]);
  const allRels = useMemo(() => [...relationships, ...additionalRels], [relationships, additionalRels]);

  const rels = useMemo(
    () => assignParallelRelMeta(allRels) as UmlDiagramRelationshipLayout[],
    [allRels],
  );

  const modelGroups = useMemo(() => {
    if (additionalModels.length === 0) return [];
    return computeUmlModelGroups(
      allClasses,
      classModelMap,
      getUmlClassBoxHeight,
      UML_CLASS_BOX_WIDTH,
    );
  }, [additionalModels.length, allClasses, classModelMap]);

  const removableModelNames = useMemo(
    () => new Set(additionalModels.map(m => m.name)),
    [additionalModels],
  );

  const additionalClassIdKey = useMemo(
    () => additionalClasses.map(c => c.id).sort((a, b) => a.localeCompare(b)).join(','),
    [additionalClasses],
  );

  useEffect(() => {
    const validIds = new Set([
      ...classes.map(c => c.id),
      ...additionalClasses.map(c => c.id),
    ]);
    setReactionEdges(prev => {
      const next = prev.filter(e => validIds.has(e.sourceClassId) && validIds.has(e.targetClassId));
      return next.length === prev.length ? prev : next;
    });
    setRelationships(prev => {
      const next = prev.filter(r => validIds.has(r.sourceId) && validIds.has(r.targetId));
      return next.length === prev.length ? prev : next;
    });
    setSelectedRelId(prev => (prev && validIds.has(prev) ? prev : null));
    setEditingReactionId(prev => (prev && validIds.has(prev) ? prev : null));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- prune only when added models change
  }, [additionalClassIdKey]);
  const [edit, setEdit] = useState<EditState | null>(null);
  const editRef = useRef<EditState | null>(null);
  editRef.current = edit;
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedRelId, setSelectedRelId] = useState<string | null>(null);
  const [hoveredRelId, setHoveredRelId] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [reactionDrag, setReactionDrag] = useState<ReactionDragState | null>(null);
  const [reactionEdges, setReactionEdges] = useState<ReactionEdge[]>([]);
  const [editingReactionId, setEditingReactionId] = useState<string | null>(null);
  const [reactionEditorState, setReactionEditorState] = useState<CodeEditorState | null>(null);
  const classesRef = useRef(classes);
  classesRef.current = classes;
  const relationshipsRef = useRef(relationships);
  relationshipsRef.current = relationships;
  const dragHistorySavedRef = useRef(false);
  const reactionDragActiveRef = useRef(false);

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
    setEdit(null);
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
    setEdit(null);
    initialSnapshotRef.current = umlSemanticSnapshot({
      classes: baseClasses,
      relationships: next.relationships,
    });
    setSaveMessage('');
    if (preserveLivePositions && fileName) {
      const viewport: UmlViewport = {
        x: viewRef.current.x,
        y: viewRef.current.y,
        scale: viewRef.current.scale,
      };
      saveUmlLayout(layoutScopeId, fileName, buildUmlLayoutPayload(baseClasses, viewport));
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

  const diagramRef = useRef<UMLDiagramHandle>(null);
  const didInitialFit = useRef(false);
  const layoutOffsetRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    didInitialFit.current = false;
    layoutOffsetRef.current = null;
  }, [ecoreContent, fileName, layoutScopeId]);

  // ── viewport (pan + zoom) ──────────────────────────────────────────────────
  const [vx, setVx] = useState(0);
  const [vy, setVy] = useState(0);
  const [vscale, setVscale] = useState(1);
  const [panning, setPanning] = useState(false);
  const viewRef = useRef({ x: 0, y: 0, scale: 1 });

  const persistLayout = useCallback(() => {
    if (!fileName || classesRef.current.length === 0) return;
    const viewport: UmlViewport = {
      x: viewRef.current.x,
      y: viewRef.current.y,
      scale: viewRef.current.scale,
    };
    saveUmlLayout(layoutScopeId, fileName, buildUmlLayoutPayload(classesRef.current, viewport));
  }, [fileName, layoutScopeId]);

  const scheduleLayoutSave = useCallback(() => {
    if (!fileName) return;
    persistLayout();
  }, [fileName, persistLayout]);

  const layoutSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleDebouncedLayoutSave = useCallback(() => {
    if (!fileName) return;
    if (layoutSaveTimerRef.current) clearTimeout(layoutSaveTimerRef.current);
    layoutSaveTimerRef.current = setTimeout(() => {
      layoutSaveTimerRef.current = null;
      persistLayout();
    }, 300);
  }, [fileName, persistLayout]);

  // Restore saved pan/zoom when reopening a diagram
  useEffect(() => {
    if (!fileName) return;
    const saved = loadUmlViewport(layoutScopeId, fileName);
    if (!saved) return;
    viewRef.current = saved;
    setVx(saved.x);
    setVy(saved.y);
    setVscale(saved.scale);
  }, [ecoreContent, fileName, layoutScopeId]);

  // Auto-save box positions while editing
  useEffect(() => {
    if (!fileName) return;
    const timer = setTimeout(persistLayout, 250);
    return () => {
      clearTimeout(timer);
      persistLayout();
    };
  }, [classes, fileName, layoutScopeId, persistLayout]);

  useEffect(() => {
    if (!fileName) return;
    return () => {
      if (layoutSaveTimerRef.current) clearTimeout(layoutSaveTimerRef.current);
      persistLayout();
    };
  }, [fileName, layoutScopeId, persistLayout]);

  // Fit once on first open only when no saved layout exists
  useEffect(() => {
    if (didInitialFit.current || classes.length === 0) return;
    const t = setTimeout(() => {
      const hasSaved = fileName ? hasSavedUmlLayout(layoutScopeId, fileName) : false;
      if (!hasSaved) diagramRef.current?.fitToView?.();
      didInitialFit.current = true;
    }, 120);
    return () => clearTimeout(t);
  }, [classes.length, fileName, layoutScopeId]);

  const layout = useMemo(() => {
    if (!layoutOffsetRef.current && allClasses.length > 0) {
      const initial = getUmlDiagramLayoutMetrics(allClasses);
      layoutOffsetRef.current = { offsetX: initial.offsetX, offsetY: initial.offsetY };
      return initial;
    }
    return getUmlDiagramLayoutMetrics(
      allClasses,
      layoutOffsetRef.current,
    );
  }, [allClasses]);
  const { totalW, totalH, offsetX, offsetY } = layout;
  const containerRef = useRef<HTMLElement>(null);

  const handleMinimapPan = useCallback((nx: number, ny: number) => {
    viewRef.current = { ...viewRef.current, x: nx, y: ny };
    setVx(nx);
    setVy(ny);
    scheduleDebouncedLayoutSave();
  }, [scheduleDebouncedLayoutSave]);

  const applyZoom = useCallback((factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const { x, y, scale } = viewRef.current;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    const ns = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale * factor));
    const ratio = ns / scale;
    const nx = cx - ratio * (cx - x);
    const ny = cy - ratio * (cy - y);
    viewRef.current = { x: nx, y: ny, scale: ns };
    setVx(nx); setVy(ny); setVscale(ns);
    scheduleDebouncedLayoutSave();
  }, [scheduleDebouncedLayoutSave]);

  useEffect(() => { viewRef.current = { x: vx, y: vy, scale: vscale }; }, [vx, vy, vscale]);

  // non-passive wheel so we can preventDefault and stop page scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const { x, y, scale } = viewRef.current;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.88 : 1 / 0.88;
      const ns = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale * factor));
      const ratio = ns / scale;
      const nx = mx - ratio * (mx - x);
      const ny = my - ratio * (my - y);
      viewRef.current = { x: nx, y: ny, scale: ns };
      setVscale(ns);
      setVx(nx);
      setVy(ny);
      scheduleDebouncedLayoutSave();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [scheduleDebouncedLayoutSave]);

  const moveClass = useCallback((id: string, x: number, y: number) => {
    if (!dragHistorySavedRef.current) {
      recordChange();
      dragHistorySavedRef.current = true;
    }
    setClasses(prev => prev.map(c => (c.id === id ? { ...c, x, y } : c)));
    scheduleDebouncedLayoutSave();
  }, [recordChange, scheduleDebouncedLayoutSave]);

  const finishClassDrag = useCallback(() => {
    dragHistorySavedRef.current = false;
    scheduleLayoutSave();
  }, [scheduleLayoutSave]);

  const moveAdditionalClass = useCallback((id: string, x: number, y: number) => {
    setAdditionalClasses(prev => prev.map(c => (c.id === id ? { ...c, x, y } : c)));
  }, []);

  const wrapperDragOrigins = useRef<Map<string, { x: number; y: number }>>(new Map());

  const handleWrapperDragStart = useCallback((e: React.MouseEvent, groupName: string) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const primaryName = fileName?.replace(/\.ecore$/, '') || 'Primary';

    const origins = new Map<string, { x: number; y: number }>();
    const allCurrent = primaryName === groupName ? classes : additionalClasses;
    for (const c of allCurrent) {
      const info = classModelMap.get(c.id);
      if (info?.name === groupName) {
        origins.set(c.id, { x: c.x, y: c.y });
      }
    }
    wrapperDragOrigins.current = origins;

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / vscale;
      const dy = (ev.clientY - startY) / vscale;
      const origins = wrapperDragOrigins.current;
      const applyDrag = (c: UmlDiagramClass) => applyWrapperDragToClass(c, origins, dx, dy);

      if (groupName === primaryName) {
        setClasses(prev => prev.map(applyDrag));
      } else {
        setAdditionalClasses(prev => prev.map(applyDrag));
      }
    };

    const onUp = () => {
      wrapperDragOrigins.current.clear();
      scheduleDebouncedLayoutSave();
      globalThis.removeEventListener('mousemove', onMove);
      globalThis.removeEventListener('mouseup', onUp);
    };

    globalThis.addEventListener('mousemove', onMove);
    globalThis.addEventListener('mouseup', onUp);
  }, [vscale, fileName, classes, additionalClasses, classModelMap, scheduleDebouncedLayoutSave]);

  const saveName = useCallback((oldId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setEdit(null);
      return;
    }
    recordChange();
    const newId = sanitizeUmlClassId(trimmed);
    setClasses(prev => renameClassInList(prev, oldId, newId, trimmed));
    setRelationships(prev => renameClassInRelationships(prev, oldId, newId));
    setSelectedClassId(prev => (prev === oldId ? newId : prev));
    setConnectSourceId(prev => (prev === oldId ? newId : prev));
    setEdit(null);
  }, [recordChange]);

  const saveAttr = useCallback((classId: string, attrId: string, name: string, type: string, visibility: UMLVisibility) => {
    recordChange();
    setClasses(prev => updateClassAttribute(prev, classId, attrId, name, type, visibility));
    setEdit(null);
  }, [recordChange]);

  const saveOp = useCallback((classId: string, opId: string, name: string, returnType: string, visibility: UMLVisibility) => {
    recordChange();
    setClasses(prev => updateClassOperation(prev, classId, opId, name, returnType, visibility));
    setEdit(null);
  }, [recordChange]);

  const flushPendingEdit = useCallback(() => {
    const pending = editRef.current;
    if (!pending) return;

    const active = document.activeElement as HTMLElement | null;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')) {
      active.blur();
      return;
    }

    if (pending.kind === 'attr') {
      saveAttr(pending.classId, pending.attrId, pending.name, pending.type, pending.visibility);
    } else if (pending.kind === 'op') {
      saveOp(pending.classId, pending.opId, pending.name, pending.returnType, pending.visibility);
    } else if (pending.kind === 'name') {
      saveName(pending.classId, pending.val);
    }
  }, [saveAttr, saveOp, saveName]);

  const dismissClassSelection = useCallback(() => {
    flushPendingEdit();
    setSelectedClassId(null);
    setEdit(null);
  }, [flushPendingEdit]);

  const handleCanvasDoubleClick = useCallback((e: MouseEvent) => {
    if (!interactive) return;
    if (!isEmptyCanvasTarget(e.target as HTMLElement)) return;
    e.preventDefault();
    e.stopPropagation();
    dismissClassSelection();
  }, [interactive, dismissClassSelection]);

  const handlePanStart = useCallback((e: MouseEvent) => {
    flushPendingEdit();
    if (reactionDragActiveRef.current) return;
    if (!isEmptyCanvasTarget(e.target as HTMLElement)) return;
    e.preventDefault();
    setPanning(true);
    const { x, y } = viewRef.current;
    const sx = e.clientX, sy = e.clientY;
    const onMove = (ev: MouseEvent) => {
      const nx = x + ev.clientX - sx;
      const ny = y + ev.clientY - sy;
      viewRef.current = { ...viewRef.current, x: nx, y: ny };
      setVx(nx);
      setVy(ny);
    };
    const onUp = () => {
      setPanning(false);
      scheduleLayoutSave();
      globalThis.removeEventListener('mousemove', onMove);
      globalThis.removeEventListener('mouseup', onUp);
    };
    globalThis.addEventListener('mousemove', onMove);
    globalThis.addEventListener('mouseup', onUp);
  }, [scheduleLayoutSave, flushPendingEdit]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('mousedown', handlePanStart);
    el.addEventListener('dblclick', handleCanvasDoubleClick);
    return () => {
      el.removeEventListener('mousedown', handlePanStart);
      el.removeEventListener('dblclick', handleCanvasDoubleClick);
    };
  }, [handlePanStart, handleCanvasDoubleClick, classes.length]);

  const addAttr = useCallback((classId: string) => {
    flushPendingEdit();
    recordChange();
    const cls = classesRef.current.find(c => c.id === classId);
    const uniqueName = nextUniqueAttributeName(cls?.attributes.map(a => a.name) ?? []);
    const newAttr: UMLAttribute = {
      id: `${classId}-${Date.now()}`,
      name: uniqueName,
      type: 'String',
      visibility: '+',
    };
    setClasses(prev => updateClassById(prev, classId, classItem => ({
      ...classItem,
      attributes: [...classItem.attributes, newAttr],
    })));
    setEdit({ classId, kind: 'attr', attrId: newAttr.id, name: newAttr.name, type: newAttr.type, visibility: '+' });
  }, [recordChange, flushPendingEdit]);

  const addOp = useCallback((classId: string) => {
    flushPendingEdit();
    recordChange();
    const cls = classesRef.current.find(c => c.id === classId);
    const uniqueName = nextUniqueOperationName(cls?.operations.map(o => o.name) ?? []);
    const newOp: UMLOperation = {
      id: `${classId}-op-${Date.now()}`,
      name: uniqueName,
      returnType: 'Void',
      visibility: '+',
    };
    setClasses(prev => updateClassById(prev, classId, classItem => ({
      ...classItem,
      operations: [...classItem.operations, newOp],
    })));
    setEdit({ classId, kind: 'op', opId: newOp.id, name: newOp.name, returnType: newOp.returnType, visibility: '+' });
  }, [recordChange, flushPendingEdit]);

  const deleteAttr = useCallback((classId: string, attrId: string) => {
    recordChange();
    setClasses(prev => updateClassById(prev, classId, classItem => removeAttributeFromClass(classItem, attrId)));
  }, [recordChange]);

  const deleteOp = useCallback((classId: string, opId: string) => {
    recordChange();
    setClasses(prev => updateClassById(prev, classId, classItem => removeOperationFromClass(classItem, opId)));
  }, [recordChange]);

  const deleteClass = useCallback((classId: string) => {
    recordChange();
    setClasses(prev => prev.filter(c => c.id !== classId));
    setRelationships(prev => prev.filter(r => r.sourceId !== classId && r.targetId !== classId));
    setSelectedClassId(prev => (prev === classId ? null : prev));
    setConnectSourceId(prev => (prev === classId ? null : prev));
    setEdit(prev => (prev?.classId === classId ? null : prev));
  }, [recordChange]);

  const addClass = useCallback(() => {
    recordChange();
    const el = containerRef.current;
    const { x: vx0, y: vy0, scale } = viewRef.current;
    const offset = layoutOffsetRef.current ?? {
      offsetX: UML_DIAGRAM_CANVAS_PADDING,
      offsetY: UML_DIAGRAM_CANVAS_PADDING,
    };
    let cx = 200;
    let cy = 120;
    if (el) {
      cx = (el.clientWidth / 2 - vx0) / scale
        - offset.offsetX
        - UML_CLASS_BOX_EDIT_WIDTH / 2;
      cy = (el.clientHeight / 2 - vy0) / scale - offset.offsetY - 72;
    }

    const name = nextUniqueClassName(classesRef.current.map(c => c.name));
    const id = sanitizeUmlClassId(name);

    const newClass: UmlDiagramClass = {
      id,
      name,
      isAbstract: false,
      isInterface: false,
      attributes: [],
      operations: [],
      x: cx,
      y: cy,
    };
    setClasses(prev => [...prev, newClass]);
    setSelectedClassId(id);
  }, [recordChange]);

  const addRelationship = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return false;
    if (additionalModels.length > 0 && !classesShareModel(sourceId, targetId, classModelMap)) {
      return false;
    }
    const exists = relationshipsRef.current.some(
      r => r.sourceId === sourceId && r.targetId === targetId && r.type === 'association',
    );
    if (exists) return false;
    recordChange();
    const newRelId = `rel-${Date.now()}`;
    setRelationships(prev => [...prev, {
      id: newRelId,
      sourceId,
      targetId,
      type: 'association',
      targetMultiplicity: '0..1',
      sourceMultiplicity: '1',
    }]);
    setSelectedRelId(newRelId);
    return true;
  }, [recordChange, additionalModels.length, classModelMap]);

  const primaryModelName = fileName?.replace(/\.ecore$/, '') || 'Primary';
  const primaryModelId = reactionModels[0]?.id ?? 0;

  const addReactionConnection = useCallback((sourceClassId: string, targetClassId: string) => {
    if (sourceClassId === targetClassId) return;

    const sourceClass = allClasses.find(c => c.id === sourceClassId);
    const targetClass = allClasses.find(c => c.id === targetClassId);
    if (!sourceClass || !targetClass) return;

    const exists = relationshipsRef.current.some(
      r => r.sourceId === sourceClassId && r.targetId === targetClassId,
    );
    if (exists) {
      const existing = reactionEdges.find(
        e => e.sourceClassId === sourceClassId && e.targetClassId === targetClassId,
      );
      if (existing) {
        setEditingReactionId(existing.id);
        setSelectedRelId(existing.id);
      }
      return;
    }

    recordChange();
    const newRelId = `reaction-${Date.now()}`;
    const sourceCtx = resolveReactionClassContext(
      sourceClassId,
      sourceClass.name,
      ecoreContent,
      primaryModelName,
      primaryModelId,
      reactionModels,
    );
    const targetCtx = resolveReactionClassContext(
      targetClassId,
      targetClass.name,
      ecoreContent,
      primaryModelName,
      primaryModelId,
      reactionModels,
    );

    const reactionEdge: ReactionEdge = {
      id: newRelId,
      sourceModelId: sourceCtx.modelId,
      sourceClassId,
      sourceClassName: sourceClass.name,
      targetModelId: targetCtx.modelId,
      targetClassId,
      targetClassName: targetClass.name,
      config: buildDefaultReactionConfig(sourceCtx, targetCtx),
    };

    setRelationships(prev => [...prev, {
      id: newRelId,
      sourceId: sourceClassId,
      targetId: targetClassId,
      type: 'association',
      label: reactionEdge.config.reactionName,
    }]);
    setReactionEdges(prev => [...prev, reactionEdge]);
    setSelectedRelId(newRelId);
    setEditingReactionId(newRelId);
    setSelectedClassId(null);
  }, [
    allClasses,
    reactionEdges,
    recordChange,
    ecoreContent,
    primaryModelName,
    primaryModelId,
    reactionModels,
  ]);

  const updateReactionConfig = useCallback((reactionId: string, config: ReactionConfig) => {
    setReactionEdges(prev => prev.map(edge =>
      edge.id === reactionId ? { ...edge, config } : edge,
    ));
    setRelationships(prev => prev.map(rel =>
      rel.id === reactionId ? { ...rel, label: config.reactionName } : rel,
    ));
  }, []);

  const deleteReaction = useCallback((reactionId: string) => {
    recordChange();
    setReactionEdges(prev => prev.filter(edge => edge.id !== reactionId));
    setRelationships(prev => prev.filter(rel => rel.id !== reactionId));
    if (editingReactionId === reactionId) setEditingReactionId(null);
    if (selectedRelId === reactionId) setSelectedRelId(null);
    if (reactionEditorState?.edgeId === reactionId) setReactionEditorState(null);
  }, [recordChange, editingReactionId, selectedRelId, reactionEditorState?.edgeId]);

  const openReactionEditor = useCallback(async (reactionId: string) => {
    const edge = reactionEdges.find(e => e.id === reactionId);
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
    setSelectedRelId(reactionId);
    setSelectedClassId(null);
  }, [reactionEdges]);

  const handleCloseReactionEditor = useCallback(() => {
    setReactionEditorState(null);
  }, []);

  const handleSaveReactionCode = useCallback(async (code: string) => {
    if (!reactionEditorState?.edgeId) return;
    const reactionId = reactionEditorState.edgeId;
    try {
      const reactionFileId = await persistReactionCode(code, reactionEditorState.reactionFileId);
      setReactionEdges(prev => prev.map(edge =>
        edge.id === reactionId ? { ...edge, code, reactionFileId } : edge,
      ));
      setReactionEditorState(prev =>
        prev ? { ...prev, reactionFileId } : prev,
      );
    } catch (err) {
      console.error('Failed to save reaction file', err);
      throw err;
    }
  }, [reactionEditorState]);

  const handleDeleteReactionFromEditor = useCallback(() => {
    if (reactionEditorState?.edgeId) {
      deleteReaction(reactionEditorState.edgeId);
    }
  }, [reactionEditorState, deleteReaction]);

  const clientToDiagram = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const { x: viewX, y: viewY, scale } = viewRef.current;
    return {
      x: (clientX - rect.left - viewX) / scale,
      y: (clientY - rect.top - viewY) / scale,
    };
  }, []);

  const handleReactionPortMouseDown = useCallback((
    e: React.MouseEvent,
    classId: string,
    side: ReactionPortSide,
  ) => {
    if (!interactive || reactionsMode !== 'reactions') return;
    e.stopPropagation();
    e.preventDefault();
    reactionDragActiveRef.current = true;

    const cls = allClasses.find(c => c.id === classId);
    if (!cls) return;

    const { x: startX, y: startY } = getReactionPortPosition(cls, offsetX, offsetY, side);
    const cursor = clientToDiagram(e.clientX, e.clientY);
    setReactionDrag({
      sourceClassId: classId,
      sourceSide: side,
      startX,
      startY,
      cursorX: cursor.x,
      cursorY: cursor.y,
    });

    const onMove = (ev: MouseEvent) => {
      ev.preventDefault();
      const next = clientToDiagram(ev.clientX, ev.clientY);
      setReactionDrag(prev => prev ? { ...prev, cursorX: next.x, cursorY: next.y } : null);
    };

    const onUp = (ev: MouseEvent) => {
      reactionDragActiveRef.current = false;
      const targetClassId = getReactionPortTargetClassId(
        document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null,
        classId,
      );
      if (targetClassId) {
        addReactionConnection(classId, targetClassId);
      }
      setReactionDrag(null);
      globalThis.removeEventListener('mousemove', onMove);
      globalThis.removeEventListener('mouseup', onUp);
    };

    globalThis.addEventListener('mousemove', onMove);
    globalThis.addEventListener('mouseup', onUp);
  }, [
    interactive,
    reactionsMode,
    allClasses,
    offsetX,
    offsetY,
    clientToDiagram,
    addReactionConnection,
  ]);

  const deleteRelationship = useCallback((relId: string) => {
    recordChange();
    setRelationships(prev => prev.filter(r => r.id !== relId));
    setSelectedRelId(prev => (prev === relId ? null : prev));
  }, [recordChange]);

  const updateRelationship = useCallback((relId: string, patch: Partial<UMLRelationship>) => {
    recordChange();
    setRelationships(prev => prev.map(r => (r.id === relId ? { ...r, ...patch } : r)));
  }, [recordChange]);

  const tryEscape = useCallback(() => {
    if (reactionDrag) {
      reactionDragActiveRef.current = false;
      setReactionDrag(null);
      return true;
    }
    if (editingReactionId) {
      setEditingReactionId(null);
      return true;
    }
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
      setEdit(null);
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
  }, [reactionDrag, editingReactionId, connectMode, connectSourceId, edit, selectedRelId, selectedClassId, dismissClassSelection]);

  useEffect(() => {
    if (reactionsMode === 'reactions') {
      reactionDragActiveRef.current = false;
      setReactionDrag(null);
      setEditingReactionId(null);
      setConnectMode(false);
      setConnectSourceId(null);
    }
  }, [reactionsMode]);

  const handleRelationshipClick = useCallback((relId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isReactionEdge = reactionEdges.some(edge => edge.id === relId);
    if (reactionsMode === 'reactions' && isReactionEdge) {
      if (e.detail >= 2) {
        setEditingReactionId(null);
        void openReactionEditor(relId);
        return;
      }
      setEditingReactionId(relId);
      setSelectedRelId(relId);
      setSelectedClassId(null);
      return;
    }
    setEditingReactionId(null);
    setSelectedRelId(relId);
  }, [reactionsMode, reactionEdges, openReactionEditor]);

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
    const handle: UMLDiagramHandle = {
      zoomIn: () => applyZoom(1.3),
      zoomOut: () => applyZoom(1 / 1.3),
      fitToView: () => {
        const el = containerRef.current;
        if (!el || allClasses.length === 0) return;
        const PAD = 48;
        // True bounding box over every currently visible class (primary + additional
        // models) — not the outlier-excluding "dense cluster" heuristic from
        // computeUmlFocusRect. That heuristic is meant only for the very first
        // auto-fit on open; reusing it here meant a class dragged away from the
        // rest got excluded, so Fit View re-centered on its old, now-empty
        // neighborhood instead of the current layout.
        const focus = {
          minX: layout.minX - PAD,
          minY: layout.minY - PAD,
          maxX: layout.maxX + PAD,
          maxY: layout.maxY + PAD,
        };
        const contentW = focus.maxX - focus.minX;
        const contentH = focus.maxY - focus.minY;
        const { clientWidth: cw, clientHeight: ch } = el;
        // No lower clamp here (unlike manual zoom's MIN_ZOOM): Fit View's whole point is
        // to show every currently visible class, however far apart they've been dragged —
        // clamping to a "readable" floor previously cut off distant classes off-screen.
        const scale = Math.min(
          (cw - PAD * 2) / Math.max(contentW, 1),
          (ch - PAD * 2) / Math.max(contentH, 1),
          1.15,
        );
        const dispMinX = focus.minX + offsetX;
        const dispMinY = focus.minY + offsetY;
        const nx = (cw - contentW * scale) / 2 - dispMinX * scale;
        const ny = (ch - contentH * scale) / 2 - dispMinY * scale;
        viewRef.current = { x: nx, y: ny, scale };
        setVx(nx); setVy(ny); setVscale(scale);
        scheduleLayoutSave();
      },
      flushLayout: () => persistLayout(),
      getModel,
      isDirty,
      save: handleSave,
      reload: (content: string) => {
        skipNextEcoreResetRef.current = true;
        resetFromEcore(content, false);
        setTimeout(() => {
          if (fileName) {
            const saved = loadUmlViewport(layoutScopeId, fileName);
            if (saved) {
              viewRef.current = saved;
              setVx(saved.x);
              setVy(saved.y);
              setVscale(saved.scale);
              return;
            }
          }
          diagramRef.current?.fitToView?.();
        }, 120);
      },
      undo: handleUndo,
      redo: handleRedo,
      canUndo: () => historyCanUndo,
      canRedo: () => historyCanRedo,
      tryEscape,
    };
    diagramRef.current = handle;
    return handle;
  }, [applyZoom, allClasses, layout, offsetX, offsetY, fileName, layoutScopeId, persistLayout, scheduleLayoutSave, getModel, isDirty, handleSave, resetFromEcore, tryEscape, handleUndo, handleRedo, historyCanUndo, historyCanRedo]);

  const handleClassSelect = useCallback((classId: string) => {
    if (!interactive) return;
    flushPendingEdit();
    if (connectMode && reactionsMode !== 'reactions') {
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
    setEditingReactionId(null);
    setSelectedClassId(classId);
  }, [interactive, connectMode, reactionsMode, connectSourceId, addRelationship, flushPendingEdit]);

  const updateClass = useCallback((classId: string, patch: Partial<Pick<UmlDiagramClass, 'name' | 'isAbstract' | 'isInterface'>>) => {
    recordChange();
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed) return;
      const newId = sanitizeUmlClassId(trimmed);
      setClasses(prev => renameClassInList(prev, classId, newId, trimmed));
      setRelationships(prev => renameClassInRelationships(prev, classId, newId));
      setSelectedClassId(prev => (prev === classId ? newId : prev));
      setConnectSourceId(prev => (prev === classId ? newId : prev));
      return;
    }
    setClasses(prev => updateClassById(prev, classId, classItem => ({ ...classItem, ...patch })));
  }, [recordChange]);

  const setInheritanceParent = useCallback((classId: string, parentId: string | null) => {
    recordChange();
    setRelationships(prev => {
      const filtered = prev.filter(r => !(r.type === 'inheritance' && r.sourceId === classId));
      if (!parentId || parentId === classId) return filtered;
      return [...filtered, {
        id: `rel-${Date.now()}`,
        sourceId: classId,
        targetId: parentId,
        type: 'inheritance',
      }];
    });
  }, [recordChange]);

  const handleDeleteSelected = useCallback(() => {
    if (editingReactionId) {
      deleteReaction(editingReactionId);
      return;
    }
    if (selectedRelId && reactionEdges.some(edge => edge.id === selectedRelId)) {
      deleteReaction(selectedRelId);
      return;
    }
    if (selectedRelId) {
      deleteRelationship(selectedRelId);
      return;
    }
    if (selectedClassId) {
      deleteClass(selectedClassId);
    }
  }, [editingReactionId, selectedRelId, selectedClassId, reactionEdges, deleteReaction, deleteRelationship, deleteClass]);

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

  const edgeLayouts = useMemo(() => {
    const raw = rels.flatMap(rel => {
      const endpoints = getUmlRelationshipEndpoints(
        rel,
        allClasses,
        offsetX,
        offsetY,
      );
      if (!endpoints) return [];
      const { drawP1, drawP2 } = insetUmlRelationshipEndpoints(
        endpoints.p1,
        endpoints.p2,
      );
      return [{ rel, p1: endpoints.p1, p2: endpoints.p2, drawP1, drawP2 }];
    });

    const bridges = computeLineBridges(raw.map(r => ({
      id: r.rel.id,
      drawP1: r.drawP1,
      drawP2: r.drawP2,
    })));

    return raw.map(r => ({
      ...r,
      bridges: bridges.get(r.rel.id) ?? [],
    }));
  }, [rels, allClasses, offsetX, offsetY]);

  const multiplicityBadges = useMemo(() => {
    const reactionRelIds = new Set(reactionEdges.map(edge => edge.id));
    const raw: MultiplicityBadge[] = [];
    for (const layout of edgeLayouts) {
      const { rel, p1, p2 } = layout;
      if (reactionRelIds.has(rel.id)) continue;

      const markerSide = getUmlRelationDirectionMarkerSide(rel.type);

      if (rel.sourceMultiplicity) {
        const pos = getUmlMultiplicityPosition(
          p1.x,
          p1.y,
          p2.x,
          p2.y,
          'start',
          markerSide === 'start',
        );
        raw.push({
          key: `${rel.id}-src`,
          relId: rel.id,
          end: 'start',
          anchorClassId: rel.sourceId,
          text: rel.sourceMultiplicity,
          ...pos,
        });
      }
      if (rel.targetMultiplicity) {
        const pos = getUmlMultiplicityPosition(
          p1.x,
          p1.y,
          p2.x,
          p2.y,
          'end',
          markerSide === 'end',
        );
        raw.push({
          key: `${rel.id}-tgt`,
          relId: rel.id,
          end: 'end',
          anchorClassId: rel.targetId,
          text: rel.targetMultiplicity,
          ...pos,
        });
      }
    }
    const obstacles = buildUmlClassObstacleRects(
      allClasses,
      offsetX,
      offsetY,
    );
    return resolveMultiplicityBadgeCollisions(
      optimizeMultiplicityBadges(
        raw,
        UML_MULTIPLICITY_ALONG_OFFSET,
        UML_MULTIPLICITY_PERPENDICULAR_OFFSET,
      ),
      obstacles,
      UML_MULTIPLICITY_BADGE_HALF_WIDTH,
      UML_MULTIPLICITY_BADGE_HALF_HEIGHT,
    );
  }, [edgeLayouts, reactionEdges, allClasses, offsetX, offsetY]);

  const reactionEdgeById = useMemo(
    () => new Map(reactionEdges.map(edge => [edge.id, edge])),
    [reactionEdges],
  );

  const validationIssues = useMemo(
    () => validateUmlModel({ classes, relationships }, allClasses),
    [classes, relationships, allClasses],
  );

  if (classes.length === 0) {
    return <UmlEmptyDiagram interactive={interactive} onAddClass={addClass} />;
  }

  const canDelete = !!(selectedRelId || selectedClassId);
  const selectedRel = selectedRelId ? relationships.find(r => r.id === selectedRelId) : null;
  const editingReaction = editingReactionId
    ? reactionEdges.find(edge => edge.id === editingReactionId) ?? null
    : null;
  const selectedRelIsReaction = !!(selectedRelId && reactionEdges.some(edge => edge.id === selectedRelId));
  const selectedClass = selectedClassId ? classes.find(c => c.id === selectedClassId) : null;
  const hasUnsavedChanges = isDirty();
  const validationInset = getValidationBannerInset(
    selectedClass,
    selectedRel,
    !!(editingReaction || (reactionsMode === 'reactions' && selectedRelIsReaction)),
  );
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
    {reactionsMode === 'reactions' && (
      <style>{`@keyframes reactionPulse{0%,100%{opacity:1}50%{opacity:0.6}}`}</style>
    )}
    <div style={{
      position: 'absolute',
      transform: `translate(${vx}px, ${vy}px) scale(${vscale})`,
      transformOrigin: '0 0',
      width: totalW,
      height: totalH,
    }}>
    {/* SVG: relationship lines */}
    <div style={{ position: 'relative', width: totalW, height: totalH }}>
      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: totalW, height: totalH, overflow: 'visible' }}
        onClick={() => {
          if (connectMode) {
            setConnectMode(false);
            setConnectSourceId(null);
          }
        }}
      >
        {edgeLayouts.map(layout => {
          const { rel, p1, p2, drawP1, drawP2, bridges } = layout;
          const reactionEdge = reactionEdgeById.get(rel.id);
          const state = getUmlRelationEdgeState(
            selectedRelId === rel.id,
            hoveredRelId === rel.id,
          );

          return (
            <UMLRelationLine
              key={rel.id}
              rel={rel}
              p1={p1}
              p2={p2}
              drawP1={drawP1}
              drawP2={drawP2}
              bridges={bridges}
              state={state}
              reactionEdge={reactionEdge}
            />
          );
        })}
      </svg>

      {/* Model group wrapper rects */}
      {modelGroups.map(g => {
        const sx = g.minX + offsetX;
        const sy = g.minY + offsetY;
        const canRemove = interactive && removableModelNames.has(g.name) && onRemoveAdditionalModel;
        return (
          <div
            key={g.name}
            style={{
              position: 'absolute',
              left: sx,
              top: sy,
              width: g.width,
              height: g.height,
              border: `2px solid ${g.color}`,
              borderRadius: 10,
              background: g.fill,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            <div
              data-wrapper-header
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 22,
                background: g.color,
                borderRadius: '8px 8px 0 0',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 8,
                paddingRight: canRemove ? 4 : 8,
                fontSize: 11,
                fontWeight: 700,
                color: '#fff',
                letterSpacing: 0.3,
                pointerEvents: 'auto',
              }}
            >
              <button
                type="button"
                onMouseDown={interactive ? (e) => handleWrapperDragStart(e, g.name) : undefined}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#fff',
                  letterSpacing: 0.3,
                  cursor: interactive ? 'grab' : 'default',
                  textAlign: 'left',
                }}
              >
                {g.name}
              </button>
              {canRemove && (
                <button
                  type="button"
                  title={`Remove ${g.name}`}
                  aria-label={`Remove ${g.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveAdditionalModel?.(g.name);
                  }}
                  style={{
                    width: 18,
                    height: 18,
                    border: 'none',
                    borderRadius: 4,
                    background: 'rgba(255,255,255,0.18)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  &times;
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Class boxes */}
      {allClasses.map(cls => {
        const isAdditional = cls.id.startsWith('addl-');
        return (
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
          reactionsMode={reactionsMode === 'reactions'}
          onReactionPortMouseDown={handleReactionPortMouseDown}
          onSelect={() => handleClassSelect(cls.id)}
          onDragStart={() => { dragHistorySavedRef.current = false; }}
          onMove={isAdditional ? moveAdditionalClass : moveClass}
          onDragEnd={isAdditional ? () => {} : finishClassDrag}
          onStartEditName={() => {
            if (!interactive || isAdditional) return;
            flushPendingEdit();
            setEdit({ classId: cls.id, kind: 'name', val: cls.name });
          }}
          onSaveName={name => saveName(cls.id, name)}
          onStartEditAttr={attrId => {
            if (!interactive || isAdditional) return;
            flushPendingEdit();
            const a = cls.attributes.find(x => x.id === attrId)!;
            setEdit({
              classId: cls.id,
              kind: 'attr',
              attrId,
              name: a.name,
              type: normalizeAttributeTypeDisplay(a.type),
              visibility: a.visibility,
            });
          }}
          onSaveAttr={(attrId, n, t, v) => saveAttr(cls.id, attrId, n, t, v)}
          onCancelEdit={() => setEdit(null)}
          onAddAttr={() => interactive && !isAdditional && addAttr(cls.id)}
          onDeleteAttr={attrId => deleteAttr(cls.id, attrId)}
          onStartEditOp={opId => {
            if (!interactive || isAdditional) return;
            flushPendingEdit();
            const o = cls.operations.find(x => x.id === opId)!;
            setEdit({
              classId: cls.id,
              kind: 'op',
              opId,
              name: o.name,
              returnType: normalizeOperationReturnType(o.returnType),
              visibility: o.visibility,
            });
          }}
          onSaveOp={(opId, n, rt, v) => saveOp(cls.id, opId, n, rt, v)}
          onAddOp={() => interactive && !isAdditional && addOp(cls.id)}
          onDeleteOp={opId => deleteOp(cls.id, opId)}
          onDelete={() => !isAdditional && deleteClass(cls.id)}
          onEditChange={setEdit}
        />
        );
      })}

      {reactionDrag && (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: totalW,
            height: totalH,
            overflow: 'visible',
            zIndex: 8,
            pointerEvents: 'none',
          }}
        >
          <line
            x1={reactionDrag.startX}
            y1={reactionDrag.startY}
            x2={reactionDrag.cursorX}
            y2={reactionDrag.cursorY}
            stroke="#a855f7"
            strokeWidth={2.5}
            strokeDasharray="8 5"
            opacity={0.9}
          />
          <circle
            cx={reactionDrag.cursorX}
            cy={reactionDrag.cursorY}
            r={5}
            fill="#a855f7"
            stroke="#fff"
            strokeWidth={2}
          />
        </svg>
      )}

      {/* Hit targets above class boxes — connections stay clickable */}
      <svg
        data-rel-hit-layer
        style={{ position: 'absolute', top: 0, left: 0, width: totalW, height: totalH, overflow: 'visible', zIndex: 6, pointerEvents: 'none' }}
      >
        {edgeLayouts.map(layout => {
          const { rel, drawP1, drawP2, bridges } = layout;
          return (
            <UMLRelationHitTarget
              key={`hit-${rel.id}`}
              relId={rel.id}
              drawP1={drawP1}
              drawP2={drawP2}
              bridges={bridges}
              onRelClick={e => handleRelationshipClick(rel.id, e)}
              onMouseEnter={() => setHoveredRelId(rel.id)}
              onMouseLeave={() => setHoveredRelId(null)}
            />
          );
        })}
      </svg>

      {/* Multiplicity badges above class boxes so labels stay visible */}
      <svg
        data-mult-badge-layer
        style={{ position: 'absolute', top: 0, left: 0, width: totalW, height: totalH, overflow: 'visible', zIndex: 22, pointerEvents: 'none' }}
      >
        {multiplicityBadges.map(badge => {
          const state = getUmlRelationEdgeState(
            selectedRelId === badge.relId,
            hoveredRelId === badge.relId,
          );
          return (
            <UMLMultiplicityBadge
              key={badge.key}
              badge={badge}
              strokeColor={UML_RELATION_EDGE_COLORS[state]}
            />
          );
        })}
      </svg>

      {/* Direction markers above class boxes */}
      {edgeLayouts.map(layout => {
        const { rel, p1, p2 } = layout;
        const reactionEdge = reactionEdgeById.get(rel.id);
        const state = getUmlRelationEdgeState(
          selectedRelId === rel.id,
          hoveredRelId === rel.id,
        );
        const color = reactionEdge
          ? UML_REACTION_EDGE_COLORS[state]
          : UML_RELATION_EDGE_COLORS[state];

        return (
          <UMLRelationDirectionMarker
            key={`${rel.id}-direction`}
            rel={rel}
            reactionEdge={reactionEdge}
            // Anchor at the true class-box edge (p1/p2), not the inset line endpoints
            // (drawP1/drawP2) used only for the line stroke -- otherwise the marker floats
            // in the gap left for it instead of touching the box it belongs to.
            lineStart={p1}
            lineEnd={p2}
            color={color}
            onRelClick={e => handleRelationshipClick(rel.id, e)}
            onMouseEnter={() => setHoveredRelId(rel.id)}
            onMouseLeave={() => setHoveredRelId(null)}
          />
        );
      })}
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
          {getConnectModeHint(connectSourceId, additionalModels.length > 0)}
        </div>
      )}
      {interactive && reactionsMode === 'reactions' && !connectMode && (
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
            background: '#faf5ff',
            border: '1px solid #e9d5ff',
            color: '#6b21a8',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: UML.fontSans,
            boxShadow: '0 4px 14px rgba(168,85,247,0.15)',
            pointerEvents: 'none',
            maxWidth: 'min(420px, calc(100vw - 320px))',
            textAlign: 'center',
            lineHeight: 1.35,
          }}
        >
          {reactionDrag
            ? 'Release on another class dot to create a reaction'
            : 'Drag from a purple dot to connect classes across models'}
        </div>
      )}
      {interactive && (
        <UMLDiagramToolbar
          reactionsMode={reactionsMode}
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
          parentId={getInheritanceParentId(
            relationships,
            selectedClass.id,
          )}
          onUpdate={patch => updateClass(selectedClass.id, patch)}
          onSetParent={parentId => setInheritanceParent(selectedClass.id, parentId)}
          onDelete={() => deleteClass(selectedClass.id)}
          onClose={() => setSelectedClassId(null)}
        />
      )}
      {interactive && editingReaction && (
        <ReactionConfigPopup
          edge={editingReaction}
          onUpdate={config => updateReactionConfig(editingReaction.id, config)}
          onDelete={() => deleteReaction(editingReaction.id)}
          onClose={() => setEditingReactionId(null)}
        />
      )}
      {interactive && (
        <ReactionEditorModal
          state={reactionEditorState}
          onClose={handleCloseReactionEditor}
          onSave={handleSaveReactionCode}
          onDelete={handleDeleteReactionFromEditor}
          vsumId={vsumId}
        />
      )}
      {interactive && selectedRel && !selectedRelIsReaction && reactionsMode !== 'reactions' && (
        <RelationshipEditPanel
          rel={selectedRel}
          classes={allClasses}
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
        classes={allClasses}
        relationships={rels}
        modelGroups={modelGroups}
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
