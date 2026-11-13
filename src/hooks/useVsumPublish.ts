import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService } from '../services/api';
import { buildFailureFromBuildResponse, buildFailureFromError } from '../utils/buildProblems';
import { waitForVsumBuild } from '../utils/vsumBuildPolling';
import type { BuildFailure, VsumVersionResponse } from '../types/vsumBuild';

export const PUBLISH_FAILED_TITLE = 'Publish failed';
export const PUBLISH_RUNNING_MESSAGE = 'A publish is already running';

interface UseVsumPublishOptions {
  readonly projectId: number | undefined;
  /** Whether the user may see versions at all; no requests are made otherwise. */
  readonly enabled: boolean;
  readonly onNotify: (message: string, type: 'info' | 'success' | 'error') => void;
  readonly onFailure: (failure: BuildFailure, title: string) => void;
}

export interface VsumPublish {
  /** Latest published version; null when nothing was published (or it is still loading). */
  readonly latestVersion: VsumVersionResponse | null;
  readonly publishing: boolean;
  readonly publish: () => Promise<void>;
}

/** Latest published version of a project and the action that publishes the next one. */
export function useVsumPublish({
  projectId,
  enabled,
  onNotify,
  onFailure,
}: UseVsumPublishOptions): VsumPublish {
  const [latest, setLatest] = useState<{ projectId: number; version: VsumVersionResponse | null } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const activeProjectRef = useRef(projectId);
  activeProjectRef.current = projectId;

  const refreshLatest = useCallback(async (id: number) => {
    try {
      const version = await apiService.getLatestVsumVersion(id);
      if (activeProjectRef.current === id) setLatest({ projectId: id, version });
    } catch {
      // Keep what is shown; the downloads stay as they were.
    }
  }, []);

  useEffect(() => {
    setPublishing(false);
    if (!enabled || projectId == null) return;
    void refreshLatest(projectId);
  }, [projectId, enabled, refreshLatest]);

  /** Problems go to the problems dialog; a failure without problems is a plain error message. */
  const reportFailure = useCallback((failure: BuildFailure) => {
    if (failure.problems.length > 0) onFailure(failure, PUBLISH_FAILED_TITLE);
    else onNotify(failure.message, 'error');
  }, [onFailure, onNotify]);

  const publish = useCallback(async () => {
    if (projectId == null || publishing) return;
    setPublishing(true);
    try {
      const started = await apiService.publishVsum(projectId);
      const build = await waitForVsumBuild(projectId, started.data);
      const failure = buildFailureFromBuildResponse(build, 'The publish failed.');
      if (failure) {
        reportFailure(failure);
        return;
      }
      const version = await apiService.getLatestVsumVersion(projectId);
      if (activeProjectRef.current === projectId) setLatest({ projectId, version });
      onNotify(version ? `Published v${version.number}` : 'Published', 'success');
    } catch (error: unknown) {
      if ((error as { status?: number } | null)?.status === 409) {
        onNotify(PUBLISH_RUNNING_MESSAGE, 'error');
        return;
      }
      reportFailure(buildFailureFromError(error, 'Publish failed.'));
    } finally {
      setPublishing(false);
    }
  }, [projectId, publishing, reportFailure, onNotify]);

  const latestVersion = latest && latest.projectId === projectId ? latest.version : null;
  return { latestVersion, publishing, publish };
}
