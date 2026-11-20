import { useEffect, useRef, useState } from 'react';
import config from '../config/environment';
import { getVsumDetailsStore, hasVsumDetailsStore } from '../store/VsumDetails';
import { loadReactionLayout, saveReactionLayout, type ReactionLayoutMap } from '../utils/reactionLayoutStorage';
import { createCanvasPort, type CanvasHandle, type ResolvedMetaModel } from './canvasPort';
import { CanvasSync } from './canvasSync';
import type { ProjectDocument } from './projectDocument';
import type { ConnectionSnapshot, createProjectConnection } from './projectConnection';
import { useProjectConnection } from './useProjectConnection';

/** How long the project gets to load into the shared document before collaboration counts as unavailable. */
export const DEFAULT_UNAVAILABLE_AFTER_MS = 10_000;

export interface UseCanvasCollaborationOptions {
  projectId: number | undefined;
  /** The project is loaded into the canvas from the backend. */
  canvasLoaded: boolean;
  /** The open tab; the canvas is a new one for every tab. */
  instanceId: string | null;
  /** The canvas, or `null` if it isn't there. */
  getCanvas: () => CanvasHandle | null;
  /** Finds a metamodel another user added and loads its ecore file. */
  resolveMetaModel: (sourceId: number) => Promise<ResolvedMetaModel | null>;
  /** The collaboration server's address. Defaults to `REACT_APP_COLLABORATION_URL`. */
  serverUrl?: string | undefined;
  /** Defaults to the real connection; tests replace it. */
  createConnection?: typeof createProjectConnection;
  /** Defaults to {@link DEFAULT_UNAVAILABLE_AFTER_MS}. */
  unavailableAfterMs?: number;
}

export interface CollaborationState {
  /** Whether there is a collaboration server at all. Without one, the canvas works on its own. */
  enabled: boolean;
  connection: ConnectionSnapshot | null;
  /** Set once the canvas shows the project as the shared document has it. */
  sync: CanvasSync | null;
  /**
   * The canvas must wait, because it doesn't show the shared project yet and changes made now could
   * be taken away again.
   */
  holding: boolean;
  /**
   * The project could not be joined, because the server can't be reached or doesn't take the
   * connection. The project can be looked at, but its changes couldn't be saved.
   */
  unavailable: boolean;
}

/**
 * Brings live collaboration to the canvas of the open project: connects to the project's shared
 * document, and once the project is loaded into the canvas, makes the canvas show the document and
 * writes the user's changes into it.
 */
export function useCanvasCollaboration(options: UseCanvasCollaborationOptions): CollaborationState {
  const { projectId, canvasLoaded, instanceId, createConnection, unavailableAfterMs = DEFAULT_UNAVAILABLE_AFTER_MS } = options;
  const serverUrl = 'serverUrl' in options ? options.serverUrl : config.collaborationUrl;
  const enabled = serverUrl !== undefined;
  const connection = useProjectConnection(enabled && projectId !== undefined ? projectId : null, {
    serverUrl,
    createConnection,
  });

  // The document that was loaded from the server. It stays the one the canvas follows when the
  // connection drops and comes back, and is replaced when the connection starts again with a new one.
  const [loaded, setLoaded] = useState<ProjectDocument | null>(null);
  useEffect(() => {
    if (connection === null) {
      setLoaded(null);
    } else if (connection.synced) {
      setLoaded(connection.project);
    }
  }, [connection, connection?.synced, connection?.project]);
  const document = loaded !== null && connection?.project === loaded ? loaded : null;

  const latest = useRef(options);
  latest.current = options;

  const [sync, setSync] = useState<CanvasSync | null>(null);
  useEffect(() => {
    if (!enabled || projectId === undefined || document === null || !canvasLoaded) {
      return undefined;
    }
    const canvasSync = new CanvasSync(
      document,
      createCanvasPort({
        getCanvas: () => latest.current.getCanvas(),
        resolveMetaModel: (sourceId) => latest.current.resolveMetaModel(sourceId),
        loadReactionLayout: () => loadReactionLayout(projectId),
        saveReactionLayout: (layout) => saveReactionLayout(projectId, layout as ReactionLayoutMap),
        updateRelations: (update) => {
          if (!hasVsumDetailsStore(projectId)) return;
          const store = getVsumDetailsStore(projectId);
          const current = store.getState().metaModelsRelation;
          const next = update(current);
          if (next !== current) store.setState({ metaModelsRelation: next });
        },
      }),
    );
    let cancelled = false;
    canvasSync.start().then(
      () => {
        if (!cancelled) setSync(canvasSync);
      },
      (error: unknown) => console.error('Showing the shared project on the canvas failed:', error),
    );
    return () => {
      cancelled = true;
      canvasSync.stop();
      setSync(null);
    };
  }, [enabled, projectId, document, canvasLoaded, instanceId]);

  const [timedOut, setTimedOut] = useState(false);
  const waiting = enabled && canvasLoaded && sync === null;
  useEffect(() => {
    if (!waiting) {
      setTimedOut(false);
      return undefined;
    }
    const timer = globalThis.setTimeout(() => setTimedOut(true), unavailableAfterMs);
    return () => globalThis.clearTimeout(timer);
  }, [waiting, unavailableAfterMs, projectId, instanceId]);

  const unavailable = enabled && sync === null && (timedOut || (connection?.failure ?? null) !== null);
  return { enabled, connection, sync, holding: enabled && sync === null && !unavailable, unavailable };
}
