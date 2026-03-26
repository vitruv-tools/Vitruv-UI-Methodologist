import React, { useState, useRef, useEffect, useCallback } from 'react';
import Editor, { OnMount, Monaco } from '@monaco-editor/react';
import { reactionsMonarch, reactionsTheme, reactionsLanguageConfig } from './ReactionsMonarchGrammar';
import * as monaco from 'monaco-editor';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface CodeEditorModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (code: string) => Promise<void> | void;
  readonly onInitialize?: (code: string) => Promise<void> | void;
  readonly onDelete?: () => void;
  readonly initialCode?: string;
  readonly edgeId: string;
  readonly sourceFileName?: string;
  readonly targetFileName?: string;
  readonly vsumId?: string;
  // Generic LSP / language props
  readonly lspEndpoint?: string;
  readonly languageId?: string;
  readonly fileExtension?: string;
  readonly monarchGrammar?: any;
  readonly languageConfig?: any;
  readonly theme?: any;
  readonly title?: string;
}

const buttonBaseStyles = {
  padding: '6px 12px',
  border: 'none',
  borderRadius: '4px',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
} as const;

const createButtonStyles = (
  backgroundColor: string,
  color: string = '#fff',
  disabled: boolean = false
) => ({
  ...buttonBaseStyles,
  backgroundColor: disabled ? '#333' : backgroundColor,
  color: disabled ? '#666' : color,
  cursor: disabled ? 'not-allowed' : 'pointer',
});

const extractSaveErrorMessage = (err: unknown): string => {
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }

  const responseData = (err as any)?.response?.data;
  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData;
  }
  if (responseData && typeof responseData === 'object') {
    const message = responseData.message ?? responseData.error;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return 'Failed to save file';
};

const buildSaveErrorDialogMessage = (rawMessage: string): string => {
  const message = rawMessage.trim();
  if (!message) {
    return 'Failed to save file. No changes were saved.';
  }
  return `${message} No changes were saved.`;
};

export function CodeEditorModal({
  isOpen,
  onClose,
  onSave,
  onInitialize,
  onDelete,
  initialCode = '',
  edgeId,
  sourceFileName,
  targetFileName,
  vsumId,
  lspEndpoint = '/lsp',
  languageId = 'reactions',
  fileExtension = '.reactions',
  monarchGrammar,
  languageConfig,
  theme,
  title = 'Code Editor',
}: CodeEditorModalProps) {
  const [code, setCode] = useState(initialCode);
  const [savedCode, setSavedCode] = useState(initialCode);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [lspConnected, setLspConnected] = useState(false);
  const [lspReady, setLspReady] = useState(false);
  const [lspError, setLspError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const webSocketRef = useRef<WebSocket | null>(null);
  const lspInitialized = useRef(false);
  const lspReadyRef = useRef(false);
  const workspaceRootUri = useRef<string | null>(null);
  const versionCounter = useRef(1);
  const pendingCloseRef = useRef(false);

  // FIX: Centralized pending request map instead of addEventListener
  const pendingRequests = useRef<Map<number, (msg: any) => void>>(new Map());

  // FIX: Single source of truth for document URI
  const getDocumentUri = useCallback(
    () => `${workspaceRootUri.current}reaction-${edgeId}${fileExtension}`,
    [edgeId, fileExtension]
  );

  const setLspReadyBoth = (value: boolean) => {
    lspReadyRef.current = value;
    setLspReady(value);
  };

  const hasUnsavedChanges = code !== savedCode;

  const closeWebSocket = useCallback(() => {
    if (webSocketRef.current) {
      if (
        webSocketRef.current.readyState === WebSocket.OPEN ||
        webSocketRef.current.readyState === WebSocket.CONNECTING
      ) {
        webSocketRef.current.close(1000, 'Editor closed');
      }
      webSocketRef.current = null;
    }
    setLspReadyBoth(false);
    lspInitialized.current = false;
    pendingRequests.current.clear();
    setLspConnected(false);
  }, []);

  useEffect(() => {
    setCode(initialCode);
    setSavedCode(initialCode);
    setSaveSuccess(false);
  }, [initialCode, isOpen]);

  useEffect(() => {
    if (isOpen && onInitialize) {
      const result = onInitialize(initialCode);
      if (result instanceof Promise) {
        result.catch((err: unknown) => {
          console.error('Failed to initialize file:', err);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    return () => { closeWebSocket(); };
  }, [closeWebSocket]);

  useEffect(() => {
    const handleBeforeUnload = () => closeWebSocket();
    globalThis.addEventListener('beforeunload', handleBeforeUnload);
    return () => globalThis.removeEventListener('beforeunload', handleBeforeUnload);
  }, [closeWebSocket]);

  // Ctrl+S shortcut
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, code, saving]);

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      pendingCloseRef.current = true;
      setShowUnsavedDialog(true);
      return;
    }
    doClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnsavedChanges]);

  const doClose = () => {
    closeWebSocket();
    setSaveErrorMessage(null);
    setSaveSuccess(false);
    pendingCloseRef.current = false;
    onClose();
  };

  // Process LSP completion response
  const processCompletionResponse = (
    message: any,
    range: any,
    monacoInstance: Monaco
  ): any[] => {
    if (!message.result) return [];

    const items = Array.isArray(message.result)
      ? message.result
      : message.result.items || [];

    return items.map((item: any) => {
      let insertText = item.insertText || item.label;
      let itemRange = range;

      if (item.textEdit) {
        insertText = item.textEdit.newText;
        if (item.textEdit.range) {
          itemRange = {
            startLineNumber: item.textEdit.range.start.line + 1,
            endLineNumber: item.textEdit.range.end.line + 1,
            startColumn: item.textEdit.range.start.character + 1,
            endColumn: item.textEdit.range.end.character + 1
          };
        }
      }

      return {
        label: item.label,
        kind: item.kind || monacoInstance.languages.CompletionItemKind.Text,
        insertText,
        detail: item.detail,
        documentation: item.documentation,
        sortText: item.sortText,
        filterText: item.filterText,
        range: itemRange
      };
    });
  };

  const getFallbackSuggestions = (wordInfo: any, range: any, monacoInstance: Monaco) => {
    const grammar = monarchGrammar || reactionsMonarch;
    const keywords = grammar.keywords || [];
    const typedText = wordInfo.word.toLowerCase();
    return keywords
      .filter((keyword: string) => keyword.toLowerCase().startsWith(typedText))
      .map((keyword: string) => ({
        label: keyword,
        kind: monacoInstance.languages.CompletionItemKind.Keyword,
        insertText: keyword,
        range,
      }));
  };

  const requestCompletionFromLsp = (
    model: any,
    position: any,
    monacoInstance: Monaco
  ): Promise<{ suggestions: any[] }> => {
    return new Promise((resolve) => {
      if (!lspReadyRef.current) { resolve({ suggestions: [] }); return; }
      if (!webSocketRef.current || webSocketRef.current.readyState !== WebSocket.OPEN) {
        resolve({ suggestions: [] }); return;
      }

      const wordInfo = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: wordInfo.startColumn,
        endColumn: wordInfo.endColumn,
      };

      const requestId = Math.floor(Math.random() * 2147483647);
      const request = {
        jsonrpc: '2.0',
        id: requestId,
        method: 'textDocument/completion',
        params: {
          textDocument: { uri: getDocumentUri() },
          position: { line: position.lineNumber - 1, character: position.column - 1 },
          context: { triggerKind: 1 },
        },
      };

      const timeoutId = setTimeout(() => {
        if (pendingRequests.current.has(requestId)) {
          pendingRequests.current.delete(requestId);
          resolve({ suggestions: getFallbackSuggestions(wordInfo, range, monacoInstance) });
        }
      }, 2000);

      pendingRequests.current.set(requestId, (message) => {
        clearTimeout(timeoutId);
        const suggestions = processCompletionResponse(message, range, monacoInstance);
        resolve({ suggestions });
      });

      webSocketRef.current.send(JSON.stringify(request));
    });
  };

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    console.log('🎯 handleEditorDidMount called');
    editorRef.current = editor;

    const grammar = monarchGrammar || reactionsMonarch;
    const config = languageConfig || reactionsLanguageConfig;
    const editorTheme = theme || reactionsTheme;
    const themeName = `${languageId}-theme`;

    monacoInstance.languages.register({ id: languageId });
    monacoInstance.languages.setLanguageConfiguration(languageId, config);
    monacoInstance.languages.setMonarchTokensProvider(languageId, grammar);
    monacoInstance.editor.defineTheme(themeName, editorTheme);
    monacoInstance.editor.setTheme(themeName);

    monacoInstance.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters: ['.', ' ', '\n', ':'],
      provideCompletionItems: async (model, position) =>
        requestCompletionFromLsp(model, position, monacoInstance),
    });

    connectToLsp(monacoInstance);
    editor.focus();
  };

  const sendInitialize = (rootUri: string, webSocket: WebSocket) => {
    if (!rootUri) return;
    webSocket.send(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        processId: null,
        rootUri,
        workspaceFolders: [{ uri: rootUri, name: 'UserProject' }],
        capabilities: {
          textDocument: {
            completion: {
              completionItem: { snippetSupport: true, documentationFormat: ['markdown', 'plaintext'] },
              contextSupport: true,
            },
            hover: { contentFormat: ['markdown', 'plaintext'] },
            signatureHelp: {},
            definition: {},
            references: {},
            documentSymbol: {},
          },
        },
      },
    }));
  };

  const getDiagnosticSeverity = (severityCode: number, monacoInstance: Monaco) => {
    if (severityCode === 1) return monacoInstance.MarkerSeverity.Error;
    if (severityCode === 2) return monacoInstance.MarkerSeverity.Warning;
    return monacoInstance.MarkerSeverity.Info;
  };

  const connectToLsp = (monacoInstance: Monaco) => {
    try {
      const rawUser = localStorage.getItem('auth.user');
      const userId = rawUser ? JSON.parse(rawUser).id : null;
      console.log('🔑 rawUser:', rawUser);
      console.log('🔑 vsumId:', vsumId);
      if (!userId) {
        console.error('❌ No userId available – aborting LSP connection');
        return;
      }
      if (!vsumId) {
        console.error('❌ No vsumId available – aborting LSP connection');
        return;
      }

      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:9811';
      const wsBaseUrl = apiBaseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
      const wsUrl = `${wsBaseUrl}${lspEndpoint}?userId=${encodeURIComponent(userId)}&vsumId=${encodeURIComponent(vsumId)}`;

      console.log('🔌 Connecting to LSP at:', wsUrl);

      const webSocket = new WebSocket(wsUrl);
      webSocketRef.current = webSocket;

      webSocket.onopen = () => {
        setLspConnected(true);
        setLspError(null);
      };

      // Single onmessage with centralized routing via pendingRequests map
      webSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Route to pending request handler (completion, hover, etc.)
          // id === 1 is reserved for initialize, handled separately below
          if (message.id !== undefined && message.id !== 1 && pendingRequests.current.has(message.id)) {
            const handler = pendingRequests.current.get(message.id)!;
            pendingRequests.current.delete(message.id);
            handler(message);
            return;
          }

          if (message.type === 'workspaceReady') {
            const rootUri = message.rootUri;
            if (!rootUri) {
              console.error('❌ workspaceReady message contains no rootUri');
              return;
            }
            workspaceRootUri.current = rootUri;
            sendInitialize(rootUri, webSocket);
            return;
          }

          if (message.method === 'textDocument/publishDiagnostics') {
            const diagnostics = message.params.diagnostics || [];
            const markers = diagnostics.map((diag: any) => ({
              severity: getDiagnosticSeverity(diag.severity, monacoInstance),
              startLineNumber: diag.range.start.line + 1,
              startColumn: diag.range.start.character + 1,
              endLineNumber: diag.range.end.line + 1,
              endColumn: diag.range.end.character + 1,
              message: diag.message,
              code: diag.code,
            }));
            const model = editorRef.current?.getModel();
            if (model) monacoInstance.editor.setModelMarkers(model, languageId, markers);
            return;
          }

          if (message.id === 1 && message.result) {
            lspInitialized.current = true;
            webSocket.send(JSON.stringify({ jsonrpc: '2.0', method: 'initialized', params: {} }));

            if (editorRef.current) {
              webSocket.send(JSON.stringify({
                jsonrpc: '2.0',
                method: 'textDocument/didOpen',
                params: {
                  textDocument: {
                    uri: getDocumentUri(),
                    languageId,
                    version: 1,
                    // Use current editor value to avoid stale closure
                    text: editorRef.current.getValue(),
                  },
                },
              }));
              setLspReadyBoth(true);
            } else {
              console.error('❌ editorRef.current is null!');
            }
          }
        } catch (err) {
          console.error('💥 Failed to parse LSP message:', err);
        }
      };

      webSocket.onerror = () => {
        setLspConnected(false);
        setLspReadyBoth(false);
        setLspError('LSP connection failed — completions and validation unavailable');
      };

      webSocket.onclose = (event) => {
        setLspConnected(false);
        setLspReadyBoth(false);
        lspInitialized.current = false;
        pendingRequests.current.clear();
        if (event.code !== 1000) {
          setLspError(`LSP disconnected (code ${event.code}) — try reopening the editor`);
        }
      };
    } catch (err) {
      console.error('💥 Failed to connect to LSP:', err);
      setLspError('LSP failed to start');
    }
  };

  const handleSave = async () => {
    if (saving) return;
    try {
      setSaving(true);
      setSaveSuccess(false);
      await onSave(code);
      setSavedCode(code);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save file', err);
      const message = extractSaveErrorMessage(err);
      setSaveErrorMessage(buildSaveErrorDialogMessage(message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => setShowDeleteDialog(true);
  const handleUndo = () => editorRef.current?.trigger('keyboard', 'undo', null);
  const handleRedo = () => editorRef.current?.trigger('keyboard', 'redo', null);
  const handleFormat = () => editorRef.current?.getAction('editor.action.formatDocument')?.run();
  const handleClear = () => setShowClearDialog(true);

  const executeClear = () => {
    const editor = editorRef.current;
    if (editor) {
      editor.focus();
      editor.trigger('keyboard', 'editor.action.selectAll', null);
      editor.trigger('keyboard', 'deleteLeft', null);
    } else {
      setCode('');
    }
    setShowClearDialog(false);
  };

  const renderLspStatus = () => {
    if (lspConnected) {
      return (
        <span
          style={{ marginLeft: '12px', color: lspReady ? '#0e7a0d' : '#ff9800', fontSize: '14px', cursor: 'default' }}
          title={lspReady
            ? 'Language Server is ready — completions and validation active'
            : 'Language Server is initializing — completions not yet available'}
        >
          ● {lspReady ? 'LSP Ready' : 'LSP Initializing...'}
        </span>
      );
    }
    if (lspError) {
      return (
        <span
          style={{ marginLeft: '12px', color: '#f44747', fontSize: '14px', cursor: 'default' }}
          title={`${lspError} — Syntax highlighting still works`}
        >
          ● LSP Error
        </span>
      );
    }
    return (
      <span
        style={{ marginLeft: '12px', color: '#555', fontSize: '14px', cursor: 'default' }}
        title="Language Server not connected"
      >
        ● LSP Offline
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <dialog
      open
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
        border: 'none',
        padding: 0,
        margin: 0,
        width: '100%',
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
      }}
      onClose={handleClose}
      onCancel={handleClose}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        aria-labelledby="code-editor-title"
        style={{
          backgroundColor: '#1e1e1e',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '1200px',
          height: '85vh',
          maxHeight: '900px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #333',
          backgroundColor: '#252526',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h3 id="code-editor-title" style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 600 }}>
              {title}
              {renderLspStatus()}
            </h3>
            {sourceFileName && targetFileName && (
              <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '16px' }}>
                {sourceFileName} ↔ {targetFileName}
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '24px', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* Toolbar */}
        <div style={{
          padding: '12px 24px',
          borderBottom: '1px solid #333',
          backgroundColor: '#2d2d2d',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          <button onClick={handleUndo} style={createButtonStyles('#0e639c')} title="Undo (Ctrl+Z)">↶ Undo</button>
          <button onClick={handleRedo} style={createButtonStyles('#0e639c')} title="Redo (Ctrl+Shift+Z)">↷ Redo</button>
          <div style={{ width: '1px', backgroundColor: '#444', margin: '0 4px' }} />
          <button onClick={handleFormat} style={createButtonStyles('#0e639c')} title="Format code">Format</button>
          <button onClick={handleClear} style={createButtonStyles('#c72e2e')} title="Clear all code">🗑 Clear</button>
          <div style={{ flex: 1 }} />

          {saveSuccess && (
            <span style={{ color: '#0e7a0d', fontSize: '13px', fontWeight: 500 }}>✓ Saved</span>
          )}

          {onDelete && (
            <button
              onClick={handleDelete}
              style={{ ...buttonBaseStyles, padding: '6px 20px', backgroundColor: '#8b0000', color: '#fff', fontWeight: 600 }}
              title="Delete relation"
            >
              🗑️ Delete Relation
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ ...buttonBaseStyles, padding: '6px 20px', backgroundColor: saving ? '#0b5e0b' : '#0e7a0d', color: '#fff', fontWeight: 600 }}
            title="Save (Ctrl+S)"
          >
            {saving ? 'Saving…' : '💾 Save'}
          </button>
        </div>

        {/* Editor */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Editor
            height="100%"
            language={languageId}
            theme="vs-dark"
            value={code}
            onChange={(value) => {
              setCode(value || '');
              setSaveSuccess(false);

              if (webSocketRef.current?.readyState === WebSocket.OPEN && lspInitialized.current) {
                versionCounter.current++;
                webSocketRef.current.send(JSON.stringify({
                  jsonrpc: '2.0',
                  method: 'textDocument/didChange',
                  params: {
                    textDocument: {
                      uri: getDocumentUri(),
                      version: versionCounter.current,
                    },
                    contentChanges: [{ text: value || '' }],
                  },
                }));
              }
            }}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: true },
              fontSize: 13,
              lineNumbers: 'on',
              roundedSelection: false,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'off',
              formatOnPaste: true,
              formatOnType: true,
              suggest: { showKeywords: true, showSnippets: true },
              autoClosingBrackets: 'always',
              autoClosingQuotes: 'always',
              autoSurround: 'languageDefined',
            }}
          />
        </div>

        {/* Status bar */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid #333',
          backgroundColor: '#252526',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ color: '#888', fontSize: '12px' }}>
            {code.split('\n').length} Lines · {code.length} Characters
            {hasUnsavedChanges && (
              <span style={{ marginLeft: '10px', color: '#ff9800' }}>● Unsaved changes</span>
            )}
          </div>
          <div style={{ color: '#888', fontSize: '12px' }}>Edge ID: {edgeId}</div>
        </div>
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Delete Relation"
        message="Do you want to delete this relation? Note: this action cannot be reverted!"
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          onDelete?.();
          doClose();
          setShowDeleteDialog(false);
        }}
        onCancel={() => setShowDeleteDialog(false)}
      />

      <ConfirmDialog
        isOpen={showClearDialog}
        title="Clear Code"
        message="Do you want to delete all the code in this editor?"
        confirmText="Clear All"
        cancelText="Cancel"
        variant="danger"
        onConfirm={executeClear}
        onCancel={() => setShowClearDialog(false)}
      />

      <ConfirmDialog
        isOpen={showUnsavedDialog}
        title="Unsaved Changes"
        message="You have unsaved changes. Are you sure you want to close without saving?"
        confirmText="Close without saving"
        cancelText="Keep editing"
        variant="danger"
        onConfirm={() => {
          setShowUnsavedDialog(false);
          doClose();
        }}
        onCancel={() => {
          setShowUnsavedDialog(false);
          pendingCloseRef.current = false;
        }}
      />

      <ConfirmDialog
        isOpen={saveErrorMessage !== null}
        title="Unable to save file"
        message={saveErrorMessage ?? ''}
        confirmText="OK"
        singleAction
        variant="danger"
        onConfirm={() => setSaveErrorMessage(null)}
        onCancel={() => setSaveErrorMessage(null)}
      />
    </dialog>
  );
}