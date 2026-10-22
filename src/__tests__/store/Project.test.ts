import { useProjectStore } from '../../store/Project';

describe('useProjectStore', () => {
  afterEach(() => {
    useProjectStore.getState().setActiveId(null);
  });

  it('resets mode and reaction files when switching project', () => {
    useProjectStore.getState().setActiveId(1);
    useProjectStore.getState().setMode('reactions');
    useProjectStore.getState().addReactionFile({ fromModel: 'a', toModel: 'b', id: 9 });

    useProjectStore.getState().setActiveId(2);

    const state = useProjectStore.getState();
    expect(state.activeId).toBe(2);
    expect(state.mode).toBe('workspace');
    expect(state.reactionFiles.size).toBe(0);
    expect(state.expandedMetaModels).toBeNull();
  });
});
