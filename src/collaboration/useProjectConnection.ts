import { useEffect, useState, useSyncExternalStore } from 'react';
import config from '../config/environment';
import { AuthService } from '../services/auth';
import {
  createProjectConnection,
  type ConnectionSnapshot,
  type ProjectConnection,
} from './projectConnection';

export interface UseProjectConnectionOptions {
  /** The collaboration server's address. Defaults to `REACT_APP_COLLABORATION_URL`. */
  serverUrl?: string;
  /** Defaults to {@link createProjectConnection}; tests replace it. */
  createConnection?: typeof createProjectConnection;
}

const noSubscription = () => () => {};
const noSnapshot = () => null;

/**
 * Connects to the shared document of a project for as long as the component is there, and returns
 * what is known about the connection. Returns `null` if there is no collaboration server (the
 * canvas then works as it did without), and while there is no project.
 *
 * The connection is closed when the project changes or the component goes away.
 */
export function useProjectConnection(
  projectId: number | null,
  options: UseProjectConnectionOptions = {},
): ConnectionSnapshot | null {
  const { createConnection = createProjectConnection } = options;
  const serverUrl = 'serverUrl' in options ? options.serverUrl : config.collaborationUrl;
  const [connection, setConnection] = useState<ProjectConnection | null>(null);

  useEffect(() => {
    if (serverUrl === undefined || projectId === null) {
      setConnection(null);
      return undefined;
    }
    const opened = createConnection({
      serverUrl,
      projectId,
      getToken: () => AuthService.getAccessToken(),
      refreshToken: () => AuthService.ensureValidToken(),
    });
    setConnection(opened);
    return () => {
      opened.destroy();
      setConnection((current) => (current === opened ? null : current));
    };
  }, [serverUrl, projectId, createConnection]);

  return useSyncExternalStore(
    connection?.subscribe ?? noSubscription,
    connection?.getSnapshot ?? noSnapshot,
  );
}
