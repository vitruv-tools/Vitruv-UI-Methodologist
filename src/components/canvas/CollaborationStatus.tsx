import React from 'react';
import type { ConnectionFailure, ConnectionStatus } from '../../collaboration/projectConnection';
import type { CollaborationState } from '../../collaboration/useCanvasCollaboration';

export interface CollaborationStatusProps {
  status: ConnectionStatus;
  /** Whether the project is loaded into the shared document. */
  synced: boolean;
  /** Why the server couldn't write the last changes back; `null` if it could. */
  writebackError: string | null;
  /** Why the connection stopped for good, if it did. */
  failure: ConnectionFailure | null;
  /** The project could not be joined: it can be looked at, but not changed. */
  unavailable?: boolean;
}

type Tone = 'warning' | 'error';

/** What the user is told when the open project was moved to the trash or deleted. */
export const PROJECT_REMOVED_MESSAGE =
  'This project was moved to the trash or deleted. Changes that were not saved yet are lost.';

const TONES: Record<Tone, { background: string; color: string; border: string }> = {
  warning: { background: '#fff8e1', color: '#7a5200', border: '#f0c24b' },
  error: { background: '#fdecea', color: '#8a1f17', border: '#e57373' },
};

/**
 * Tells the user what live collaboration is doing when it isn't working as it should: the
 * connection is lost, the server couldn't save the changes, or the project can't be kept in sync.
 * There is no Save button, so this is where the user sees that changes might not be safe. It shows
 * nothing while all is well.
 */
export const CollaborationStatus: React.FC<CollaborationStatusProps> = ({
  status,
  synced,
  writebackError,
  failure,
  unavailable = false,
}) => {
  // A removed project can't be joined either; that it was removed is what the user needs to know.
  if (failure === 'removed') {
    return banner('error', 'alert', PROJECT_REMOVED_MESSAGE);
  }
  if (unavailable) {
    return banner(
      'error',
      'alert',
      'The collaboration server can not be reached. You can look at the project, but it can not be changed.',
    );
  }
  if (failure !== null) {
    return banner(
      'error',
      'alert',
      'This project can no longer be kept in sync with the others. Reload the page to continue.',
    );
  }
  if (status !== 'connected' || !synced) {
    return banner('warning', 'status', 'Connection lost. Your changes are kept and sent when it is back.');
  }
  if (writebackError !== null) {
    return banner('warning', 'status', writebackError);
  }
  return null;
};

/**
 * What the banner shows for the state of the page's collaboration, or `null` if there is no
 * banner: there is no collaboration, no connection yet, or the project is still being joined.
 */
export function collaborationStatusProps(collaboration: CollaborationState): CollaborationStatusProps | null {
  const { enabled, connection, sync, unavailable } = collaboration;
  if (!enabled || connection === null || (sync === null && !unavailable)) {
    return null;
  }
  return {
    status: connection.status,
    synced: connection.synced,
    writebackError: connection.writebackError,
    failure: connection.failure,
    unavailable,
  };
}

function banner(tone: Tone, role: 'status' | 'alert', message: string): React.ReactElement {
  const { background, color, border } = TONES[tone];
  return (
    <div
      role={role}
      style={{
        position: 'fixed',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        maxWidth: 'min(640px, 90vw)',
        padding: '8px 14px',
        borderRadius: 8,
        border: `1px solid ${border}`,
        background,
        color,
        fontSize: 13,
        lineHeight: 1.4,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      {message}
    </div>
  );
}
