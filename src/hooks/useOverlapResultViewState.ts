import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OverlapResultViewActions, OverlapResultViewState } from '../components/semanticOverlap/OverlapResultPanel';
import { DEFAULT_MIN_SCORE, type OverlapTab } from '../store/SemanticOverlap';

const initialViewState = (): OverlapResultViewState => ({
  activeTab: 'diagram',
  minScore: DEFAULT_MIN_SCORE,
  selectedCorrespondenceId: null,
  collapsedUnmatched: false,
  expandedCorrespondenceIds: [],
  selectedAlternative: null,
});

/**
 * View state of the result panel kept in the component, for results that are not the home page's
 * current result. Starts over whenever `resultId` changes.
 */
export function useOverlapResultViewState(resultId: string | null): {
  view: OverlapResultViewState;
  actions: OverlapResultViewActions;
} {
  const [view, setView] = useState<OverlapResultViewState>(initialViewState);

  useEffect(() => {
    setView(initialViewState());
  }, [resultId]);

  const patch = useCallback((change: Partial<OverlapResultViewState>) => setView(state => ({ ...state, ...change })), []);

  const actions = useMemo<OverlapResultViewActions>(() => ({
    setActiveTab: (activeTab: OverlapTab) => patch({ activeTab }),
    selectCorrespondence: selectedCorrespondenceId => patch({ selectedCorrespondenceId }),
    // The panel reports the focused heatmap cell; nothing outside the panel needs it here.
    setHoveredCell: () => undefined,
    setCollapsedUnmatched: collapsedUnmatched => patch({ collapsedUnmatched }),
    toggleExpanded: id => setView(state => ({
      ...state,
      expandedCorrespondenceIds: state.expandedCorrespondenceIds.includes(id)
        ? state.expandedCorrespondenceIds.filter(other => other !== id)
        : [...state.expandedCorrespondenceIds, id],
    })),
    // Correspondence ids repeat across alternatives, so selection and expansion start over.
    selectAlternative: selectedAlternative => patch({ selectedAlternative, selectedCorrespondenceId: null, expandedCorrespondenceIds: [] }),
  }), [patch]);

  return { view, actions };
}
