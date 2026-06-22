import { renderHook, act } from '@testing-library/react';
import { useOclLsp } from '../../hooks/useOclLsp';

// ─── Mock monaco-editor ──────────────────────────────────────────────────────
const mockSetModelMarkers = jest.fn();
const mockRegisterCompletionItemProvider = jest.fn();
const mockCompletionDisposable = { dispose: jest.fn() };

jest.mock('monaco-editor', () => ({
  MarkerSeverity: { Error: 8, Warning: 4, Info: 2 },
  editor: { setModelMarkers: mockSetModelMarkers },
  languages: {
    registerCompletionItemProvider: mockRegisterCompletionItemProvider,
    CompletionItemKind: { Text: 1 },
  },
}));

jest.mock('@monaco-editor/react', () => ({}));

// ─── Mock WebSocket ───────────────────────────────────────────────────────────
function makeMockWs() {
  return {
    readyState: 1,
    onmessage: null,
    onclose: null,
    send: jest.fn(),
    close: jest.fn(),
  };
}

let mockWsInstance;

beforeEach(() => {
  mockWsInstance = makeMockWs();
  global.WebSocket = jest.fn(() => mockWsInstance) as any;
  global.WebSocket.OPEN = 1;

  localStorage.clear();
  localStorage.setItem('auth.user', JSON.stringify({ id: 'user-123' }));

  jest.clearAllMocks();
  mockRegisterCompletionItemProvider.mockReturnValue(mockCompletionDisposable);
});

// ─── Monaco instance stub ─────────────────────────────────────────────────────
function makeMonacoStub() {
  return {
    MarkerSeverity: { Error: 8, Warning: 4, Info: 2 },
    editor: { setModelMarkers: mockSetModelMarkers },
    languages: {
      registerCompletionItemProvider: mockRegisterCompletionItemProvider,
      CompletionItemKind: { Text: 1 },
    },
  } as any;
}

// ─── Shared defaults ─────────────────────────────────────────────────────────
const defaultProps = {
  vsumId: 42,
  documentId: 'doc-1',
  languageId: 'ocl',
  getCode: () => 'context Foo inv: true',
};

function simulateMessage(data: object) {
  act(() => {
    mockWsInstance.onmessage?.({ data: JSON.stringify(data) });
  });
}

function mountHookAndConnect(props = defaultProps) {
  const monaco = makeMonacoStub();
  const { result, unmount } = renderHook(() => useOclLsp(props));
  const mockEditor = { getModel: jest.fn(() => ({})) };
  act(() => {
    result.current.onMount(mockEditor as any, monaco);
  });
  return { result, unmount, monaco, mockEditor };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useOclLsp', () => {

  // ── 1. No WebSocket when prerequisites are missing ─────────────────────────
  describe('no WebSocket created', () => {
    it('does not open a WebSocket when vsumId is undefined', () => {
      const monaco = makeMonacoStub();
      const { result } = renderHook(() => useOclLsp({ ...defaultProps, vsumId: undefined }));
      const mockEditor = { getModel: jest.fn() };
      act(() => { result.current.onMount(mockEditor as any, monaco); });
      expect(global.WebSocket).not.toHaveBeenCalled();
    });

    it('does not open a WebSocket when userId is absent from localStorage', () => {
      localStorage.removeItem('auth.user');
      const monaco = makeMonacoStub();
      const { result } = renderHook(() => useOclLsp(defaultProps));
      const mockEditor = { getModel: jest.fn() };
      act(() => { result.current.onMount(mockEditor as any, monaco); });
      expect(global.WebSocket).not.toHaveBeenCalled();
    });
  });

  // ── 2. WebSocket URL construction ─────────────────────────────────────────
  describe('WebSocket creation', () => {
    it('opens a WebSocket with the correct URL including userId and vsumId', () => {
      process.env.REACT_APP_API_BASE_URL = 'http://localhost:9811';
      mountHookAndConnect();
      expect(global.WebSocket).toHaveBeenCalledWith(
        'ws://localhost:9811/ocl-lsp?userId=user-123&vsumId=42'
      );
    });

    it('converts https base URL to wss', () => {
      process.env.REACT_APP_API_BASE_URL = 'https://api.example.com';
      mountHookAndConnect();
      expect(global.WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('wss://api.example.com')
      );
    });
  });

  // ── 3. LSP handshake ──────────────────────────────────────────────────────
  describe('LSP handshake', () => {
    it('sends initialize request when workspaceReady message is received', () => {
      mountHookAndConnect();
      simulateMessage({ type: 'workspaceReady', rootUri: 'file:///workspace/' });

      const sent = JSON.parse(mockWsInstance.send.mock.calls[0][0]);
      expect(sent.method).toBe('initialize');
      expect(sent.id).toBe(1);
      expect(sent.params.rootUri).toBe('file:///workspace/');
    });

    it('sends initialized + textDocument/didOpen after initialize response (id=1)', () => {
      mountHookAndConnect();
      simulateMessage({ type: 'workspaceReady', rootUri: 'file:///workspace/' });
      mockWsInstance.send.mockClear();

      simulateMessage({ id: 1, result: { capabilities: {} } });

      const calls = mockWsInstance.send.mock.calls.map((c) => JSON.parse(c[0]));
      const methods = calls.map((m) => m.method);
      expect(methods).toContain('initialized');
      expect(methods).toContain('textDocument/didOpen');
    });

    it('includes the correct text and languageId in textDocument/didOpen', () => {
      mountHookAndConnect();
      simulateMessage({ type: 'workspaceReady', rootUri: 'file:///workspace/' });
      mockWsInstance.send.mockClear();
      simulateMessage({ id: 1, result: { capabilities: {} } });

      const calls = mockWsInstance.send.mock.calls.map((c) => JSON.parse(c[0]));
      const didOpen = calls.find((m) => m.method === 'textDocument/didOpen');
      expect(didOpen.params.textDocument.text).toBe('context Foo inv: true');
      expect(didOpen.params.textDocument.languageId).toBe('ocl');
    });
  });

  // ── 4. publishDiagnostics ─────────────────────────────────────────────────
  describe('textDocument/publishDiagnostics', () => {
    function setupInitialized() {
      const { result, unmount } = renderHook(() => useOclLsp(defaultProps));
      const monaco = makeMonacoStub();
      const mockModel = {};
      const mockEditor = { getModel: jest.fn(() => mockModel) };

      act(() => { result.current.onMount(mockEditor as any, monaco); });
      simulateMessage({ type: 'workspaceReady', rootUri: 'file:///workspace/' });
      simulateMessage({ id: 1, result: { capabilities: {} } });

      return { result, unmount, mockModel };
    }

    it('calls monaco.editor.setModelMarkers with mapped markers for severity 1 (Error)', () => {
      const { mockModel } = setupInitialized();

      simulateMessage({
        method: 'textDocument/publishDiagnostics',
        params: {
          diagnostics: [{
            severity: 1,
            message: 'Something is wrong',
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
          }],
        },
      });

      expect(mockSetModelMarkers).toHaveBeenCalledWith(
        mockModel,
        'ocl',
        expect.arrayContaining([
          expect.objectContaining({
            severity: 8,
            message: 'Something is wrong',
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 6,
          }),
        ])
      );
    });

    it('maps severity 2 to Warning (4)', () => {
      const { mockModel } = setupInitialized();

      simulateMessage({
        method: 'textDocument/publishDiagnostics',
        params: {
          diagnostics: [{
            severity: 2,
            message: 'A warning',
            range: { start: { line: 1, character: 2 }, end: { line: 1, character: 8 } },
          }],
        },
      });

      expect(mockSetModelMarkers).toHaveBeenCalledWith(
        mockModel,
        'ocl',
        expect.arrayContaining([expect.objectContaining({ severity: 4 })])
      );
    });

    it('maps unknown severity to Info (2)', () => {
      const { mockModel } = setupInitialized();

      simulateMessage({
        method: 'textDocument/publishDiagnostics',
        params: {
          diagnostics: [{
            severity: 99,
            message: 'Just info',
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
          }],
        },
      });

      expect(mockSetModelMarkers).toHaveBeenCalledWith(
        mockModel,
        'ocl',
        expect.arrayContaining([expect.objectContaining({ severity: 2 })])
      );
    });

    it('does not call setModelMarkers when editor has no model', () => {
      const { result } = renderHook(() => useOclLsp(defaultProps));
      const monaco = makeMonacoStub();
      const mockEditor = { getModel: jest.fn(() => null) };

      act(() => { result.current.onMount(mockEditor as any, monaco); });
      simulateMessage({ type: 'workspaceReady', rootUri: 'file:///workspace/' });
      simulateMessage({ id: 1, result: { capabilities: {} } });
      mockSetModelMarkers.mockClear();

      simulateMessage({
        method: 'textDocument/publishDiagnostics',
        params: { diagnostics: [] },
      });

      expect(mockSetModelMarkers).not.toHaveBeenCalled();
    });
  });

  // ── 5. notifyChange ───────────────────────────────────────────────────────
  describe('notifyChange', () => {
    it('sends textDocument/didChange when initialized', () => {
      const { result } = mountHookAndConnect();

      simulateMessage({ type: 'workspaceReady', rootUri: 'file:///workspace/' });
      simulateMessage({ id: 1, result: { capabilities: {} } });
      mockWsInstance.send.mockClear();

      act(() => { result.current.notifyChange('new text'); });

      const calls = mockWsInstance.send.mock.calls.map((c) => JSON.parse(c[0]));
      const didChange = calls.find((m) => m.method === 'textDocument/didChange');
      expect(didChange).toBeDefined();
      expect(didChange.params.contentChanges[0].text).toBe('new text');
    });

    it('does nothing when not yet initialized', () => {
      const { result } = mountHookAndConnect();
      mockWsInstance.send.mockClear();

      act(() => { result.current.notifyChange('some text'); });

      expect(mockWsInstance.send).not.toHaveBeenCalled();
    });

    it('increments the document version on each change', () => {
      const { result } = mountHookAndConnect();

      simulateMessage({ type: 'workspaceReady', rootUri: 'file:///workspace/' });
      simulateMessage({ id: 1, result: { capabilities: {} } });
      mockWsInstance.send.mockClear();

      act(() => { result.current.notifyChange('first'); });
      act(() => { result.current.notifyChange('second'); });

      const calls = mockWsInstance.send.mock.calls.map((c) => JSON.parse(c[0]));
      const versions = calls
        .filter((m) => m.method === 'textDocument/didChange')
        .map((m) => m.params.textDocument.version);

      expect(versions[0]).toBeLessThan(versions[1]);
    });
  });

  // ── 6. Unmount / cleanup ──────────────────────────────────────────────────
  describe('unmount cleanup', () => {
    it('sends textDocument/didClose and closes the WebSocket', () => {
      const { unmount } = mountHookAndConnect();

      simulateMessage({ type: 'workspaceReady', rootUri: 'file:///workspace/' });
      simulateMessage({ id: 1, result: { capabilities: {} } });
      mockWsInstance.send.mockClear();

      act(() => { unmount(); });

      const calls = mockWsInstance.send.mock.calls.map((c) => JSON.parse(c[0]));
      expect(calls.some((m) => m.method === 'textDocument/didClose')).toBe(true);
      expect(mockWsInstance.close).toHaveBeenCalled();
    });

    it('closes the WebSocket even when not initialized', () => {
      const { unmount } = mountHookAndConnect();
      mockWsInstance.send.mockClear();

      act(() => { unmount(); });

      expect(mockWsInstance.close).toHaveBeenCalled();
    });

    it('disposes the completion provider on unmount', () => {
      const disposeFn = jest.fn();
      mockRegisterCompletionItemProvider.mockReturnValue({ dispose: disposeFn });

      const { unmount } = mountHookAndConnect();

      act(() => { unmount(); });

      expect(disposeFn).toHaveBeenCalled();
    });

    it('does not send didClose when never initialized', () => {
      const { unmount } = mountHookAndConnect();
      mockWsInstance.send.mockClear();

      act(() => { unmount(); });

      const calls = mockWsInstance.send.mock.calls.map((c) => JSON.parse(c[0]));
      expect(calls.some((m) => m.method === 'textDocument/didClose')).toBe(false);
    });
  });

  // ── 7. Completion provider registration ───────────────────────────────────
  describe('completion provider', () => {
    it('registers a completion provider on connect', () => {
      mountHookAndConnect();

      expect(mockRegisterCompletionItemProvider).toHaveBeenCalledWith(
        'ocl',
        expect.objectContaining({
          triggerCharacters: expect.arrayContaining(['.']),
          provideCompletionItems: expect.any(Function),
        })
      );
    });
  });

  // ── 8. onMount ────────────────────────────────────────────────────────────
  describe('onMount', () => {
    it('stores the editor ref and triggers connect (WebSocket is created)', () => {
      const monaco = makeMonacoStub();
      const { result } = renderHook(() => useOclLsp(defaultProps));
      const mockEditor = { getModel: jest.fn() };

      act(() => { result.current.onMount(mockEditor as any, monaco); });

      expect(global.WebSocket).toHaveBeenCalledTimes(1);
    });
  });

  // ── 9. Malformed messages ─────────────────────────────────────────────────
  describe('malformed messages', () => {
    it('silently ignores non-JSON messages', () => {
      mountHookAndConnect();

      expect(() => {
        act(() => {
          mockWsInstance.onmessage?.({ data: 'not-valid-json' });
        });
      }).not.toThrow();
    });
  });

  // ── 10. Completion response (pendingRequests path) ────────────────────────
  describe('completion response handling', () => {
    function setupInitializedWithCompletion() {
      let capturedProvider: any;
      mockRegisterCompletionItemProvider.mockImplementation((_lang, provider) => {
        capturedProvider = provider;
        return { dispose: jest.fn() };
      });

      const { result, unmount } = mountHookAndConnect();
      simulateMessage({ type: 'workspaceReady', rootUri: 'file:///workspace/' });
      simulateMessage({ id: 1, result: { capabilities: {} } });

      return { result, unmount, getProvider: () => capturedProvider };
    }

    it('resolves completion items when LSP responds via pendingRequests', async () => {
      const { getProvider } = setupInitializedWithCompletion();
      const provider = getProvider();

      const mockModel = {
        getWordUntilPosition: jest.fn(() => ({ startColumn: 1, endColumn: 4 })),
      };
      const mockPosition = { lineNumber: 1, column: 4 };

      // Start the completion request (triggers send + registers pending callback)
      const completionPromise = provider.provideCompletionItems(mockModel, mockPosition);

      // Capture the request id from the sent message
      const lastSent = JSON.parse(
        mockWsInstance.send.mock.calls[mockWsInstance.send.mock.calls.length - 1][0]
      );
      expect(lastSent.method).toBe('textDocument/completion');

      // Simulate LSP response arriving via onmessage
      act(() => {
        mockWsInstance.onmessage?.({
          data: JSON.stringify({
            id: lastSent.id,
            result: { items: [{ label: 'self', insertText: 'self' }] },
          }),
        });
      });

      const result = await completionPromise;
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].label).toBe('self');
    });

    it('resolves with empty suggestions when provideCompletionItems is called before initialized', async () => {
      let capturedProvider: any;
      mockRegisterCompletionItemProvider.mockImplementation((_lang, provider) => {
        capturedProvider = provider;
        return { dispose: jest.fn() };
      });

      // Connect but do NOT send workspaceReady/initialized
      mountHookAndConnect();

      const mockModel = {
        getWordUntilPosition: jest.fn(() => ({ startColumn: 1, endColumn: 1 })),
      };
      const mockPosition = { lineNumber: 1, column: 1 };

      const result = await capturedProvider.provideCompletionItems(mockModel, mockPosition);
      expect(result.suggestions).toEqual([]);
    });
  });
});
