import React, { useState, useRef, useEffect } from 'react';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface EcoreFileBoxProps {
  fileName: string;
  fileContent: string;
  position: { x: number; y: number };
  onExpand: (fileName: string, fileContent: string) => void;
  onSelect: (fileName: string) => void;
  onPositionChange?: (id: string, newPosition: { x: number; y: number }) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newFileName: string) => void;
  id: string;
  isSelected?: boolean;
  isExpanded?: boolean;
}

// Academic-style design with better typography and colors
const boxStyle: React.CSSProperties = {
  position: 'absolute',
  background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
  border: '2px solid #dee2e6',
  borderRadius: '12px',
  padding: '24px 28px',
  minWidth: '220px',
  maxWidth: '320px',
  cursor: 'pointer',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  zIndex: 100,
  userSelect: 'none',
  fontFamily: '"Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
};

const boxHoverStyle: React.CSSProperties = {
  border: '2px solid #6c757d',
  boxShadow: '0 8px 32px rgba(108, 117, 125, 0.15)',
  transform: 'translateY(-2px) scale(1.01)',
  background: 'linear-gradient(145deg, #ffffff 0%, #f1f3f4 100%)',
};

const selectedBoxStyle: React.CSSProperties = {
  border: '2px solid #495057',
  boxShadow: '0 8px 32px rgba(73, 80, 87, 0.2)',
  transform: 'scale(1.02)',
  background: 'linear-gradient(145deg, #ffffff 0%, #e9ecef 100%)',
};

const draggingBoxStyle: React.CSSProperties = {
  cursor: 'grabbing',
  opacity: 0.95,
  transform: 'scale(1.03) rotate(1deg)',
  zIndex: 200,
  boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
  border: '2px solid #495057',
};

const fileNameStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: '700',
  color: '#212529',
  textAlign: 'center',
  wordBreak: 'break-word',
  lineHeight: '1.4',
  fontFamily: '"Georgia", "Times New Roman", serif',
  marginBottom: '8px',
};

const fileInfoStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6c757d',
  textAlign: 'center',
  marginTop: '8px',
  fontStyle: 'italic',
  fontFamily: '"Segoe UI", "Roboto", sans-serif',
  lineHeight: '1.5',
};

const tooltipStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 'calc(100% + 12px)',
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#495057',
  color: 'white',
  padding: '16px',
  borderRadius: '10px',
  fontSize: '12px',
  maxWidth: '320px',
  wordBreak: 'break-word',
  boxShadow: '0 8px 32px rgba(73, 80, 87, 0.3)',
  zIndex: 1000,
  pointerEvents: 'none',
  opacity: 0,
  transition: 'opacity 0.3s ease',
  border: '1px solid #6c757d',
  fontFamily: '"Segoe UI", "Roboto", sans-serif',
};

const tooltipArrowStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 0,
  height: 0,
  borderLeft: '8px solid transparent',
  borderRight: '8px solid transparent',
  borderTop: '8px solid #495057',
};

const deleteButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: '-8px',
  left: '-8px',
  background: 'linear-gradient(145deg, #dc3545 0%, #c82333 100%)',
  color: 'white',
  borderRadius: '6px',
  width: 'auto',
  height: '24px',
  fontSize: '10px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 8px rgba(220, 53, 69, 0.3)',
  transition: 'all 0.2s ease',
  border: '1px solid #ffffff',
  fontFamily: '"Segoe UI", "Roboto", sans-serif',
  fontWeight: '600',
  padding: '0 8px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const deleteButtonHoverStyle: React.CSSProperties = {
  background: 'linear-gradient(145deg, #c82333 0%, #a71e2a 100%)',
  transform: 'scale(1.05)',
  boxShadow: '0 4px 12px rgba(220, 53, 69, 0.4)',
};

const authorStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#495057',
  textAlign: 'center',
  fontStyle: 'italic',
  lineHeight: '1.4',
  marginTop: '8px',
  fontFamily: '"Georgia", "Times New Roman", serif',
  fontWeight: '500',
};

export const EcoreFileBox: React.FC<EcoreFileBoxProps> = ({
  fileName,
  fileContent,
  position,
  onExpand,
  onSelect,
  onPositionChange,
  onDelete,
  onRename,
  id,
  isSelected = false,
  isExpanded = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(fileName);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(fileName);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onExpand(fileName, fileContent);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (onDelete) {
      onDelete(id);
    }
    setShowDeleteConfirm(false);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = boxRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !onPositionChange) return;
    
    // Use requestAnimationFrame for smoother movement
    requestAnimationFrame(() => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Ensure the box follows the mouse cursor exactly
      onPositionChange(id, { x: newX, y: newY });
    });
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
    }
  };

  useEffect(() => {
    if (isDragging) {
      // Use passive: false for better performance and responsiveness
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset, onPositionChange, id]);

  const handleFileNameDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditName(fileName);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditName(fileName);
    }
  };

  const handleSaveEdit = () => {
    if (editName.trim() && editName !== fileName && onRename) {
      onRename(id, editName.trim());
    }
    setIsEditing(false);
  };

  const handleEditBlur = () => {
    handleSaveEdit();
  };

  const getFileSize = () => {
    const size = fileContent.length;
    if (size < 1024) return `${size} chars`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileType = () => {
    return fileName.endsWith('.ecore') ? 'ECORE Model' : 'Model File';
  };

  const getAuthorName = () => {
    // Try to extract author from file content
    try {
      // Look for common author patterns in ECORE files
      const authorMatch = fileContent.match(/<eAnnotations.*?source="http:\/\/www\.eclipse\.org\/emf\/2002\/GenModel".*?<details.*?key="documentation".*?value="([^"]*)"/);
      if (authorMatch && authorMatch[1]) {
        return authorMatch[1].trim();
      }
      
      // Look for other author patterns
      const otherAuthorMatch = fileContent.match(/author["\s]*[:=]["\s]*([^"\n\r]+)/i);
      if (otherAuthorMatch && otherAuthorMatch[1]) {
        return otherAuthorMatch[1].trim();
      }
      
      // Default author if none found
      return 'Unknown Author';
    } catch (error) {
      return 'Unknown Author';
    }
  };

  return (
    <>
      <div
        ref={boxRef}
        style={{
          ...boxStyle,
          ...(isSelected ? selectedBoxStyle : {}),
          ...(isDragging ? draggingBoxStyle : {}),
          ...(isHovered ? boxHoverStyle : {}),
          left: position.x,
          top: position.y,
          transform: isSelected && !isDragging ? 'scale(1.02)' : 'scale(1)',
          display: isExpanded ? 'none' : 'block', // Hide box when expanded
        }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={`Click to select, double-click to expand\nDrag to move\n${fileName}`}
      >
        <div style={fileNameStyle}>
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleEditKeyDown}
              ref={inputRef}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: '2px solid #6c757d',
                borderRadius: '6px',
                outline: 'none',
                fontSize: '16px',
                fontWeight: '700',
                color: '#212529',
                textAlign: 'center',
                wordBreak: 'break-word',
                lineHeight: '1.4',
                padding: '8px 12px',
                background: '#ffffff',
                fontFamily: '"Georgia", "Times New Roman", serif',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#495057';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#6c757d';
                handleEditBlur();
              }}
            />
          ) : (
            <span onDoubleClick={handleFileNameDoubleClick}>
              {fileName.replace(/\.ecore$/i, '')}
            </span>
          )}
        </div>
        <div style={fileInfoStyle}>
          {getFileType()}
          <br />
          {getFileSize()}
        </div>
        
        <div style={authorStyle}>
          by {getAuthorName()}
        </div>
        <button
          style={{
            ...deleteButtonStyle,
            ...(isHovered ? deleteButtonHoverStyle : {}),
          }}
          onClick={handleDeleteClick}
          title="Delete file"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          Delete
        </button>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete ECORE File"
        message={`Are you sure you want to delete "${fileName}"? This action will remove the file from the workspace but will not affect the original uploaded file.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      {/* Tooltip for file content preview */}
      {isHovered && (
        <div style={{
          ...tooltipStyle,
          opacity: 1,
        }}>
          <div style={{ fontWeight: '700', marginBottom: '10px', fontSize: '13px' }}>
            {fileName}
          </div>
          <div style={{ 
            fontSize: '11px', 
            lineHeight: '1.5',
            maxHeight: '120px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: '#e9ecef'
          }}>
            {fileContent.length > 200 
              ? `${fileContent.substring(0, 200)}...` 
              : fileContent
            }
          </div>
          <div style={tooltipArrowStyle} />
        </div>
      )}
    </>
  );
};
