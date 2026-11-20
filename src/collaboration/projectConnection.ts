import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { EPOCH, EPOCH_PARAM, OUTDATED_DOCUMENT_CLOSE_CODE, STATUS, WRITEBACK_ERROR } from './document';
import { ProjectDocument } from './projectDocument';

/** How long the client waits at most before it tries to connect again. */
export const DEFAULT_MAX_BACKOFF_MS = 10_000;

/**
 * Starting again with a new document is the answer to `4409`. If that happens more often than this
 * within {@link RESTART_WINDOW_MS}, something is wrong and the client gives up instead of looping.
 */
const MAX_RESTARTS = 3;
const RESTART_WINDOW_MS = 30_000;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

/** Why the connection stopped for good. */
export type ConnectionFailure =
  /** The server kept saying that the document is outdated. */
  | 'outdated'
  /** The server refused the connection in a way that connecting again can't change. */
  | 'rejected';

export interface ProjectConnectionOptions {
  /** WebSocket address of the collaboration server, e.g. `wss://host/collaboration`. */
  serverUrl: string;
  projectId: number;
  /**
   * The user's current access token. Called every time the client connects, so that a token that
   * was renewed meanwhile is used.
   */
  getToken: () => string | null;
  /**
   * Renews the token if it is about to expire. Awaited before the first connection and called when
   * a connection closes, so the next attempt has a valid token. A failure is ignored.
   */
  refreshToken?: () => Promise<unknown>;
  /** Defaults to the browser's `WebSocket`. */
  WebSocketPolyfill?: typeof WebSocket;
  /** Defaults to {@link DEFAULT_MAX_BACKOFF_MS}. */
  maxBackoffMs?: number;
}

/** What a view needs to know about the connection. A new object whenever something changes. */
export interface ConnectionSnapshot {
  status: ConnectionStatus;
  /** Whether the document has what the server has: the project is loaded into it. */
  synced: boolean;
  /** Why the server couldn't write the last changes back, `null` if it could. */
  writebackError: string | null;
  /**
   * The shared document. It is replaced when the connection starts again with a new document, which
   * is when {@link generation} changes. Everything built from the old one has to be built again.
   */
  project: ProjectDocument;
  generation: number;
  failure: ConnectionFailure | null;
}

export interface ProjectConnection {
  getSnapshot(): ConnectionSnapshot;
  /** Calls the listener whenever the snapshot changes; returns a function that stops that. */
  subscribe(listener: () => void): () => void;
  /** Closes the connection for good. */
  destroy(): void;
}

/**
 * The provider of one project's document. It builds the URL anew every time it connects:
 *
 * - with the current token, since a connection that is made again later may need a renewed one, and
 * - with the epoch of the document, if it has one. The server closes the connection with `4409` if
 *   the room was created again since, instead of taking the outdated document into it.
 */
class ProjectProvider extends WebsocketProvider {
  constructor(
    serverUrl: string,
    room: string,
    doc: Y.Doc,
    private readonly getToken: () => string | null,
    options: { WebSocketPolyfill?: typeof WebSocket; maxBackoffMs: number },
  ) {
    super(serverUrl, room, doc, {
      // Connecting only works once this class is set up, which is after this constructor.
      connect: false,
      // Other tabs would hand each other documents without asking the server about the epoch.
      disableBc: true,
      maxBackoffTime: options.maxBackoffMs,
      ...(options.WebSocketPolyfill ? { WebSocketPolyfill: options.WebSocketPolyfill } : {}),
    });
  }

  override get url(): string {
    const params = new URLSearchParams();
    const token = this.getToken();
    if (token) {
      params.set('token', token);
    }
    const epoch = this.doc.getMap(STATUS).get(EPOCH);
    if (typeof epoch === 'string' && epoch !== '') {
      params.set(EPOCH_PARAM, epoch);
    }
    const query = params.toString();
    const suffix = query === '' ? '' : '?' + query;
    return `${this.serverUrl}/${this.roomname}${suffix}`;
  }
}

/** One document and the provider that syncs it. */
interface Session {
  project: ProjectDocument;
  provider: ProjectProvider;
  stop: () => void;
}

/**
 * Connects to the room of a project on the collaboration server and keeps the connection: the
 * client reconnects by itself, and starts again with a new document if the server says the old one
 * belongs to an earlier room.
 */
export function createProjectConnection(options: ProjectConnectionOptions): ProjectConnection {
  const { serverUrl, projectId, getToken, refreshToken, WebSocketPolyfill, maxBackoffMs = DEFAULT_MAX_BACKOFF_MS } = options;
  const listeners = new Set<() => void>();
  const restarts: number[] = [];
  let destroyed = false;
  let session: Session;
  let snapshot: ConnectionSnapshot;

  const renewToken = (): Promise<void> =>
    Promise.resolve()
      .then(() => refreshToken?.())
      .then(
        () => undefined,
        () => undefined, // connecting is tried anyway; the server decides about the token
      );

  function update(changes: Partial<ConnectionSnapshot>): void {
    const next = { ...snapshot, ...changes };
    const isChanged = (Object.keys(next) as (keyof ConnectionSnapshot)[]).some((key) => next[key] !== snapshot[key]);
    if (!isChanged || destroyed) {
      return;
    }
    snapshot = next;
    for (const listener of listeners) {
      listener();
    }
  }

  function startSession(): Session {
    const doc = new Y.Doc();
    const project = new ProjectDocument(doc);
    const provider = new ProjectProvider(serverUrl, `vsum:${projectId}`, doc, getToken, {
      WebSocketPolyfill,
      maxBackoffMs,
    });
    const status = doc.getMap(STATUS);
    const readWritebackError = () => {
      const error = status.get(WRITEBACK_ERROR);
      return typeof error === 'string' ? error : null;
    };
    const onStatus = () => update({ writebackError: readWritebackError() });
    status.observe(onStatus);

    const current: Session = { project, provider, stop: () => {} };
    // An answer from a session that was replaced meanwhile is of no interest.
    const isCurrent = () => session === current && !destroyed;

    provider.on('status', ({ status: next }) => isCurrent() && update({ status: next }));
    provider.on('sync', (synced) => isCurrent() && update({ synced }));
    provider.on('connection-close', () => {
      if (isCurrent()) {
        void renewToken();
      }
    });
    provider.on('closed', ({ code }) => {
      if (!isCurrent()) {
        return;
      }
      if (code === OUTDATED_DOCUMENT_CLOSE_CODE) {
        startAgain();
      } else {
        giveUp('rejected');
      }
    });
    current.stop = () => {
      status.unobserve(onStatus);
      provider.destroy();
    };
    session = current;

    void renewToken().then(() => {
      if (isCurrent()) {
        provider.connect();
      }
    });
    return current;
  }

  /** Throws the outdated document away and connects with a new, empty one. */
  function startAgain(): void {
    const now = Date.now();
    restarts.splice(0, restarts.length, ...restarts.filter((time) => now - time < RESTART_WINDOW_MS), now);
    if (restarts.length > MAX_RESTARTS) {
      giveUp('outdated');
      return;
    }
    const previous = session;
    const generation = snapshot.generation + 1;
    const next = startSession();
    previous.stop();
    update({
      project: next.project,
      generation,
      status: 'connecting',
      synced: false,
      writebackError: null,
      failure: null,
    });
  }

  function giveUp(failure: ConnectionFailure): void {
    session.stop();
    update({ status: 'disconnected', synced: false, failure });
  }

  session = undefined as unknown as Session;
  const first = startSession();
  snapshot = {
    status: 'connecting',
    synced: false,
    writebackError: null,
    project: first.project,
    generation: 0,
    failure: null,
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      listeners.clear();
      session.stop();
    },
  };
}
