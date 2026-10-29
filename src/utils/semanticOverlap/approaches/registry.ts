import type { ImprovedSettings } from '../improved/settings';
import type { AnalysisSettings } from '../types';
import { improvedApproach } from './improvedApproach';
import { paperApproach } from './paperApproach';
import type { Approach, ApproachId } from './types';

export interface ApproachSettingsMap {
  paper: AnalysisSettings;
  improved: ImprovedSettings;
}

export const APPROACHES: { [K in ApproachId]: Approach<ApproachSettingsMap[K]> } = {
  paper: paperApproach,
  improved: improvedApproach,
};

export const APPROACH_IDS: readonly ApproachId[] = ['paper', 'improved'];

/**
 * Approach preselected in the view: the improved approach, since it meets the Brake ↔ BOM targets
 * without losing on the paper's benchmark.
 */
export const DEFAULT_APPROACH: ApproachId = 'improved';

/** Looks up an approach for settings of unknown shape (worker, view). */
export const approachOf = (id: ApproachId) => APPROACHES[id] as unknown as Approach<AnalysisSettings>;
