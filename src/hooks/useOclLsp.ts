import React, { useRef, useEffect, useCallback } from 'react';
import { Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

let _lspRequestId = 2; // start at 2 — id 1 is reserved for LSP initialize
function nextLspRequestId(): number {
  _lspRequestId = (_lspRequestId % 2_147_483_646) + 1;
  return _lspRequestId;
}

function markerSeverity(lspSeverity: number, monacoInstance: Monaco): monaco.MarkerSeverity {
  if (lspSeverity === 1) return monacoInstance.MarkerSeverity.Error;
  if (lspSeverity === 2) return monacoInstance.MarkerSeverity.Warning;
  return monacoInstance.MarkerSeverity.Info;
}

function resolveCompletionItems(
  monacoInstance: Monaco,
  initialized: React.MutableRefObject<boolean>,
  wsRef: React.MutableRefObject<WebSocket | null>,
  pendingRequests: React.MutableRefObject<Map<number, (msg: any) => void>>,
  sendLsp: (msg: object) => void,
  getDocUri: () => string | null,
  model: monaco.editor.ITextModel,
  position: monaco.Position,
): Promise<monaco.languages.CompletionList> {
  if (!initialized.current || wsRef.current?.readyState !== WebSocket.OPEN) {
    return Promise.resolve({ suggestions: [] });
  }
  return new Promise(resolve => {
    const wordInfo = model.getWordUntilPosition(position);
    const range = {
      startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
      startColumn: wordInfo.startColumn, endColumn: wordInfo.endColumn,
    };
    const id = nextLspRequestId();
    const timeout = setTimeout(() => { pendingRequests.current.delete(id); resolve({ suggestions: [] }); }, 2000);
    pendingRequests.current.set(id, msg => { clearTimeout(timeout); resolve(buildCompletionItems(msg, range, monacoInstance)); });
    sendLsp({ jsonrpc: '2.0', id, method: 'textDocument/completion',
      params: { textDocument: { uri: getDocUri() }, position: { line: position.lineNumber - 1, character: position.column - 1 } } });
  });
}

function buildCompletionItems(
  msg: any,
  range: { startLineNumber: number; endLineNumber: number; startColumn: number; endColumn: number },
  monacoInstance: Monaco,
) {
  const items = Array.isArray(msg.result) ? msg.result : (msg.result?.items ?? []);
  return { suggestions: items.map((item: any) => ({
    label: item.label,
    kind: item.kind ?? monacoInstance.languages.CompletionItemKind.Text,
    insertText: item.insertText ?? item.label,
    range,
  }))};
}

interface UseOclLspOptions {
  vsumId?: number;
  documentId: string;
  languageId: string;
  getCode: () => string;
}

/**
 * Connects to the VitruvOCL LSP via WebSocket and wires up
 * diagnostics + completions for a Monaco editor instance.
 * Returns an onMount handler to pass to <Editor onMount={...} />.
 */
export function useOclLsp({ vsumId, documentId, languageId, getCode }: UseOclLspOptions) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const workspaceUri = useRef<string | null>(null);
  const initialized = useRef(false);
  const versionRef = useRef(1);
  const completionDisposable = useRef<monaco.IDisposable | null>(null);
  const pendingRequests = useRef<Map<number, (msg: any) => void>>(new Map());

  const getDocUri = useCallback(
    () => workspaceUri.current ? `${workspaceUri.current}ocl-${documentId}.ocl` : null,
    [documentId]
  );

  const sendLsp = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify(msg));
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      const uri = getDocUri();
      if (uri && initialized.current) {
        sendLsp({ jsonrpc: '2.0', method: 'textDocument/didClose', params: { textDocument: { uri } } });
      }
      wsRef.current.close(1000, 'editor closed');
      wsRef.current = null;
    }
    initialized.current = false;
    workspaceUri.current = null;
    pendingRequests.current.clear();
    completionDisposable.current?.dispose();
    completionDisposable.current = null;
  }, [getDocUri, sendLsp]);

  const connect = useCallback((monacoInstance: Monaco) => {
    if (!vsumId) return;
    disconnect();

    const rawUser = localStorage.getItem('auth.user');
    const userId = rawUser ? JSON.parse(rawUser).id : null;
    if (!userId) return;

    const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://localhost:9811';
    const wsBase = apiBase.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsBase}/ocl-lsp?userId=${encodeURIComponent(userId)}&vsumId=${encodeURIComponent(vsumId)}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.id !== undefined && msg.id !== 1 && pendingRequests.current.has(msg.id)) {
          pendingRequests.current.get(msg.id)!(msg);
          pendingRequests.current.delete(msg.id);
          return;
        }

        if (msg.type === 'workspaceReady') {
          workspaceUri.current = msg.rootUri;
          ws.send(JSON.stringify({
            jsonrpc: '2.0', id: 1, method: 'initialize',
            params: {
              processId: null,
              rootUri: msg.rootUri,
              workspaceFolders: [{ uri: msg.rootUri, name: 'OclProject' }],
              capabilities: { textDocument: { completion: { completionItem: { snippetSupport: true } }, publishDiagnostics: {} } },
            },
          }));
          return;
        }

        if (msg.id === 1 && msg.result) {
          ws.send(JSON.stringify({ jsonrpc: '2.0', method: 'initialized', params: {} }));
          initialized.current = true;
          const uri = getDocUri();
          if (uri) {
            ws.send(JSON.stringify({
              jsonrpc: '2.0', method: 'textDocument/didOpen',
              params: { textDocument: { uri, languageId, version: 1, text: getCode() } },
            }));
          }
          return;
        }

        if (msg.method === 'textDocument/publishDiagnostics') {
          const model = editorRef.current?.getModel();
          if (!model) return;
          const markers = (msg.params.diagnostics || []).map((d: any) => ({
            severity: markerSeverity(d.severity, monacoInstance),
            startLineNumber: d.range.start.line + 1,
            startColumn: d.range.start.character + 1,
            endLineNumber: d.range.end.line + 1,
            endColumn: d.range.end.character + 1,
            message: d.message,
          }));
          monacoInstance.editor.setModelMarkers(model, languageId, markers);
        }
      } catch { /* ignore malformed messages */ }
    };

    ws.onclose = () => { initialized.current = false; };

    // Register completion provider (dispose old one first)
    completionDisposable.current?.dispose();
    completionDisposable.current = monacoInstance.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters: ['.', ' ', ':'],
      provideCompletionItems: (model, position) =>
        resolveCompletionItems(monacoInstance, initialized, wsRef, pendingRequests, sendLsp, getDocUri, model, position),
    });
  }, [vsumId, languageId, getDocUri, getCode, sendLsp, disconnect]);

  // Disconnect on unmount
  useEffect(() => () => disconnect(), [disconnect]);

  const notifyChange = useCallback((text: string) => {
    if (!initialized.current || wsRef.current?.readyState !== WebSocket.OPEN) return;
    versionRef.current++;
    sendLsp({ jsonrpc: '2.0', method: 'textDocument/didChange',
      params: { textDocument: { uri: getDocUri(), version: versionRef.current }, contentChanges: [{ text }] } });
  }, [getDocUri, sendLsp]);

  const onMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
    connect(monacoInstance);
  }, [connect]);

  return { onMount, notifyChange };
}
