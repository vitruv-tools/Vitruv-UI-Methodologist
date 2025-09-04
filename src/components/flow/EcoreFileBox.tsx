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
  description?: string;
  keywords?: string;
  domain?: string;
  createdAt?: string;
}

// Modal styles
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  backdropFilter: 'blur(4px)',
};

const modalContentStyle: React.CSSProperties = {
  background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
  border: '2px solid #dee2e6',
  borderRadius: '16px',
  padding: '32px',
  maxWidth: '600px',
  width: '90%',
  maxHeight: '80vh',
  overflow: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 8px 32px rgba(0,0,0,0.1)',
  position: 'relative',
  fontFamily: '"Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '24px',
  paddingBottom: '16px',
  borderBottom: '2px solid #e9ecef',
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#212529',
  fontFamily: '"Georgia", "Times New Roman", serif',
  margin: 0,
};

const closeButtonStyle: React.CSSProperties = {
  background: 'linear-gradient(145deg, #6c757d 0%, #495057 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  width: '32px',
  height: '32px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '16px',
  fontWeight: '600',
  transition: 'all 0.2s ease',
  boxShadow: '0 4px 12px rgba(108, 117, 125, 0.3)',
};

const closeButtonHoverStyle: React.CSSProperties = {
  background: 'linear-gradient(145deg, #495057 0%, #343a40 100%)',
  transform: 'scale(1.05)',
  boxShadow: '0 6px 16px rgba(108, 117, 125, 0.4)',
};

const descriptionContentStyle: React.CSSProperties = {
  fontSize: '16px',
  lineHeight: '1.8',
  color: '#495057',
  fontFamily: '"Georgia", "Times New Roman", serif',
  textAlign: 'justify',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const modalFooterStyle: React.CSSProperties = {
  marginTop: '24px',
  paddingTop: '16px',
  borderTop: '2px solid #e9ecef',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '14px',
  color: '#6c757d',
  fontStyle: 'italic',
};

// Academic-style design with better typography and colors
const boxStyle: React.CSSProperties = {
  position: 'absolute',
  background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
  border: '2px solid #dee2e6',
  borderRadius: '12px',
  padding: '20px 24px',
  width: '280px',
  height: '180px',
  cursor: 'pointer',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  zIndex: 100,
  userSelect: 'none',
  fontFamily: '"Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  boxSizing: 'border-box',
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

const descriptionStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#6c757d',
  textAlign: 'center',
  marginTop: '6px',
  fontStyle: 'italic',
  lineHeight: '1.4',
  fontFamily: '"Georgia", "Times New Roman", serif',
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
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
  description,
  keywords,
  domain,
  createdAt,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(fileName);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [showKeywordsModal, setShowKeywordsModal] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleShowMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDescriptionModal(true);
  };

  const handleShowMoreKeywordsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowKeywordsModal(true);
  };

  const handleCloseModal = () => {
    setShowDescriptionModal(false);
  };

  const handleCloseKeywordsModal = () => {
    setShowKeywordsModal(false);
  };

  const handleModalOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCloseModal();
    }
  };

  const handleKeywordsModalOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCloseKeywordsModal();
    }
  };

  const truncateDescription = (description: string, maxLength: number = 70) => {
    if (description.length <= maxLength) {
      return { text: description, isTruncated: false };
    }
    
    const truncatedText = description.substring(0, maxLength) + '...';
    return { text: truncatedText, isTruncated: true };
  };

  const truncateKeywords = (keywords: string, maxLength: number = 40) => {
    if (keywords.length <= maxLength) {
      return { text: keywords, isTruncated: false };
    }
    
    const truncatedText = keywords.substring(0, maxLength) + '...';
    return { text: truncatedText, isTruncated: true };
  };

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
    
    // Add a small delay to prevent accidental dragging
    const rect = boxRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      
      // Small delay to prevent accidental dragging
      setTimeout(() => {
        setIsDragging(true);
      }, 50);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !onPositionChange) return;
    
    // Prevent default to avoid text selection
    e.preventDefault();
    
    // Calculate new position with smooth movement
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Add bounds checking to prevent boxes from going off-screen
    const minX = 20;
    const minY = 20;
    const maxX = window.innerWidth - 300; // Box width + margin
    const maxY = window.innerHeight - 200; // Box height + margin
    
    const boundedX = Math.max(minX, Math.min(maxX, newX));
    const boundedY = Math.max(minY, Math.min(maxY, newY));
    
    // Use smooth movement with easing
    const currentPosition = { x: boundedX, y: boundedY };
    onPositionChange(id, currentPosition);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      // Reset cursor and user select
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  };

  useEffect(() => {
    if (isDragging) {
      // Use passive: false for better performance and responsiveness
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp);
      
      // Add cursor style to body
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
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

    const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return 'Unknown Date';
    }
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
          
          {description && (
            <div style={descriptionStyle}>
              <span style={{ fontWeight: '600', color: '#495057' }}>Description: </span>
              {(() => {
                const { text, isTruncated } = truncateDescription(description);
                
                return (
                  <>
                    {text}
                    {isTruncated && (
                      <button
                        onClick={handleShowMoreClick}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#3498db',
                          fontSize: '10px',
                          cursor: 'pointer',
                          marginLeft: '6px',
                          textDecoration: 'underline',
                          fontFamily: '"Georgia", "Times New Roman", serif',
                          padding: '0',
                          lineHeight: '1',
                        }}
                      >
                        See more
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}
          
          {keywords && (
            <div style={{
              fontSize: '10px',
              color: '#495057',
              textAlign: 'center',
              marginTop: '4px',
              fontStyle: 'italic',
              lineHeight: '1.3',
              fontFamily: '"Georgia", "Times New Roman", serif',
              fontWeight: '500',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
            }}>
              <span style={{ fontWeight: '600', color: '#495057' }}>Keywords: </span>
              {(() => {
                const { text, isTruncated } = truncateKeywords(keywords);
                
                return (
                  <>
                    {text}
                    {isTruncated && (
                      <button
                        onClick={handleShowMoreKeywordsClick}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#3498db',
                          fontSize: '10px',
                          cursor: 'pointer',
                          marginLeft: '6px',
                          textDecoration: 'underline',
                          fontFamily: '"Georgia", "Times New Roman", serif',
                          padding: '0',
                          lineHeight: '1',
                        }}
                      >
                        See more
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}
         
         <div style={authorStyle}>
           by {getAuthorName()}
         </div>
         
         {createdAt && (
           <div style={{
             fontSize: '11px',
             color: '#6c757d',
             textAlign: 'center',
             fontStyle: 'italic',
             lineHeight: '1.4',
             fontFamily: '"Georgia", "Times New Roman", serif',
           }}>
             Created: {formatDate(createdAt)}
           </div>
         )}
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

       {/* Description Modal */}
       {showDescriptionModal && (
         <div style={modalOverlayStyle} onClick={handleModalOverlayClick}>
           <div style={modalContentStyle}>
             <div style={modalHeaderStyle}>
               <h2 style={modalTitleStyle}>
                 {fileName.replace(/\.ecore$/i, '')} - Description
               </h2>
               <button
                 style={closeButtonStyle}
                 onClick={handleCloseModal}
                 onMouseEnter={(e) => {
                   Object.assign(e.currentTarget.style, closeButtonHoverStyle);
                 }}
                 onMouseLeave={(e) => {
                   Object.assign(e.currentTarget.style, closeButtonStyle);
                 }}
                 title="Close"
               >
                 ×
               </button>
             </div>
             
             <div style={descriptionContentStyle}>
               {description}
             </div>
             
             <div style={modalFooterStyle}>
               <span>Model: {fileName.replace(/\.ecore$/i, '')}</span>
               <span>Created: {createdAt ? formatDate(createdAt) : 'Unknown Date'}</span>
             </div>
           </div>
         </div>
       )}

       {/* Keywords Modal */}
       {showKeywordsModal && (
         <div style={modalOverlayStyle} onClick={handleKeywordsModalOverlayClick}>
           <div style={modalContentStyle}>
             <div style={modalHeaderStyle}>
               <h2 style={modalTitleStyle}>
                 {fileName.replace(/\.ecore$/i, '')} - Keywords
               </h2>
               <button
                 style={closeButtonStyle}
                 onClick={handleCloseKeywordsModal}
                 onMouseEnter={(e) => {
                   Object.assign(e.currentTarget.style, closeButtonHoverStyle);
                 }}
                 onMouseLeave={(e) => {
                   Object.assign(e.currentTarget.style, closeButtonStyle);
                 }}
                 title="Close"
               >
                 ×
               </button>
             </div>
             
             <div style={descriptionContentStyle}>
               {keywords}
             </div>
             
             <div style={modalFooterStyle}>
               <span>Model: {fileName.replace(/\.ecore$/i, '')}</span>
               <span>Created: {createdAt ? formatDate(createdAt) : 'Unknown Date'}</span>
             </div>
           </div>
         </div>
       )}
     </>
   );
 };
