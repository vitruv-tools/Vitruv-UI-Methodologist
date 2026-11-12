import { AuthService } from '../services/auth';

/**
 * Subprotocol name that precedes the access token. Browsers cannot set an Authorization header on a
 * WebSocket, so the backend reads the token from `Sec-WebSocket-Protocol: bearer, <token>`.
 */
export const LSP_BEARER_PROTOCOL = 'bearer';

/** Close code of a server that refused a malformed request, e.g. an editor opened without a project. */
export const LSP_CLOSE_BAD_DATA = 1007;

/** Close code of a connection the browser reports when the handshake was refused or the network dropped. */
export const LSP_CLOSE_ABNORMAL = 1006;

/** Close code of a server that already runs its maximum number of language servers. */
export const LSP_CLOSE_OVERLOAD = 1013;

/** Builds the WebSocket URL of an LSP endpoint such as `/lsp` or `/ocl-lsp` for a project. */
export function lspWebSocketUrl(path: string, vsumId: string | number): string {
  const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://localhost:9811';
  const wsBase = apiBase.replace('https://', 'wss://').replace('http://', 'ws://');
  return `${wsBase}${path}?vsumId=${encodeURIComponent(String(vsumId))}`;
}

/**
 * Opens an authenticated LSP WebSocket for a project.
 *
 * The token is read when the socket is opened, so every (re)connect uses the current one; the
 * backend checks it, and that the user is a member of the project, only during the handshake.
 *
 * @returns the socket, or `null` if the user is not signed in
 */
export function openLspWebSocket(path: string, vsumId: string | number): WebSocket | null {
  const token = AuthService.getAccessToken();
  if (!token) return null;
  return new WebSocket(lspWebSocketUrl(path, vsumId), [LSP_BEARER_PROTOCOL, token]);
}

/** Explains why an LSP socket closed, in words for the editor's status line. */
export function describeLspClose(code: number): string {
  switch (code) {
    case LSP_CLOSE_OVERLOAD:
      return 'Too many language servers are running — close another editor and reopen this one';
    case LSP_CLOSE_BAD_DATA:
      return 'The language server refused the request — reopen the editor from a project';
    case LSP_CLOSE_ABNORMAL:
      return 'Could not connect to the language server — check that you are signed in and a member of this project';
    default:
      return `LSP disconnected (code ${code}) — try reopening the editor`;
  }
}
