import { act, renderHook } from '@testing-library/react';
import type { ConnectionSnapshot, ProjectConnection, ProjectConnectionOptions } from '../../collaboration/projectConnection';
import { useProjectConnection } from '../../collaboration/useProjectConnection';
import { ProjectDocument } from '../../collaboration/projectDocument';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

/** A connection that does nothing but report what it is told. */
function fakeConnection() {
  const listeners = new Set<() => void>();
  let snapshot: ConnectionSnapshot = {
    status: 'connecting',
    synced: false,
    writebackError: null,
    project: new ProjectDocument(new Y.Doc()),
    generation: 0,
    failure: null,
    awareness: new Awareness(new Y.Doc()),
  };
  const connection: ProjectConnection & { destroyed: boolean; change(changes: Partial<ConnectionSnapshot>): void } = {
    destroyed: false,
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      this.destroyed = true;
    },
    change(changes) {
      snapshot = { ...snapshot, ...changes };
      listeners.forEach((listener) => listener());
    },
  };
  return connection;
}

function setup() {
  const created: { options: ProjectConnectionOptions; connection: ReturnType<typeof fakeConnection> }[] = [];
  const createConnection = vi.fn((options: ProjectConnectionOptions) => {
    const connection = fakeConnection();
    created.push({ options, connection });
    return connection;
  });
  return { created, createConnection };
}

describe('useProjectConnection', () => {
  it('is null, and connects to nothing, without a collaboration server', () => {
    const { createConnection } = setup();

    const { result } = renderHook(() => useProjectConnection(12, { serverUrl: undefined, createConnection }));

    expect(result.current).toBeNull();
    expect(createConnection).not.toHaveBeenCalled();
  });

  it('is null, and connects to nothing, without a project', () => {
    const { createConnection } = setup();

    const { result } = renderHook(() => useProjectConnection(null, { serverUrl: 'ws://localhost:1234', createConnection }));

    expect(result.current).toBeNull();
    expect(createConnection).not.toHaveBeenCalled();
  });

  it('connects to the project, with the token of the user, and gives the state of the connection', () => {
    const { created, createConnection } = setup();
    localStorage.setItem('auth.access_token', 'the-token');
    localStorage.setItem('auth.access_expires_at', String(Date.now() + 60_000));

    const { result } = renderHook(() => useProjectConnection(12, { serverUrl: 'ws://localhost:1234', createConnection }));

    expect(created).toHaveLength(1);
    expect(created[0].options).toMatchObject({ serverUrl: 'ws://localhost:1234', projectId: 12 });
    expect(created[0].options.getToken()).toBe('the-token');
    expect(typeof created[0].options.refreshToken).toBe('function');
    expect(result.current?.status).toBe('connecting');
  });

  it('follows the connection', () => {
    const { created, createConnection } = setup();
    const { result } = renderHook(() => useProjectConnection(12, { serverUrl: 'ws://localhost:1234', createConnection }));

    act(() => created[0].connection.change({ status: 'connected', synced: true }));
    expect(result.current).toMatchObject({ status: 'connected', synced: true });

    act(() => created[0].connection.change({ writebackError: 'The changes could not be saved' }));
    expect(result.current?.writebackError).toBe('The changes could not be saved');
  });

  it('closes the connection when the page is left', () => {
    const { created, createConnection } = setup();
    const { unmount } = renderHook(() => useProjectConnection(12, { serverUrl: 'ws://localhost:1234', createConnection }));

    unmount();

    expect(created[0].connection.destroyed).toBe(true);
  });

  it('connects to the other project, and closes the first connection, when the project changes', () => {
    const { created, createConnection } = setup();
    const { result, rerender } = renderHook(({ id }) => useProjectConnection(id, { serverUrl: 'ws://localhost:1234', createConnection }), {
      initialProps: { id: 12 as number | null },
    });
    act(() => created[0].connection.change({ synced: true }));

    rerender({ id: 13 });

    expect(created.map((c) => c.options.projectId)).toEqual([12, 13]);
    expect(created[0].connection.destroyed).toBe(true);
    expect(result.current?.synced).toBe(false); // the new connection's state, not the old one's
  });

  it('stops being connected when the project is closed', () => {
    const { created, createConnection } = setup();
    const { result, rerender } = renderHook(({ id }) => useProjectConnection(id, { serverUrl: 'ws://localhost:1234', createConnection }), {
      initialProps: { id: 12 as number | null },
    });

    rerender({ id: null });

    expect(created[0].connection.destroyed).toBe(true);
    expect(result.current).toBeNull();
  });

  it('keeps the connection while the page only re-renders', () => {
    const { createConnection } = setup();
    const { rerender } = renderHook(() => useProjectConnection(12, { serverUrl: 'ws://localhost:1234', createConnection }));

    rerender();
    rerender();

    expect(createConnection).toHaveBeenCalledTimes(1);
  });
});
