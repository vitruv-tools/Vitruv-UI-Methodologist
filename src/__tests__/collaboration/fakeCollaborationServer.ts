import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as syncProtocol from 'y-protocols/sync';
import { WebSocketServer, type WebSocket as ServerSocket } from 'ws';
import * as Y from 'yjs';
import { EPOCH, EPOCH_PARAM, OUTDATED_DOCUMENT_CLOSE_CODE, STATUS } from '../../collaboration/document';

const MESSAGE_SYNC = 0;

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
 * another one, or doesn't exist. A client without epoch joins the room, if it exists.
 */
export async function startFakeCollaborationServer(
  initialRooms: Record<string, Y.Doc> = {},
): Promise<FakeCollaborationServer> {
  const rooms = new Map<string, Y.Doc>(Object.entries(initialRooms));
  const clients = new Set<ServerSocket>();
  const connections: Connection[] = [];
  const state: { acceptedTokens: Set<string> | undefined; forceOutdated: boolean } = {
    acceptedTokens: undefined,
    forceOutdated: false,
  };

  const http: Server = createServer();
  const webSockets = new WebSocketServer({ noServer: true });
  http.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const room = decodeURIComponent(url.pathname.slice(1));
    const token = url.searchParams.get('token');
    const epoch = url.searchParams.get(EPOCH_PARAM);
    const accepted = state.acceptedTokens === undefined || (token !== null && state.acceptedTokens.has(token));
    connections.push({ room, token, epoch, accepted });
    if (!accepted) {
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
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
      join(doc, webSocket);
    });
  });

  function join(doc: Y.Doc, webSocket: ServerSocket): void {
    clients.add(webSocket);
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
    });
    webSocket.on('message', (data: Buffer) => {
      const decoder = decoding.createDecoder(new Uint8Array(data));
      if (decoding.readVarUint(decoder) !== MESSAGE_SYNC) {
        return; // awareness and the rest aren't needed here
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
      rooms.set(name, doc);
    },
    disconnectAll() {
      for (const client of clients) {
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
        for (const client of clients) {
          client.terminate();
        }
        webSockets.close();
        http.close(() => resolve());
        http.closeAllConnections();
      }),
  };
}
