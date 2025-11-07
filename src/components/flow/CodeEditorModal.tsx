import React, { useState, useRef, useEffect } from 'react';

interface CodeEditorModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (code: string) => void;
  readonly onDelete?: () => void;
  readonly initialCode?: string;
  readonly edgeId: string;
  readonly sourceFileName?: string;
  readonly targetFileName?: string;
}

// Gemeinsame Button-Styles
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
  const [history, setHistory] = useState<string[]>([initialCode]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset state when modal opens or initialCode changes
  useEffect(() => {
    setCode(initialCode);
    setHistory([initialCode]);
    setHistoryIndex(0);
  }, [initialCode, isOpen]);

  // Auto-focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newCode);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCode(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCode(history[newIndex]);
    }
  };

  const handleSave = () => {
    onSave(code);
    onClose();
  };

  const handleDelete = () => {
    if (globalThis.confirm('Do you want to delete this relation? Note: this action cannot be reverted!')) {
      onDelete?.();
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    // Tab-Unterstützung im Editor
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const { selectionStart: start, selectionEnd: end } = textarea;
      const newCode = code.substring(0, start) + '  ' + code.substring(end);

      handleCodeChange(newCode);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
      return;
    }

    if (!isCtrlOrCmd) return;

    // Strg+S zum Speichern
    if (e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    // Strg+Z für Undo
    else if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
    }
    // Strg+Shift+Z oder Strg+Y für Redo
    else if ((e.shiftKey && e.key === 'z') || e.key === 'y') {
      e.preventDefault();
      handleRedo();
    }
  };

  const handleClear = () => {
    if (globalThis.confirm('Do you want to delete the whole code?')) {
      handleCodeChange('');
    }
  };

  const handleFormat = () => {
    const formatted = code
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');
    handleCodeChange(formatted);
  };

  if (!isOpen) return null;

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const lineCount = code.split('\n').length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
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
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
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
            <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 600 }}>
              Reaction Editor
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

        {/* Toolbar */}
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
            disabled={!canUndo}
            style={createButtonStyles('#0e639c', '#fff', !canUndo)}
            title="Rückgängig (Strg+Z)"
          >
            ↶ Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            style={createButtonStyles('#0e639c', '#fff', !canRedo)}
            title="Wiederholen (Strg+Shift+Z)"
          >
            ↷ Redo
          </button>
          <div style={{ width: '1px', backgroundColor: '#444', margin: '0 4px' }} />
          <button
            onClick={handleFormat}
            style={createButtonStyles('#0e639c')}
            title="Code formatieren"
          >
            Format
          </button>
          <button
            onClick={handleClear}
            style={createButtonStyles('#c72e2e')}
            title="Alles löschen"
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
              title="Relation löschen"
            >
              🗑️ Delete Relation
            </button>
          )}
          <button
            onClick={handleSave}
            style={{
              ...buttonBaseStyles,
              padding: '6px 20px',
              backgroundColor: '#0e7a0d',
              color: '#fff',
              fontWeight: 600,
            }}
            title="Speichern (Strg+S)"
          >
            💾 Save
          </button>
        </div>

        {/* Code Editor */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Line Numbers */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '50px',
              backgroundColor: '#1e1e1e',
              borderRight: '1px solid #333',
              padding: '16px 8px',
              overflow: 'hidden',
              userSelect: 'none',
            }}
          >
            {Array.from({ length: lineCount }, (_, index) => (
              <div
                key={index}
                style={{
                  color: '#858585',
                  fontSize: '13px',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  lineHeight: '20px',
                  textAlign: 'right',
                }}
              >
                {index + 1}
              </div>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            style={{
              position: 'absolute',
              left: '50px',
              top: 0,
              right: 0,
              bottom: 0,
              width: 'calc(100% - 50px)',
              height: '100%',
              padding: '16px',
              backgroundColor: '#1e1e1e',
              color: '#d4d4d4',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '13px',
              lineHeight: '20px',
              tabSize: 2,
            }}
            placeholder="// Schreibe hier deinen Code..."
          />
        </div>

        {/* Footer */}
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
            {lineCount} Zeilen · {code.length} Zeichen
          </div>
          <div style={{ color: '#888', fontSize: '12px' }}>
            Edge ID: {edgeId}
          </div>
        </div>
      </div>
    </div>
  );
}