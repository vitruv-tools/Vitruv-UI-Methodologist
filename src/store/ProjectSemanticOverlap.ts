import { create } from 'zustand';
import type {
  DirectionResult,
  OverlapOverview,
  OverviewProgress,
  PairDirection,
} from '../utils/semanticOverlap/overviewTypes';

interface ProjectSemanticOverlapState {
  /** Overview per project (V-SUM id), kept for the session. */
  overviews: Record<number, OverlapOverview>;
  begin(vsumId: number, overview: OverlapOverview): void;
  updateDirection(vsumId: number, pairId: string, direction: PairDirection, patch: Partial<DirectionResult>): void;
  setProgress(vsumId: number, progress: OverviewProgress): void;
  finish(vsumId: number, status: 'done' | 'cancelled', finishedAt: string): void;
  setOutdated(vsumId: number, outdated: boolean): void;
  openPair(vsumId: number, pairId: string, listScrollTop: number): void;
  closePair(vsumId: number): void;
  setDetailDirection(vsumId: number, direction: PairDirection): void;
  clear(vsumId: number): void;
}

type Overviews = Record<number, OverlapOverview>;

/** Applies `change` to the overview of `vsumId`; unknown projects are left alone. */
const patchOverview = (overviews: Overviews, vsumId: number, change: (overview: OverlapOverview) => Partial<OverlapOverview>) => {
  const overview = overviews[vsumId];
  if (!overview) return {};
  return { overviews: { ...overviews, [vsumId]: { ...overview, ...change(overview) } } };
};

export const useProjectSemanticOverlapStore = create<ProjectSemanticOverlapState>(set => ({
  overviews: {},
  begin: (vsumId, overview) => set(state => ({ overviews: { ...state.overviews, [vsumId]: overview } })),
  updateDirection: (vsumId, pairId, direction, patch) => set(state => patchOverview(state.overviews, vsumId, overview => ({
    pairs: overview.pairs.map(pair => (pair.id === pairId ? { ...pair, [direction]: { ...pair[direction], ...patch } } : pair)),
  }))),
  setProgress: (vsumId, progress) => set(state => patchOverview(state.overviews, vsumId, () => ({ progress }))),
  finish: (vsumId, status, finishedAt) => set(state => patchOverview(state.overviews, vsumId, () => ({ status, finishedAt }))),
  setOutdated: (vsumId, outdated) => set(state => patchOverview(state.overviews, vsumId, () => ({ outdated }))),
  openPair: (vsumId, pairId, listScrollTop) => set(state => patchOverview(state.overviews, vsumId, () => ({
    selectedPairId: pairId, detailDirection: 'forward', listScrollTop,
  }))),
  closePair: vsumId => set(state => patchOverview(state.overviews, vsumId, () => ({ selectedPairId: null }))),
  setDetailDirection: (vsumId, direction) => set(state => patchOverview(state.overviews, vsumId, () => ({ detailDirection: direction }))),
  clear: vsumId => set(state => {
    const overviews = { ...state.overviews };
    delete overviews[vsumId];
    return { overviews };
  }),
}));
