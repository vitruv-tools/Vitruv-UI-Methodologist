import { act, renderHook } from '@testing-library/react';
import { useOverlapResultViewState } from '../../hooks/useOverlapResultViewState';
import { DEFAULT_MIN_SCORE } from '../../store/SemanticOverlap';

describe('useOverlapResultViewState', () => {
  it('starts like the home page view', () => {
    const { result } = renderHook(() => useOverlapResultViewState('r1'));
    expect(result.current.view).toEqual({
      activeTab: 'diagram',
      minScore: DEFAULT_MIN_SCORE,
      selectedCorrespondenceId: null,
      collapsedUnmatched: false,
      expandedCorrespondenceIds: [],
      selectedAlternative: null,
    });
  });

  it('toggles expanded rows and clears selection and expansion when the alternative changes', () => {
    const { result } = renderHook(() => useOverlapResultViewState('r1'));
    act(() => result.current.actions.toggleExpanded('c1'));
    act(() => result.current.actions.toggleExpanded('c2'));
    act(() => result.current.actions.toggleExpanded('c1'));
    expect(result.current.view.expandedCorrespondenceIds).toEqual(['c2']);
    act(() => result.current.actions.selectCorrespondence('c2'));
    act(() => result.current.actions.selectAlternative(1));
    expect(result.current.view).toMatchObject({ selectedAlternative: 1, selectedCorrespondenceId: null, expandedCorrespondenceIds: [] });
  });

  it('starts over for another result', () => {
    const { result, rerender } = renderHook(({ id }) => useOverlapResultViewState(id), { initialProps: { id: 'r1' } });
    act(() => result.current.actions.setActiveTab('heatmap'));
    act(() => result.current.actions.setCollapsedUnmatched(true));
    rerender({ id: 'r2' });
    expect(result.current.view).toMatchObject({ activeTab: 'diagram', collapsedUnmatched: false });
  });
});
