import {
  describeLspClose,
  lspWebSocketUrl,
  openLspWebSocket,
  LSP_CLOSE_ABNORMAL,
  LSP_CLOSE_BAD_DATA,
  LSP_CLOSE_OVERLOAD,
} from '../../utils/lspWebSocket';

describe('lspWebSocketUrl', () => {
  afterEach(() => {
    delete process.env.REACT_APP_API_BASE_URL;
  });

  it('uses ws for http and wss for https, and passes only the project', () => {
    process.env.REACT_APP_API_BASE_URL = 'http://localhost:9811';
    expect(lspWebSocketUrl('/lsp', 7)).toBe('ws://localhost:9811/lsp?vsumId=7');

    process.env.REACT_APP_API_BASE_URL = 'https://api.example.com';
    expect(lspWebSocketUrl('/ocl-lsp', '7')).toBe('wss://api.example.com/ocl-lsp?vsumId=7');
  });
});

describe('openLspWebSocket', () => {
  beforeEach(() => {
    localStorage.clear();
    (globalThis as any).WebSocket = vi.fn();
    process.env.REACT_APP_API_BASE_URL = 'http://localhost:9811';
  });

  afterEach(() => {
    delete process.env.REACT_APP_API_BASE_URL;
  });

  it('sends the access token as the second subprotocol', () => {
    localStorage.setItem('auth.access_token', 'abc.def');
    localStorage.setItem('auth.access_expires_at', String(Date.now() + 60_000));

    openLspWebSocket('/lsp', 3);

    expect(globalThis.WebSocket).toHaveBeenCalledWith('ws://localhost:9811/lsp?vsumId=3', [
      'bearer',
      'abc.def',
    ]);
  });

  it('reads the token again on every call, so a reconnect uses the refreshed one', () => {
    localStorage.setItem('auth.access_expires_at', String(Date.now() + 60_000));
    localStorage.setItem('auth.access_token', 'first');
    openLspWebSocket('/lsp', 3);
    localStorage.setItem('auth.access_token', 'second');
    openLspWebSocket('/lsp', 3);

    const calls = (globalThis.WebSocket as any).mock.calls;
    expect(calls[0][1]).toEqual(['bearer', 'first']);
    expect(calls[1][1]).toEqual(['bearer', 'second']);
  });

  it('returns null and opens nothing when the user is not signed in', () => {
    expect(openLspWebSocket('/lsp', 3)).toBeNull();
    expect(globalThis.WebSocket).not.toHaveBeenCalled();
  });
});

describe('describeLspClose', () => {
  it('explains the codes the backend uses', () => {
    expect(describeLspClose(LSP_CLOSE_OVERLOAD)).toMatch(/too many/i);
    expect(describeLspClose(LSP_CLOSE_BAD_DATA)).toMatch(/refused/i);
    expect(describeLspClose(LSP_CLOSE_ABNORMAL)).toMatch(/signed in and a member/i);
  });

  it('falls back to the code for anything else', () => {
    expect(describeLspClose(1011)).toContain('1011');
  });
});
