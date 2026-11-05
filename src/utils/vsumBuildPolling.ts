import { apiService } from '../services/api';
import type { VsumBuildResponse } from '../types/vsumBuild';

export interface WaitForVsumBuildOptions {
  /** Delay between two status requests. */
  intervalMs?: number;
  /** Give up after this many status requests. */
  maxPolls?: number;
  /** Called with every state the build is seen in, including the final one. */
  onUpdate?: (build: VsumBuildResponse) => void;
  /** Replaceable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_INTERVAL_MS = 2000;
const DEFAULT_MAX_POLLS = 900;

const defaultSleep = (ms: number) => new Promise<void>(resolve => {
  globalThis.setTimeout(resolve, ms);
});

const BUILD_TIMEOUT_MESSAGE = 'The build did not finish in time. Check its status again later.';

export function isTerminalBuild(build: VsumBuildResponse): boolean {
  return build.status === 'SUCCEEDED' || build.status === 'FAILED';
}

async function pollUntilTerminal(
  vsumId: number | string,
  current: VsumBuildResponse,
  pollsLeft: number,
  intervalMs: number,
  onUpdate: WaitForVsumBuildOptions['onUpdate'],
  sleep: (ms: number) => Promise<void>,
): Promise<VsumBuildResponse> {
  onUpdate?.(current);
  if (isTerminalBuild(current)) return current;
  if (pollsLeft <= 0) throw new Error(BUILD_TIMEOUT_MESSAGE);
  await sleep(intervalMs);
  const response = await apiService.getVsumBuild(vsumId, current.id);
  return pollUntilTerminal(vsumId, response.data, pollsLeft - 1, intervalMs, onUpdate, sleep);
}

/**
 * Polls `GET /api/v1/vsums/{id}/builds/{buildId}` until the build has succeeded or failed and
 * returns its final state. A failed build carries `errorCode` and `problems`; turn it into a
 * failure with `buildFailureFromBuildResponse`.
 */
export async function waitForVsumBuild(
  vsumId: number | string,
  build: VsumBuildResponse,
  options: WaitForVsumBuildOptions = {},
): Promise<VsumBuildResponse> {
  const {
    intervalMs = DEFAULT_INTERVAL_MS,
    maxPolls = DEFAULT_MAX_POLLS,
    onUpdate,
    sleep = defaultSleep,
  } = options;

  return pollUntilTerminal(vsumId, build, maxPolls, intervalMs, onUpdate, sleep);
}
