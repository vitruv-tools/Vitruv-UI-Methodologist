import React, { useState, useRef, useEffect } from 'react';
import Editor, { OnMount, Monaco } from '@monaco-editor/react';
import { reactionsMonarch } from './ReactionsMonarchGrammar';

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
  const [code, setCode] = useState(initialCode);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<any>(null); 
  const [lspConnected, setLspConnected] = useState(false);

  useEffect(() => {
    setCode(initialCode);
  }, [initialCode, isOpen]);

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    
    monacoInstance.languages.register({ id: 'reactions' });
    monacoInstance.languages.setMonarchTokensProvider('reactions', reactionsMonarch);
    
    connectToLsp(monacoInstance);
    
    editor.focus();
  };

  const connectToLsp = (monacoInstance: Monaco) => {
    try {
      const wsUrl = 'ws://localhost:9811/lsp';
      const webSocket = new WebSocket(wsUrl);

      webSocket.onopen = () => {
        console.log('LSP WebSocket connected');
        setLspConnected(true);

        const initMessage = {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            processId: null,
            rootUri: null,
            capabilities: {
              textDocument: {
                completion: {
                  completionItem: {
                    snippetSupport: true
                  }
                },
                hover: {},
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

      webSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('LSP Response:', message);
        } catch (err) {
          console.error('Failed to parse LSP message', err);
        }
      };

      webSocket.onerror = (error) => {
        console.error('LSP WebSocket error:', error);
        setLspConnected(false);
      };

      webSocket.onclose = () => {
        console.log('LSP WebSocket closed');
        setLspConnected(false);
      };

    } catch (err) {
      console.error('Failed to connect to LSP', err);
    }
  };

  const handleSave = async () => {
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
    if (globalThis.confirm('Do you want to delete this relation? Note: this action cannot be reverted!')) {
      onDelete?.();
      onClose();
    }
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
    if (globalThis.confirm('Do you want to delete the whole code?')) {
      setCode('');
    }
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
                <span style={{ marginLeft: '12px', color: '#0e7a0d', fontSize: '14px' }}>
                  ● LSP Connected
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
            onChange={(value) => setCode(value || '')}
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