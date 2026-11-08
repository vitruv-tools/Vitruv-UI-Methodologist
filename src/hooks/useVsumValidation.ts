import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { BuildProblem } from '../types/vsumBuild';

export const VALIDATION_POLL_INTERVAL_MS = 5000;

/**
 * Polls the validation result of a project while `enabled`. A failed request keeps the last result
 * and shows nothing; the next poll simply tries again.
 */
export function useVsumValidation(projectId: number | undefined, enabled: boolean): BuildProblem[] {
  const [state, setState] = useState<{ projectId: number; problems: BuildProblem[] } | null>(null);

  useEffect(() => {
    if (!enabled || projectId == null) return undefined;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await apiService.getVsumValidation(projectId);
        if (cancelled) return;
        const data = res?.data;
        if (!data) return;
        const problems = data.valid ? EMPTY : data.problems ?? EMPTY;
        // Keep the previous array when nothing changed so open dialogs don't reset on every poll.
        setState(prev => (
          prev?.projectId === projectId && JSON.stringify(prev.problems) === JSON.stringify(problems)
            ? prev
            : { projectId, problems }
        ));
      } catch {
        // Keep the last result; polling errors are not shown.
      }
    };

    void poll();
    const timer = setInterval(() => { void poll(); }, VALIDATION_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [projectId, enabled]);

  if (!enabled || !state || state.projectId !== projectId) return EMPTY;
  return state.problems;
}

const EMPTY: BuildProblem[] = [];
