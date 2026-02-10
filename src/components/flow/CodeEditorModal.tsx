import React, { useState, useRef, useEffect } from 'react';
import Editor, { OnMount, Monaco } from '@monaco-editor/react';
import { reactionsMonarch, reactionsTheme, reactionsLanguageConfig } from './ReactionsMonarchGrammar';
import * as monaco from 'monaco-editor';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface CodeEditorModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (code: string) => Promise<void> | void;
  readonly onDelete?: () => void;
  readonly initialCode?: string;
  readonly edgeId: string;
  readonly sourceFileName?: string;
  readonly targetFileName?: string;
  readonly vsumId?: string;
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

  return 'Failed to save reaction file';
};

const buildSaveErrorDialogMessage = (rawMessage: string): string => {
  const message = rawMessage.trim();
  if (!message) {
    return 'Failed to save reaction file. No changes were saved.';
  }
  return `${message} No changes were saved.`;
};

export function CodeEditorModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialCode = '',
  edgeId,
  sourceFileName,
  targetFileName,
  vsumId,
}: CodeEditorModalProps) {
  console.log('🏗️ CodeEditorModal render, isOpen:', isOpen);

  const [code, setCode] = useState(initialCode);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [lspConnected, setLspConnected] = useState(false);
  const lspReady = useRef(false);
  const webSocketRef = useRef<WebSocket | null>(null);
  const lspInitialized = useRef(false);
  const workspaceRootUri = useRef<string | null>(null);
  const versionCounter = useRef(1);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setCode(initialCode);
  }, [initialCode, isOpen]);

  // Cleanup beim Unmount
  useEffect(() => {
    return () => {
      if (webSocketRef.current) {
        console.log('🧹 Component unmounting - closing WebSocket cleanly');
        if (webSocketRef.current.readyState === WebSocket.OPEN ||
          webSocketRef.current.readyState === WebSocket.CONNECTING) {
          webSocketRef.current.close(1000, 'Editor closed');
        }
        webSocketRef.current = null;
      }
      lspReady.current = false;
      lspInitialized.current = false;
      setLspConnected(false);
    };
  }, []);

  // Cleanup beim Browser-Close/Refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (webSocketRef.current &&
        (webSocketRef.current.readyState === WebSocket.OPEN ||
          webSocketRef.current.readyState === WebSocket.CONNECTING)) {
        console.log('🧹 Page unloading - closing WebSocket');
        webSocketRef.current.close(1000, 'Page unloading');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Wrapper für sauberes Schließen
  const handleClose = () => {
    console.log('🚪 Modal closing - cleaning up WebSocket');
    if (webSocketRef.current) {
      if (webSocketRef.current.readyState === WebSocket.OPEN ||
        webSocketRef.current.readyState === WebSocket.CONNECTING) {
        webSocketRef.current.close(1000, 'Modal closed');
      }
      webSocketRef.current = null;
    }
    lspReady.current = false;
    lspInitialized.current = false;
    setLspConnected(false);
    setSaveErrorMessage(null);
    onClose();
  };

  // Extracted: Process LSP completion response
  const processCompletionResponse = (
    message: any,
    requestId: number,
    range: any,
    monacoInstance: Monaco
  ): any[] | null => {
    if (message.id !== requestId) {
      return null;
    }

    if (!message.result) {
      console.log('📭 No completion results');
      return null;
    }

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
        insertText: insertText,
        detail: item.detail,
        documentation: item.documentation,
        sortText: item.sortText,
        filterText: item.filterText,
        range: itemRange
      };
    });
  };

  // Extracted: Get fallback keyword suggestions
  const getFallbackSuggestions = (
    wordInfo: any,
    range: any,
    monacoInstance: Monaco
  ) => {
    const keywords = reactionsMonarch.keywords || [];
    const typedText = wordInfo.word.toLowerCase();

    return keywords
      .filter((keyword: string) =>
        keyword.toLowerCase().startsWith(typedText)
      )
      .map((keyword: string) => ({
        label: keyword,
        kind: monacoInstance.languages.CompletionItemKind.Keyword,
        insertText: keyword,
        range: range
      }));
  };

  // Extracted: Handle timeout for completion request
  const handleCompletionTimeout = (
    messageHandler: (event: MessageEvent) => void,
    wordInfo: any,
    range: any,
    monacoInstance: Monaco,
    resolve: (value: { suggestions: any[] }) => void
  ) => {
    console.log('⏰ TIMEOUT reached after 2000ms');
    webSocketRef.current?.removeEventListener('message', messageHandler);
    const suggestions = getFallbackSuggestions(wordInfo, range, monacoInstance);
    resolve({ suggestions });
  };

  // Extracted: Create message handler for completion requests
  const createCompletionMessageHandler = (
    requestId: number,
    monacoInstance: Monaco,
    range: any,
    resolve: (value: { suggestions: any[] }) => void
  ) => {
    const messageHandler = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        const suggestions = processCompletionResponse(message, requestId, range, monacoInstance);

        if (suggestions) {
          webSocketRef.current?.removeEventListener('message', messageHandler);
          resolve({ suggestions });
        }
      } catch (err) {
        console.error('💥 [messageHandler] Parse error:', err);
      }
    };

    return messageHandler;
  };

  // Extracted: Request completion from LSP server
  const requestCompletionFromLsp = (
    model: any,
    position: any,
    monacoInstance: Monaco
  ): Promise<{ suggestions: any[] }> => {
    return new Promise((resolve) => {
      if (!lspReady.current) {
        resolve({ suggestions: [] });
        return;
      }

      if (!webSocketRef.current || webSocketRef.current.readyState !== WebSocket.OPEN) {
        console.log('❌ WebSocket not open, state:', webSocketRef.current?.readyState);
        resolve({ suggestions: [] });
        return;
      }

      console.log('✅ WebSocket is open and LSP is ready');

      const wordInfo = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: wordInfo.startColumn,
        endColumn: wordInfo.endColumn
      };

      const requestId = Math.floor(Math.random() * 2147483647);
      const request = {
        jsonrpc: '2.0',
        id: requestId,
        method: 'textDocument/completion',
        params: {
          textDocument: {
            uri: `${workspaceRootUri.current}reaction-${edgeId}.reactions`,
          },
          position: {
            line: position.lineNumber - 1,
            character: position.column - 1
          },
          context: {
            triggerKind: 1
          }
        }
      };

      console.log('📤 Sending completion request:', request);

      const messageHandler = createCompletionMessageHandler(
        requestId,
        monacoInstance,
        range,
        resolve
      );

      webSocketRef.current.addEventListener('message', messageHandler);
      console.log('📤 Actually sending to WebSocket now...');
      webSocketRef.current.send(JSON.stringify(request));
      console.log('✅ Sent!');

      // Setup timeout with extracted handler
      setTimeout(
        () => handleCompletionTimeout(messageHandler, wordInfo, range, monacoInstance, resolve),
        2000
      );
    });
  };

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;

    monacoInstance.languages.register({ id: 'reactions' });
    monacoInstance.languages.setLanguageConfiguration('reactions', reactionsLanguageConfig);
    monacoInstance.languages.setMonarchTokensProvider('reactions', reactionsMonarch);

    monacoInstance.editor.defineTheme('reactions-theme', reactionsTheme);
    monacoInstance.editor.setTheme('reactions-theme');

    monacoInstance.languages.registerCompletionItemProvider('reactions', {
      triggerCharacters: ['.', ' ', '\n', ':'],
      provideCompletionItems: async (model, position) => {
        return requestCompletionFromLsp(model, position, monacoInstance);
      }
    });

    console.log('✅ Completion provider registered');
    connectToLsp(monacoInstance);
    editor.focus();
    console.log('✅ Editor setup complete');
  };

  const sendInitialize = (rootUri: string, webSocket: WebSocket) => {
    if (!rootUri) {
      console.error('❌ No rootUri available');
      return;
    }

    const initMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        processId: null,
        rootUri: rootUri,
        workspaceFolders: [
          {
            uri: rootUri,
            name: "UserProject"
          }
        ],
        capabilities: {
          textDocument: {
            completion: {
              completionItem: {
                snippetSupport: true,
                documentationFormat: ['markdown', 'plaintext']
              },
              contextSupport: true
            },
            hover: {
              contentFormat: ['markdown', 'plaintext']
            },
            signatureHelp: {},
            definition: {},
            references: {},
            documentSymbol: {},
          }
        }
      }
    };

    webSocket.send(JSON.stringify(initMessage));
  };

  const getDiagnosticSeverity = (severityCode: number, monacoInstance: Monaco) => {
    if (severityCode === 1) {
      return monacoInstance.MarkerSeverity.Error;
    }
    if (severityCode === 2) {
      return monacoInstance.MarkerSeverity.Warning;
    }
    return monacoInstance.MarkerSeverity.Info;
  };

  const connectToLsp = (monacoInstance: Monaco) => {
    console.log('🔌 connectToLsp called');
    try {
      const rawUser = localStorage.getItem('auth.user');
      const userId = rawUser ? JSON.parse(rawUser).id : null;

      if (!userId) {
        console.error('❌ No userId available – aborting LSP connection');
        return;
      }

      if (!vsumId) {
        console.error('❌ No vsumId available – aborting LSP connection');
        return;
      }

      // WebSocket URL aus API_BASE_URL ableiten
      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:9811';
      const wsBaseUrl = apiBaseUrl
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');

      const wsUrl = `${wsBaseUrl}/lsp?userId=${encodeURIComponent(userId)}&vsumId=${encodeURIComponent(vsumId)}`;

      console.log('🔌 Connecting to LSP at:', wsUrl);

      const webSocket = new WebSocket(wsUrl);
      webSocketRef.current = webSocket;

      console.log('🔌 WebSocket created, initial readyState:', webSocket.readyState);

      webSocket.onopen = () => {
        console.log('✅ WebSocket OPENED! readyState:', webSocket.readyState);
        setLspConnected(true);
      };

      webSocket.onmessage = (event) => {
        console.log('📩 WebSocket message received:', event.data);
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'workspaceReady') {
            console.log('✅ workspaceReady received, rootUri:', message.rootUri);
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
            console.log('📊 Diagnostics received');
            const diagnostics = message.params.diagnostics || [];
            const markers = diagnostics.map((diag: any) => ({
              severity: getDiagnosticSeverity(diag.severity, monacoInstance),
              startLineNumber: diag.range.start.line + 1,
              startColumn: diag.range.start.character + 1,
              endLineNumber: diag.range.end.line + 1,
              endColumn: diag.range.end.character + 1,
              message: diag.message,
              code: diag.code
            }));

            const model = editorRef.current?.getModel();
            if (model) {
              monacoInstance.editor.setModelMarkers(model, 'reactions', markers);
            }
          }

          if (message.id === 1 && message.result) {
            console.log('✅ Initialize response received');
            lspInitialized.current = true;
            webSocket.send(JSON.stringify({
              jsonrpc: '2.0',
              method: 'initialized',
              params: {}
            }));

            console.log('📤 Sent initialized notification');

            if (editorRef.current) {
              console.log('📤 Sending didOpen notification');
              webSocket.send(JSON.stringify({
                jsonrpc: '2.0',
                method: 'textDocument/didOpen',
                params: {
                  textDocument: {
                    uri: `${workspaceRootUri.current}reaction-${edgeId}.reactions`,
                    languageId: 'reactions',
                    version: 1,
                    text: code
                  }
                }
              }));
              lspReady.current = true;
              console.log('✅ LSP is now READY');
            } else {
              console.error('❌ editorRef.current is null!');
            }
          }

        } catch (err) {
          console.error('💥 Failed to parse LSP message:', err);
        }
      };

      webSocket.onerror = (error) => {
        console.error('❌ LSP WebSocket ERROR:', error);
        console.error('WebSocket state at error:', webSocket.readyState);
        console.error('WebSocket URL was:', wsUrl);
        setLspConnected(false);
        lspReady.current = false;
      };

      webSocket.onclose = (event) => {
        console.error('❌ WebSocket CLOSED:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        setLspConnected(false);
        lspReady.current = false;
        lspInitialized.current = false;
      };

    } catch (err) {
      console.error('💥 Failed to connect to LSP:', err);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    try {
      setSaving(true);
      await onSave(code);
      handleClose(); // ✅ Statt onClose()
    } catch (err) {
      console.error('Failed to save reaction', err);
      const message = extractSaveErrorMessage(err);
      setSaveErrorMessage(buildSaveErrorDialogMessage(message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleUndo = () => {
    editorRef.current?.trigger('keyboard', 'undo', null);
  };

  const handleRedo = () => {
    editorRef.current?.trigger('keyboard', 'redo', null);
  };

  const handleFormat = () => {
    editorRef.current?.getAction('editor.action.formatDocument')?.run();
  };

  const handleClear = () => {
    setShowClearDialog(true);
  };

  if (!isOpen) {
    return null;
  }

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
      onClose={handleClose} // ✅ Statt onClose
      onCancel={handleClose} // ✅ Statt onClose
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }} // ✅ Statt onClose
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
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #333',
            backgroundColor: '#252526',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 id="code-editor-title" style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 600 }}>
              Reaction Editor
              {lspConnected && (
                <span style={{ marginLeft: '12px', color: lspReady.current ? '#0e7a0d' : '#ff9800', fontSize: '14px' }}>
                  ● {lspReady.current ? 'LSP Ready' : 'LSP Initializing...'}
                </span>
              )}
            </h3>
            {sourceFileName && targetFileName && (
              <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '16px' }}>
                {sourceFileName} ↔ {targetFileName}
              </p>
            )}
          </div>
          <button
            onClick={handleClose} // ✅ Statt onClose
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px 8px',
              lineHeight: 1,
            }}
            title="Schließen (Esc)"
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid #333',
            backgroundColor: '#2d2d2d',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={handleUndo}
            style={createButtonStyles('#0e639c')}
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button
            onClick={handleRedo}
            style={createButtonStyles('#0e639c')}
            title="Redo (Ctrl+Shift+Z)"
          >
            ↷ Redo
          </button>
          <div style={{ width: '1px', backgroundColor: '#444', margin: '0 4px' }} />
          <button
            onClick={handleFormat}
            style={createButtonStyles('#0e639c')}
            title="Format code"
          >
            Format
          </button>
          <button
            onClick={handleClear}
            style={createButtonStyles('#c72e2e')}
            title="Delete all"
          >
            🗑 Clear
          </button>
          <div style={{ flex: 1 }} />
          {onDelete && (
            <button
              onClick={handleDelete}
              style={{
                ...buttonBaseStyles,
                padding: '6px 20px',
                backgroundColor: '#8b0000',
                color: '#fff',
                fontWeight: 600,
              }}
              title="Delete relation"
            >
              🗑️ Delete Relation
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              ...buttonBaseStyles,
              padding: '6px 20px',
              backgroundColor: saving ? '#0b5e0b' : '#0e7a0d',
              color: '#fff',
              fontWeight: 600,
            }}
            title="Save (Ctrl+S)"
          >
            {saving ? 'Saving…' : '💾 Save'}
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Editor
            height="100%"
            language="reactions"
            theme="vs-dark"
            value={code}
            onChange={(value) => {
              setCode(value || '');

              if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN && lspInitialized.current) {
                versionCounter.current++;

                const didChangeMessage = {
                  jsonrpc: '2.0',
                  method: 'textDocument/didChange',
                  params: {
                    textDocument: {
                      uri: `${workspaceRootUri.current}reaction-${edgeId}.reactions`,
                      version: versionCounter.current
                    },
                    contentChanges: [
                      {
                        text: value || ''
                      }
                    ]
                  }
                };
                webSocketRef.current.send(JSON.stringify(didChangeMessage));
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
              suggest: {
                showKeywords: true,
                showSnippets: true,
              },
              autoClosingBrackets: 'always',
              autoClosingQuotes: 'always',
              autoSurround: 'languageDefined',
            }}
          />
        </div>

        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid #333',
            backgroundColor: '#252526',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ color: '#888', fontSize: '12px' }}>
            {code.split('\n').length} Zeilen · {code.length} Zeichen
          </div>
          <div style={{ color: '#888', fontSize: '12px' }}>
            Edge ID: {edgeId}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Delete Relation"
        message="Do you want to delete this relation? Note: this action cannot be reverted!"
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          onDelete?.();
          handleClose(); // ✅ Statt onClose()
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
        onConfirm={() => {
          setCode('');
          setShowClearDialog(false);
        }}
        onCancel={() => setShowClearDialog(false)}
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
