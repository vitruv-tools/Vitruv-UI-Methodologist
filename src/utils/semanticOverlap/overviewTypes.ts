import type { AnalysisSettings, MetamodelGraph, MetamodelRef, OverlapResult, VersionedId } from './types';

/** One distinct metamodel on a project's canvas, ready for the all-pairs overview. */
export interface ProjectMetamodel {
  /** De-duplication key of the canvas node (`mm:<id>`, `file:<id>`, `name:<file>`, `id:<node>`). */
  key: string;
  /** File name without `.ecore`. */
  name: string;
  ref: MetamodelRef;
  /** `null` when the file could not be read or has no classes. */
  graph: MetamodelGraph | null;
  error: string | null;
}

export type DirectionState = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

/** One direction (`from → to`) of a pair. */
export interface DirectionResult {
  state: DirectionState;
  result: OverlapResult | null;
  error: string | null;
  /** `<hash from>|<hash to>|<settings key>`: an unchanged key lets a re-run reuse the result. */
  cacheKey: string;
}

export type PairStatus = 'pending' | 'running' | 'done' | 'partial' | 'failed' | 'not-analysed';

/** An unordered pair of metamodels; `a` is the one that sorts first. */
export interface PairOverlap {
  /** `<key a>|<key b>` */
  id: string;
  a: string;
  b: string;
  /** a → b */
  forward: DirectionResult;
  /** b → a */
  backward: DirectionResult;
}

export type PairDirection = 'forward' | 'backward';

export interface OverviewProgress {
  /** Finished runs (two per pair). */
  done: number;
  total: number;
  /** Names ("A ↔ B") of the pairs being analysed right now. */
  current: string[];
}

export type OverviewStatus = 'idle' | 'running' | 'done' | 'cancelled';

/** All pair overlaps of one project, as computed in this session. */
export interface OverlapOverview {
  vsumId: number;
  status: OverviewStatus;
  approach: VersionedId;
  settings: AnalysisSettings;
  settingsKey: string;
  metamodels: { key: string; name: string; contentHash: string }[];
  pairs: PairOverlap[];
  progress: OverviewProgress;
  startedAt: string | null;
  finishedAt: string | null;
  outdated: boolean;
  /** Pair shown in the detail view; `null` shows the overview. */
  selectedPairId: string | null;
  detailDirection: PairDirection;
  /** Scroll position of the overview, restored when the detail is closed. */
  listScrollTop: number;
}

/** One cell of the symmetric metamodel × metamodel matrix. */
export interface MatrixCell {
  pairId: string | null;
  /** Higher overlap percentage of both directions; `null` on the diagonal and for pairs without a result. */
  value: number | null;
  forward: number | null;
  backward: number | null;
}
