import { useProjectSemanticOverlapStore } from '../../store/ProjectSemanticOverlap';
import { direction, done, overview, pair } from '../utils/semanticOverlap/overviewHelpers';

const store = () => useProjectSemanticOverlapStore.getState();

describe('ProjectSemanticOverlap store', () => {
  beforeEach(() => useProjectSemanticOverlapStore.setState({ overviews: {} }));

  it('keeps one overview per project', () => {
    store().begin(7, overview({ vsumId: 7 }));
    store().begin(8, overview({ vsumId: 8, status: 'running' }));
    expect(Object.keys(store().overviews)).toEqual(['7', '8']);
    store().clear(7);
    expect(Object.keys(store().overviews)).toEqual(['8']);
  });

  it('updates one direction of one pair', () => {
    const pairs = [pair('A', 'B', direction('pending'), direction('pending')), pair('A', 'C', direction('pending'), direction('pending'))];
    store().begin(7, overview({ pairs }));
    store().updateDirection(7, 'mm:A|mm:C', 'backward', { state: 'running' });
    const [ab, ac] = store().overviews[7].pairs;
    expect(ab).toBe(pairs[0]);
    expect(ac.backward.state).toBe('running');
    expect(ac.forward.state).toBe('pending');
  });

  it('records progress, outcome and the outdated flag', () => {
    store().begin(7, overview({ status: 'running' }));
    store().setProgress(7, { done: 2, total: 6, current: ['A ↔ B'] });
    store().finish(7, 'cancelled', '2026-11-03T10:00:00.000Z');
    store().setOutdated(7, true);
    expect(store().overviews[7]).toMatchObject({
      progress: { done: 2, total: 6, current: ['A ↔ B'] },
      status: 'cancelled',
      finishedAt: '2026-11-03T10:00:00.000Z',
      outdated: true,
    });
  });

  it('opens a pair in the forward direction and remembers where the overview was scrolled to', () => {
    store().begin(7, overview({ pairs: [pair('A', 'B', done(10), done(20))] }));
    store().setDetailDirection(7, 'backward');
    store().openPair(7, 'mm:A|mm:B', 240);
    expect(store().overviews[7]).toMatchObject({ selectedPairId: 'mm:A|mm:B', detailDirection: 'forward', listScrollTop: 240 });
    store().setDetailDirection(7, 'backward');
    expect(store().overviews[7].detailDirection).toBe('backward');
    store().closePair(7);
    expect(store().overviews[7]).toMatchObject({ selectedPairId: null, listScrollTop: 240 });
  });

  it('ignores actions for a project without an overview', () => {
    store().setProgress(99, { done: 1, total: 1, current: [] });
    store().openPair(99, 'x', 0);
    expect(store().overviews).toEqual({});
  });
});
