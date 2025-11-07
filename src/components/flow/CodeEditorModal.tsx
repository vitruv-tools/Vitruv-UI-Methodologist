import React, { useState, useRef, useEffect } from 'react';

interface CodeEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (code: string) => void;
  onDelete?: () => void; // NEU: Handler zum Löschen der Edge
  initialCode?: string;
  edgeId: string;
  sourceFileName?: string;
  targetFileName?: string;
}

export function CodeEditorModal({
  isOpen,
  onClose,
  onSave,
  onDelete, // NEU
  initialCode = '',
  edgeId,
  sourceFileName,
  targetFileName,
}: CodeEditorModalProps) {
  const [code, setCode] = useState(initialCode);
  const [history, setHistory] = useState<string[]>([initialCode]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setCode(initialCode);
    setHistory([initialCode]);
    setHistoryIndex(0);
  }, [initialCode, isOpen]);

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

  // NEU: Handler zum Löschen der Relation
  const handleDelete = () => {
    if (window.confirm('Möchtest du diese Relation wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      if (onDelete) {
        onDelete();
      }
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Tab-Unterstützung im Editor
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newCode = code.substring(0, start) + '  ' + code.substring(end);
      
      handleCodeChange(newCode);
      
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }

    // Strg+S zum Speichern
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }

    // Strg+Z für Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
    }

    // Strg+Shift+Z oder Strg+Y für Redo
    if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
      e.preventDefault();
      handleRedo();
    }
  };

  const handleClear = () => {
    if (window.confirm('Möchtest du den gesamten Code löschen?')) {
      handleCodeChange('');
    }
  };

  const handleFormat = () => {
    // Einfache Formatierung: Entferne überflüssige Leerzeilen
    const formatted = code
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');
    handleCodeChange(formatted);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
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
            disabled={historyIndex <= 0}
            style={{
              padding: '6px 12px',
              backgroundColor: historyIndex <= 0 ? '#333' : '#0e639c',
              color: historyIndex <= 0 ? '#666' : '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
            title="Rückgängig (Strg+Z)"
          >
            ↶ Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            style={{
              padding: '6px 12px',
              backgroundColor: historyIndex >= history.length - 1 ? '#333' : '#0e639c',
              color: historyIndex >= history.length - 1 ? '#666' : '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
            title="Wiederholen (Strg+Shift+Z)"
          >
            ↷ Redo
          </button>
          <div style={{ width: '1px', backgroundColor: '#444', margin: '0 4px' }} />
          <button
            onClick={handleFormat}
            style={{
              padding: '6px 12px',
              backgroundColor: '#0e639c',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
            title="Code formatieren"
          >
            Format
          </button>
          <button
            onClick={handleClear}
            style={{
              padding: '6px 12px',
              backgroundColor: '#c72e2e',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
            title="Alles löschen"
          >
            🗑 Clear
          </button>
          <div style={{ flex: 1 }} />
          {/* NEU: Delete Relation Button */}
          <button
            onClick={handleDelete}
            style={{
              padding: '6px 20px',
              backgroundColor: '#8b0000',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
            title="Relation löschen"
          >
            🗑️ Delete Relation
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '6px 20px',
              backgroundColor: '#0e7a0d',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
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
            {code.split('\n').map((_, index) => (
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
            {code.split('\n').length} Zeilen · {code.length} Zeichen
          </div>
          <div style={{ color: '#888', fontSize: '12px' }}>
            Edge ID: {edgeId}
          </div>
        </div>
      </div>
    </div>
  );
}