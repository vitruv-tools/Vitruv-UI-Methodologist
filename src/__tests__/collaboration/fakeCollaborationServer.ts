import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import { WebSocketServer, type WebSocket as ServerSocket } from 'ws';
import * as Y from 'yjs';
import {
  EPOCH,
  EPOCH_PARAM,
  OUTDATED_DOCUMENT_CLOSE_CODE,
  PROJECT_REMOVED_CLOSE_CODE,
  STATUS,
} from '../../collaboration/document';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

/** A connection attempt as the server saw it. */
export interface Connection {
  room: string;
  token: string | null;
  epoch: string | null;
  /** Whether the server accepted it. */
  accepted: boolean;
}

export interface FakeCollaborationServer {
  /** WebSocket URL, e.g. `ws://localhost:1234`. */
  url: string;
  /** The connection attempts so far, in order. */
  connections: Connection[];
  /** The document of a room. */
  room(name: string): Y.Doc;
  /** Replaces the room's document, like a server that dropped the room and loaded it again. */
  recreateRoom(name: string, doc: Y.Doc): void;
  /**
   * Drops the room like a server whose project was moved to the trash: closes its clients with
   * `4410`, and answers new connections to it with `403` until it is created again.
   */
  removeRoom(name: string): void;
  /** Disconnects all clients of a room, without closing the server. */
  disconnectAll(): void;
  /** The tokens that are accepted; every token if `undefined`. */
  acceptedTokens: Set<string> | undefined;
  /** Closes every connection with `4409`, also those without epoch. */
  forceOutdated: boolean;
  close(): Promise<void>;
}

/**
 * Starts a WebSocket server that speaks the y-websocket protocol, like the collaboration server: a
 * client that sends the epoch of its document (`?epoch=`) is closed with `4409` if the room has
 * another one, or doesn't exist. A client without epoch joins the room, if it exists. A removed
 * room's clients are closed with `4410`, and new connections to it are refused.
 */
export async function startFakeCollaborationServer(
  initialRooms: Record<string, Y.Doc> = {},
): Promise<FakeCollaborationServer> {
  const rooms = new Map<string, Y.Doc>(Object.entries(initialRooms));
  const removedRooms = new Set<string>();
  /** The connected clients, with the room each is in. */
  const clients = new Map<ServerSocket, string>();
  /** Awareness is relayed between the clients of a room, like y-websocket's server does; it isn't saved. */
  const awarenesses = new Map<Y.Doc, awarenessProtocol.Awareness>();
  const connections: Connection[] = [];
  const state: { acceptedTokens: Set<string> | undefined; forceOutdated: boolean } = {
    acceptedTokens: undefined,
    forceOutdated: false,
  };

  const http: Server = createServer();
  const webSockets = new WebSocketServer({ noServer: true });
  http.on('upgrade', (request, socket, head) => {
    // A client that is turned away may reset the connection while the answer is still being sent
    // (`ECONNRESET`). Without a listener, Node would report that as an uncaught exception.
    socket.on('error', () => {});
    const url = new URL(request.url ?? '/', 'http://localhost');
    const room = decodeURIComponent(url.pathname.slice(1));
    const token = url.searchParams.get('token');
    const epoch = url.searchParams.get(EPOCH_PARAM);
    const authorized = state.acceptedTokens === undefined || (token !== null && state.acceptedTokens.has(token));
    const accepted = authorized && !removedRooms.has(room);
    connections.push({ room, token, epoch, accepted });
    if (!authorized) {
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      return;
    }
    if (!accepted) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      return;
    }
    webSockets.handleUpgrade(request, socket, head, (webSocket) => {
      const doc = rooms.get(room);
      const roomEpoch = doc?.getMap(STATUS).get(EPOCH);
      if (state.forceOutdated || (epoch !== null && (doc === undefined || roomEpoch !== epoch))) {
        webSocket.close(OUTDATED_DOCUMENT_CLOSE_CODE, 'Outdated document');
        return;
      }
      if (doc === undefined) {
        webSocket.close(1011, 'No such room');
        return;
      }
      join(room, doc, webSocket);
    });
  });

  function join(room: string, doc: Y.Doc, webSocket: ServerSocket): void {
    clients.set(webSocket, room);
    let awareness = awarenesses.get(doc);
    if (awareness === undefined) {
      awareness = new awarenessProtocol.Awareness(doc);
      awareness.setLocalState(null);
      awarenesses.set(doc, awareness);
    }
    const roomAwareness = awareness;
    const controlled = new Set<number>();
    const sendAwareness = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      if (origin === webSocket) {
        // Remember which clients this connection speaks for, to remove them when it closes.
        added.forEach((id) => controlled.add(id));
        removed.forEach((id) => controlled.delete(id));
      }
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(roomAwareness, [...added, ...updated, ...removed]),
      );
      webSocket.send(encoding.toUint8Array(encoder));
    };
    roomAwareness.on('update', sendAwareness);
    const sendUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === webSocket) {
        return;
      }
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      webSocket.send(encoding.toUint8Array(encoder));
    };
    doc.on('update', sendUpdate);
    webSocket.on('close', () => {
      clients.delete(webSocket);
      doc.off('update', sendUpdate);
      roomAwareness.off('update', sendAwareness);
      awarenessProtocol.removeAwarenessStates(roomAwareness, [...controlled], null);
    });
    webSocket.on('message', (data: Buffer) => {
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const type = decoding.readVarUint(decoder);
      if (type === MESSAGE_AWARENESS) {
        awarenessProtocol.applyAwarenessUpdate(roomAwareness, decoding.readVarUint8Array(decoder), webSocket);
        return;
      }
      if (type !== MESSAGE_SYNC) {
        return;
      }
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.readSyncMessage(decoder, encoder, doc, webSocket);
      if (encoding.length(encoder) > 1) {
        webSocket.send(encoding.toUint8Array(encoder));
      }
    });
    const step1 = encoding.createEncoder();
    encoding.writeVarUint(step1, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(step1, doc);
    webSocket.send(encoding.toUint8Array(step1));
  }

  await new Promise<void>((resolve) => http.listen(0, resolve));
  const port = (http.address() as AddressInfo).port;

  return {
    url: `ws://localhost:${port}`,
    connections,
    room(name) {
      const doc = rooms.get(name);
      if (doc === undefined) {
        throw new Error(`No room ${name}`);
      }
      return doc;
    },
    recreateRoom(name, doc) {
      removedRooms.delete(name);
      rooms.set(name, doc);
    },
    removeRoom(name) {
      rooms.delete(name);
      removedRooms.add(name);
      for (const [client, room] of clients) {
        if (room === name) {
          client.close(PROJECT_REMOVED_CLOSE_CODE, 'Project removed');
        }
      }
    },
    disconnectAll() {
      for (const client of clients.keys()) {
        client.terminate();
      }
    },
    get acceptedTokens() {
      return state.acceptedTokens;
    },
    set acceptedTokens(tokens) {
      state.acceptedTokens = tokens;
    },
    get forceOutdated() {
      return state.forceOutdated;
    },
    set forceOutdated(value) {
      state.forceOutdated = value;
    },
    close: () =>
      new Promise((resolve) => {
        for (const client of clients.keys()) {
          client.terminate();
        }
        webSockets.close();
        http.close(() => resolve());
        http.closeAllConnections();
      }),
  };
}
