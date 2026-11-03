/** Part of the VSUM a build problem was found in. */
export type BuildProblemSource =
  | 'METAMODEL'
  | 'REACTIONS'
  | 'CONSTRAINTS'
  | 'VIEWS'
  | 'INFRASTRUCTURE'
  | 'INTERNAL';

/** One problem the backend reports for a failed VSUM build or export. */
export interface BuildProblem {
  source: BuildProblemSource;
  /** File name as uploaded. */
  file?: string;
  /** Platform file id (metamodel or reaction file) when the backend could resolve it. */
  fileId?: number;
  /** 1-based line in the uploaded file. */
  line?: number;
  /** 1-based column in the uploaded file. */
  column?: number;
  message: string;
  /** Source line plus a caret line, meant to be shown in a monospace font. */
  excerpt?: string;
  /** What to change to fix the problem. */
  hint?: string;
  /** Number of further errors the backend left out because they follow from this one. */
  hiddenFollowUpErrors?: number;
}

/**
 * Error codes of failed VSUM builds and exports known to this UI. Response fields stay typed as
 * `string` so codes the backend adds later still pass through.
 */
export type VsumBuildErrorCode =
  | 'VSUM_INPUT_ERROR'
  | 'VSUM_METAMODEL_ERROR'
  | 'VSUM_REACTIONS_ERROR'
  | 'VSUM_BUILD_FAILED'
  | 'VSUM_BUILD_UNAVAILABLE'
  | 'VSUM_INTERNAL_ERROR'
  | 'VSUM_BUILD_TIMEOUT';

/** Error body of the synchronous VSUM endpoints (exports, build check). */
export interface VsumBuildErrorResponse {
  timestamp?: string;
  error?: string;
  message?: string;
  path?: string;
  errorCode?: string;
  problems?: BuildProblem[];
}

export type VsumBuildStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

/** State of one asynchronous VSUM build (`/api/v1/vsums/{id}/builds`). */
export interface VsumBuildResponse {
  id: number;
  vsumId: number;
  status: VsumBuildStatus;
  fingerprint?: string;
  forced?: boolean;
  /** Whether the JAR of this build can still be downloaded. */
  artifactAvailable?: boolean;
  errorMessage?: string | null;
  errorCode?: string;
  problems?: BuildProblem[];
  requestedBy?: string;
  createdAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
}

/** A failed build or export, reduced to what the UI shows. */
export interface BuildFailure {
  errorCode?: string;
  /** Plain-text message; shown when there are no structured problems. */
  message: string;
  problems: BuildProblem[];
}
