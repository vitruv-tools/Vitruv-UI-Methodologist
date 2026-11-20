import { apiService } from '../services/api';
import { AuthService } from '../services/auth';
import {
  createProjectConnection,
  type ConnectionSnapshot,
  type ProjectConnection,
} from './projectConnection';

export interface AddRelationOptions {
  /** WebSocket address of the collaboration server. */
  serverUrl: string;
  projectId: number;
  /** Library IDs of the two metamodels. */
  sourceId: number;
  targetId: number;
  /** ID of the uploaded reaction file that makes up the relation. */
  reactionFileId: number;
  /** How long joining the project may take. Defaults to 8 seconds. */
  timeoutMs?: number;
  /** Defaults to the real connection; tests replace it. */
  createConnection?: typeof createProjectConnection;
}

const DEFAULT_JOIN_TIMEOUT_MS = 8000;
/** How long the connection stays open after the change, so that it is sent before it closes. */
const FLUSH_MS = 50;

/**
 * Adds a relation between two metamodels of a project through the project's shared document,
 * for a place where the project isn't open on the canvas, e.g. the project's details.
 *
 * The user joins the project's room for a moment, so that the relation is merged with what others
 * are doing, instead of sending the whole project to the backend, which could delete what another
 * user added a moment ago. The server saves it like any other change.
 *
 * @throws Error if the project can't be joined in time, or a metamodel isn't part of it
 */
export async function addRelationToSharedProject(options: AddRelationOptions): Promise<void> {
  const { serverUrl, projectId, sourceId, targetId, reactionFileId, timeoutMs = DEFAULT_JOIN_TIMEOUT_MS } = options;
  const connection = (options.createConnection ?? createProjectConnection)({
    serverUrl,
    projectId,
    getToken: () => AuthService.getAccessToken(),
    refreshToken: () => AuthService.ensureValidToken(),
  });
  try {
    const snapshot = await joined(connection, timeoutMs);
    const { models } = snapshot.project.read();
    if (!models.has(sourceId) || !models.has(targetId)) {
      throw new Error('A meta model is not part of this project.');
    }
    snapshot.project.upsertRelation({ sourceId, targetId, reactionFileId });
    await new Promise((resolve) => globalThis.setTimeout(resolve, FLUSH_MS));
  } finally {
    connection.destroy();
  }
}

/**
 * Waits until the backend lists the relation, since the server saves a change a moment after it is
 * made. Resolves `false` if that doesn't happen in time, and when the backend can't be asked.
 */
export async function waitForRelationInBackend(
  projectId: number,
  sourceId: number,
  targetId: number,
  { timeoutMs = 15_000, intervalMs = 300 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<boolean> {
  const ask = async (deadline: number): Promise<boolean> => {
    if (Date.now() >= deadline) {
      return false;
    }
    try {
      const response = await apiService.getVsumDetails(projectId);
      const relations: { sourceId: number; targetId: number }[] = response?.data?.metaModelsRelation ?? [];
      if (relations.some((relation) => relation.sourceId === sourceId && relation.targetId === targetId)) {
        return true;
      }
    } catch {
      // The backend may be busy; ask again until the time is up.
    }
    await new Promise((resolve) => globalThis.setTimeout(resolve, intervalMs));
    return ask(deadline);
  };
  return ask(Date.now() + timeoutMs);
}

/** Resolves with the snapshot once the project is loaded into the document. */
function joined(connection: ProjectConnection, timeoutMs: number): Promise<ConnectionSnapshot> {
  return new Promise((resolve, reject) => {
    const fail = () => reject(new Error('The collaboration server could not be reached, so the meta models were not linked.'));
    const check = () => {
      const snapshot = connection.getSnapshot();
      if (snapshot.synced) {
        cleanup();
        resolve(snapshot);
      } else if (snapshot.failure !== null) {
        cleanup();
        fail();
      }
    };
    const timer = globalThis.setTimeout(() => {
      cleanup();
      fail();
    }, timeoutMs);
    const stop = connection.subscribe(check);
    const cleanup = () => {
      globalThis.clearTimeout(timer);
      stop();
    };
    check();
  });
}
