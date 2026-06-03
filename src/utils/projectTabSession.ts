import {
  CaptureEditorSessionRequest,
  ProjectEditorSession,
} from '../types/workspace';

const CAPTURE_TIMEOUT_MS = 2000;

const emptySession = (): ProjectEditorSession => ({
  nodes: [],
  edges: [],
  expandedMetaModelName: null,
  cachedWorkspaceSnapshot: null,
  documents: [],
  selectedFileBoxId: null,
});

/** Read the current editor state from MainLayout (canvas, documents, UML view). */
export function captureEditorSession(): Promise<ProjectEditorSession> {
  return new Promise((resolve) => {
    const timeout = globalThis.setTimeout(() => resolve(emptySession()), CAPTURE_TIMEOUT_MS);
    const detail: CaptureEditorSessionRequest = {
      resolve: (session) => {
        globalThis.clearTimeout(timeout);
        resolve(session);
      },
    };
    globalThis.dispatchEvent(
      new CustomEvent<CaptureEditorSessionRequest>('vitruv.captureEditorSession', { detail }),
    );
  });
}

/** Restore a previously captured editor state into MainLayout. */
export function restoreEditorSession(session: ProjectEditorSession): void {
  globalThis.dispatchEvent(
    new CustomEvent<ProjectEditorSession>('vitruv.restoreEditorSession', { detail: session }),
  );
}
