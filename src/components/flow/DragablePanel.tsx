import React, { useState, useRef, useCallback, useEffect } from 'react';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import MinimizeIcon from '@mui/icons-material/Minimize';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';

export interface DragablePanelProps {
  title?: string;
  onClose: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  saveHighlighted?: boolean;
  showDelete?: boolean;
  children: React.ReactNode;
}

/**
 * Draggable, minimizable host panel for the Low Code reaction editor.
 *
 * Rendered inside a React Flow `<Panel>` so it floats above the canvas.
 * Supports drag-to-move, minimize/expand, save (with dirty highlight),
 * and optional delete action.
 */
const DragablePanel: React.FC<DragablePanelProps> = ({
  title = 'Reaction Editor',
  onClose,
  onSave,
  onDelete,
  saveHighlighted = false,
  showDelete = false,
  children,
}) => {
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const dragRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    draggingRef.current = true;
    offsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    e.preventDefault();
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      setPosition({
        x: e.clientX - offsetRef.current.x,
        y: e.clientY - offsetRef.current.y,
      });
    };

    const handleMouseUp = () => {
      draggingRef.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0, pointerEvents: 'none', zIndex: 1000 }}>
      <div
        ref={dragRef}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: minimized ? 260 : 360,
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
          border: '1px solid #ddd',
          zIndex: 1000,
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Title bar */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px',
            background: '#f5f5f5',
            borderBottom: minimized ? 'none' : '1px solid #e0e0e0',
            cursor: 'grab',
            userSelect: 'none',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
            {title}
          </span>
          <div style={{ display: 'flex', gap: 2 }}>
            {onSave && (
              <IconButton
                size="small"
                onClick={onSave}
                title="Save reaction and project"
                sx={{
                  color: saveHighlighted ? '#1976d2' : '#888',
                  animation: saveHighlighted ? 'pulse 1.5s ease-in-out infinite' : 'none',
                  '@keyframes pulse': {
                    '0%, 100%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(1.15)' },
                  },
                }}
              >
                <SaveIcon fontSize="small" />
              </IconButton>
            )}
            {showDelete && onDelete && (
              <IconButton size="small" onClick={onDelete} title="Delete" sx={{ color: '#d32f2f' }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
            <IconButton
              size="small"
              onClick={() => setMinimized((v) => !v)}
              title={minimized ? 'Expand' : 'Minimize'}
              sx={{ color: '#888' }}
            >
              {minimized ? <OpenInFullIcon fontSize="small" /> : <MinimizeIcon fontSize="small" />}
            </IconButton>
            <IconButton size="small" onClick={onClose} title="Close" sx={{ color: '#888' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </div>
        </div>

        {/* Content */}
        {!minimized && (
          <div
            style={{
              padding: 12,
              overflowY: 'auto',
              maxHeight: 500,
            }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

export default DragablePanel;
