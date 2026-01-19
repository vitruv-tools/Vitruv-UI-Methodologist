import React, { useState, useRef, useEffect } from 'react';
import Editor, { OnMount, Monaco } from '@monaco-editor/react';
import { reactionsMonarch, reactionsTheme, reactionsLanguageConfig } from './ReactionsMonarchGrammar';
import * as monaco from 'monaco-editor';

interface CodeEditorModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (code: string) => Promise<void> | void;
  readonly onDelete?: () => void;
  readonly initialCode?: string;
  readonly edgeId: string;
  readonly sourceFileName?: string;
  readonly targetFileName?: string;
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

export function CodeEditorModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialCode = '',
  edgeId,
  sourceFileName,
  targetFileName,
}: CodeEditorModalProps) {
  console.log('🏗️ CodeEditorModal render, isOpen:', isOpen);

  const [code, setCode] = useState(initialCode);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [lspConnected, setLspConnected] = useState(false);
  const lspReady = useRef(false); // ✅ NEU
  const webSocketRef = useRef<WebSocket | null>(null);
  const lspInitialized = useRef(false);
  const workspaceRootUri = useRef<string | null>(null);

  const versionCounter = useRef(1);

  useEffect(() => {
    console.log('📝 Code changed, initialCode:', initialCode.substring(0, 50));
    setCode(initialCode);
  }, [initialCode, isOpen]);

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    console.log('🎨 Editor mounted!');
    editorRef.current = editor;

    console.log('📋 Registering reactions language...');
    monacoInstance.languages.register({ id: 'reactions' });
    monacoInstance.languages.setLanguageConfiguration('reactions', reactionsLanguageConfig);
    monacoInstance.languages.setMonarchTokensProvider('reactions', reactionsMonarch);
    console.log('✅ Language registered');

    monacoInstance.editor.defineTheme('reactions-theme', reactionsTheme);
    monacoInstance.editor.setTheme('reactions-theme');

    console.log('🔌 Registering completion provider...');
    monacoInstance.languages.registerCompletionItemProvider('reactions', {
      triggerCharacters: ['.', ' ', '\n'],
      provideCompletionItems: async (model, position) => {
        console.log('🎯 provideCompletionItems CALLED at position:', position);

        return new Promise((resolve) => {
          // ✅ KORREKTUR: lspReady.current statt lspReady
          if (!lspReady.current) {
            console.log('⏳ LSP not ready yet, returning empty suggestions');
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
          console.log('📝 Word info:', wordInfo);

          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: wordInfo.startColumn,
            endColumn: wordInfo.endColumn
          };
          console.log('📏 Range:', range);

          const requestId = Math.floor(Math.random() * 2147483647);
          console.log('🆔 Generated requestId:', requestId);

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

          const messageHandler = (event: MessageEvent) => {
            console.log('📨 [messageHandler] Triggered with event:', event.data);
            try {
              const message = JSON.parse(event.data);
              console.log('📨 [messageHandler] Parsed message:', message);
              console.log('📨 [messageHandler] Message ID:', message.id, 'Expected:', requestId);

              if (message.id === requestId) {
                console.log('🎉 [messageHandler] ID MATCH!');

                if (message.result) {
                  console.log('🎯 [messageHandler] Got result:', message.result);

                  const items = Array.isArray(message.result)
                    ? message.result
                    : message.result.items || [];

                  console.log('📋 [messageHandler] Items count:', items.length);

                  const suggestions = items.map((item: any, idx: number) => {
                    console.log(`  Item ${idx}:`, item.label, item.kind);

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

                  console.log('✅ [messageHandler] Returning', suggestions.length, 'suggestions');
                  webSocketRef.current?.removeEventListener('message', messageHandler);
                  resolve({ suggestions });
                } else {
                  console.log('⚠️ [messageHandler] No result in message');
                }
              } else {
                console.log('⏭️ [messageHandler] ID mismatch, ignoring');
              }
            } catch (err) {
              console.error('💥 [messageHandler] Parse error:', err);
            }
          };

          console.log('👂 Adding message event listener');
          webSocketRef.current.addEventListener('message', messageHandler);

          console.log('📤 Actually sending to WebSocket now...');
          webSocketRef.current.send(JSON.stringify(request));
          console.log('✅ Sent!');

          setTimeout(() => {
            console.log('⏰ TIMEOUT reached after 2000ms');
            console.log('🧹 Removing messageHandler');
            webSocketRef.current?.removeEventListener('message', messageHandler);

            const keywords = reactionsMonarch.keywords || [];
            const typedText = wordInfo.word.toLowerCase();

            console.log('🔤 Filtering keywords, typed:', typedText);
            const suggestions = keywords
              .filter((keyword: string) =>
                keyword.toLowerCase().startsWith(typedText)
              )
              .map((keyword: string) => ({
                label: keyword,
                kind: monacoInstance.languages.CompletionItemKind.Keyword,
                insertText: keyword,
                range: range
              }));

            console.log('📋 Fallback keywords count:', suggestions.length);
            resolve({ suggestions });
          }, 2000);
        });
      }


    });



    console.log('✅ Completion provider registered');

    connectToLsp(monacoInstance);

    editor.focus();
    console.log('✅ Editor setup complete');
  };

  console.log('🔍 localStorage:', localStorage);
  console.log('🔍 userId from localStorage:', localStorage.getItem('auth.user'));

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

    console.log('📤 Sending initialize message with rootUri:', rootUri);
    webSocket.send(JSON.stringify(initMessage));
    console.log('✅ Initialize sent');
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

      const wsUrl = `ws://localhost:9811/lsp?userId=${encodeURIComponent(userId)}`;

      console.log('🌐 Creating WebSocket to:', wsUrl);
      const webSocket = new WebSocket(wsUrl);

      webSocketRef.current = webSocket;

      // RAW message logger
      webSocket.addEventListener('message', (event) => {
        console.log('🔵 RAW WebSocket Message received:', event.data);
      });

      webSocket.onopen = () => {
        console.log('✅ LSP WebSocket OPENED');
        setLspConnected(true);

        console.log('⏳ Waiting for workspaceReady message from backend...');
      };

      webSocket.onmessage = (event) => {
        console.log('📥 onmessage handler triggered');

        try {
          const message = JSON.parse(event.data);
          console.log('📨 Parsed message in onmessage:', message);

          // ✅ Auf workspaceReady warten
          if (message.type === 'workspaceReady') {
            const rootUri = message.rootUri;


            if (!rootUri) {
              console.error('❌ workspaceReady message contains no rootUri');
              return;
            }

            workspaceRootUri.current = rootUri;
            console.log('📁 Got rootUri from backend:', workspaceRootUri.current);

            // JETZT erst Initialize senden
            sendInitialize(rootUri, webSocket);
            return;
          }

          if (message.method === 'textDocument/publishDiagnostics') {
            console.log('🔴 Diagnostics received:', message.params.diagnostics);

            const diagnostics = message.params.diagnostics || [];
            const markers = diagnostics.map((diag: any) => ({
              severity: diag.severity === 1 ? monacoInstance.MarkerSeverity.Error :
                diag.severity === 2 ? monacoInstance.MarkerSeverity.Warning :
                  monacoInstance.MarkerSeverity.Info,
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
              console.log('✅ Markers set:', markers.length);
            }
          }

          if (message.id === 1 && message.result) {
            console.log('🎉 Initialize response received!');
            console.log('🔧 Capabilities:', message.result.capabilities);
            lspInitialized.current = true;

            console.log('📤 Sending initialized notification');
            webSocket.send(JSON.stringify({
              jsonrpc: '2.0',
              method: 'initialized',
              params: {}
            }));

            if (editorRef.current) {
              console.log('📤 Sending didOpen notification');
              console.log('📤 Current code length:', code.length);  // ✅ DEBUG
              console.log('📤 Edge ID:', edgeId);  // ✅ DEBUG
              console.log('📤 Workspace Root URI:', workspaceRootUri.current);  // ✅ Debug!

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
              console.log('✅ didOpen sent');

              // ✅ NEU: Jetzt ist LSP komplett bereit!
              console.log('🚀 Setting lspReady to TRUE');  // ✅ DEBUG
              lspReady.current = true;
              console.log('🚀 Setting lspReady to TRUE');
              console.log('✅ LSP is now fully ready for completions');
            } else {
              console.error('❌ editorRef.current is null!');  // ✅ DEBUG
            }
          }

          if (message.result && (message.result.items || Array.isArray(message.result))) {
            console.log('🎯 Got completion items in onmessage:', message.result);
          }

        } catch (err) {
          console.error('💥 Failed to parse LSP message:', err);
        }
      };

      webSocket.onerror = (error) => {
        console.error('❌ LSP WebSocket ERROR:', error);
        setLspConnected(false);
        lspReady.current = false;
        console.log('🚀 Setting lspReady to TRUE');
      };

      webSocket.onclose = () => {
        console.log('🔴 LSP WebSocket CLOSED');
        setLspConnected(false);
        lspReady.current = false;
        console.log('🚀 Setting lspReady to TRUE');
        lspInitialized.current = false;
      };

    } catch (err) {
      console.error('💥 Failed to connect to LSP:', err);
    }
  };

  useEffect(() => {
    console.log('🧹 Cleanup effect registered');
    return () => {
      console.log('🧹 Cleaning up WebSocket');
      if (webSocketRef.current) {
        webSocketRef.current.close();
      }
    };
  }, []);

  const handleSave = async () => {
    console.log('💾 Save clicked');
    if (saving) return;
    try {
      setSaving(true);
      await onSave(code);
      onClose();
    } catch (err) {
      console.error('Failed to save reaction', err);
      const message = err instanceof Error ? err.message : 'Failed to save reaction';
      globalThis.alert(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    console.log('🗑️ Delete clicked');
    if (globalThis.confirm('Do you want to delete this relation? Note: this action cannot be reverted!')) {
      onDelete?.();
      onClose();
    }
  };

  const handleUndo = () => {
    console.log('↶ Undo clicked');
    editorRef.current?.trigger('keyboard', 'undo', null);
  };

  const handleRedo = () => {
    console.log('↷ Redo clicked');
    editorRef.current?.trigger('keyboard', 'redo', null);
  };

  const handleFormat = () => {
    console.log('🎨 Format clicked');
    editorRef.current?.getAction('editor.action.formatDocument')?.run();
  };

  const handleClear = () => {
    console.log('🗑 Clear clicked');
    if (globalThis.confirm('Do you want to delete the whole code?')) {
      setCode('');
    }
  };

  if (!isOpen) {
    console.log('🚫 Modal not open, returning null');
    return null;
  }

  console.log('✅ Rendering modal');

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
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
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
                <span style={{ marginLeft: '12px', color: lspReady ? '#0e7a0d' : '#ff9800', fontSize: '14px' }}>
                  ● {lspReady ? 'LSP Ready' : 'LSP Initializing...'}
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
            onClick={onClose}
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
              console.log('✏️ Code changed in editor');
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
                console.log('📤 Sending didChange');
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
    </dialog>
  );
}