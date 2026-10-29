import { create } from 'zustand';
import { APPROACHES, DEFAULT_APPROACH, type ApproachSettingsMap } from '../utils/semanticOverlap/approaches/registry';
import type { ApproachId } from '../utils/semanticOverlap/approaches/types';
import { randomSeed } from '../utils/semanticOverlap/search/rng';
import type { AnalysisSettings, OverlapResult, Progress } from '../utils/semanticOverlap/types';

export type OverlapStatus = 'idle' | 'ready' | 'loading' | 'running' | 'done' | 'failed';
export type OverlapTab = 'diagram' | 'heatmap';

/**
 * Default display threshold: show every correspondence the search proposed. The null score already
 * decides what counts as matched, so a second cut-off would hide matches the summary counts.
 */
export const DEFAULT_MIN_SCORE = 0;

interface SemanticOverlapState {
  status: OverlapStatus;
  sourceId: number | null;
  targetId: number | null;
  approach: ApproachId;
  /** Settings per approach; switching keeps each approach's own settings. */
  settingsByApproach: ApproachSettingsMap;
  /** Settings of the active approach (`settingsByApproach[approach]`). */
  settings: AnalysisSettings;
  /** Id of the current run; messages of other runs are ignored. */
  runId: string | null;
  progress: Progress | null;
  result: OverlapResult | null;
  error: string | null;
  activeTab: OverlapTab;
  selectedCorrespondenceId: string | null;
  hoveredCell: { row: number; column: number } | null;
  /** Display threshold only — never part of the settings or the result. */
  minScore: number;
  collapsedUnmatched: boolean;
  /** Class correspondences whose attribute/reference correspondences are shown (diagram and list). */
  expandedCorrespondenceIds: string[];

  setSource(id: number | null): void;
  setTarget(id: number | null): void;
  swap(): void;
  /** Patches the active approach's settings. */
  updateSettings(patch: Partial<ApproachSettingsMap[ApproachId]>): void;
  setApproach(approach: ApproachId): void;
  beginLoading(runId: string): void;
  beginRunning(runId: string): void;
  updateProgress(runId: string, progress: Progress): void;
  finishRun(runId: string, result: OverlapResult): void;
  failRun(runId: string, message: string): void;
  cancelRun(): void;
  setActiveTab(tab: OverlapTab): void;
  selectCorrespondence(id: string | null): void;
  setHoveredCell(cell: { row: number; column: number } | null): void;
  setMinScore(value: number): void;
  setCollapsedUnmatched(value: boolean): void;
  toggleExpanded(correspondenceId: string): void;
  reset(): void;
}

const pairStatus = (sourceId: number | null, targetId: number | null): OverlapStatus =>
  sourceId !== null && targetId !== null ? 'ready' : 'idle';

const initialSettings = (): ApproachSettingsMap => {
  const seed = randomSeed();
  return {
    paper: { ...APPROACHES.paper.defaultSettings(), seed },
    improved: { ...APPROACHES.improved.defaultSettings(), seed },
  };
};

const initialState = () => {
  const settingsByApproach = initialSettings();
  return {
    status: 'idle' as OverlapStatus,
    sourceId: null,
    targetId: null,
    approach: DEFAULT_APPROACH,
    settingsByApproach,
    settings: settingsByApproach[DEFAULT_APPROACH] as AnalysisSettings,
    runId: null,
    progress: null,
    result: null,
    error: null,
    activeTab: 'diagram' as OverlapTab,
    selectedCorrespondenceId: null,
    hoveredCell: null,
    minScore: DEFAULT_MIN_SCORE,
    collapsedUnmatched: false,
    expandedCorrespondenceIds: [] as string[],
  };
};

/** A new selection invalidates the running analysis and the previous result. */
const selectionChanged = (sourceId: number | null, targetId: number | null) => ({
  sourceId,
  targetId,
  status: pairStatus(sourceId, targetId),
  runId: null,
  progress: null,
  result: null,
  error: null,
  selectedCorrespondenceId: null,
  hoveredCell: null,
  expandedCorrespondenceIds: [],
});

export const useSemanticOverlapStore = create<SemanticOverlapState>((set, get) => ({
  ...initialState(),

  setSource: id => set(selectionChanged(id, get().targetId)),
  setTarget: id => set(selectionChanged(get().sourceId, id)),
  swap: () => set(selectionChanged(get().targetId, get().sourceId)),
  updateSettings: patch => set(state => {
    const settings = { ...state.settingsByApproach[state.approach], ...patch };
    return {
      settingsByApproach: { ...state.settingsByApproach, [state.approach]: settings },
      settings,
      // The result stays visible with the settings it was computed with; a new run is needed.
      status: state.status === 'done' ? pairStatus(state.sourceId, state.targetId) : state.status,
    };
  }),
  setApproach: approach => set(state => {
    if (approach === state.approach) return {};
    // Both approaches use the same seed, so a comparison on the same pair is reproducible.
    const settings = { ...state.settingsByApproach[approach], seed: state.settings.seed };
    return {
      approach,
      settingsByApproach: { ...state.settingsByApproach, [approach]: settings },
      settings,
      status: state.status === 'done' ? pairStatus(state.sourceId, state.targetId) : state.status,
    };
  }),

  beginLoading: runId => set({
    runId, status: 'loading', progress: { phase: 'loading', fraction: 0 }, error: null,
  }),
  beginRunning: runId => {
    if (get().runId === runId) set({ status: 'running' });
  },
  updateProgress: (runId, progress) => {
    if (get().runId === runId) set({ progress });
  },
  finishRun: (runId, result) => {
    if (get().runId !== runId) return;
    set({
      status: 'done', result, runId: null, progress: null,
      selectedCorrespondenceId: null, hoveredCell: null, expandedCorrespondenceIds: [],
    });
  },
  failRun: (runId, message) => {
    if (get().runId !== runId) return;
    set({ status: 'failed', error: message, runId: null, progress: null });
  },
  cancelRun: () => set(state => ({
    runId: null,
    progress: null,
    status: state.result ? 'done' : pairStatus(state.sourceId, state.targetId),
  })),

  setActiveTab: activeTab => set({ activeTab }),
  selectCorrespondence: selectedCorrespondenceId => set({ selectedCorrespondenceId }),
  setHoveredCell: hoveredCell => set({ hoveredCell }),
  setMinScore: minScore => set({ minScore: Math.min(1, Math.max(0, minScore)) }),
  setCollapsedUnmatched: collapsedUnmatched => set({ collapsedUnmatched }),
  toggleExpanded: id => set(state => ({
    expandedCorrespondenceIds: state.expandedCorrespondenceIds.includes(id)
      ? state.expandedCorrespondenceIds.filter(other => other !== id)
      : [...state.expandedCorrespondenceIds, id],
  })),
  reset: () => set(initialState()),
}));
