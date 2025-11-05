import React, { useState, useRef, useEffect } from 'react';
import { NodeProps } from 'reactflow';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ConnectionHandle } from './ConnectionHandle';

interface EcoreFileBoxData {
  fileName: string;
  fileContent: string;
  onExpand: (fileName: string, fileContent: string) => void;
  onSelect: (fileName: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newFileName: string) => void;
  onConnectionStart?: (nodeId: string, handle: 'top' | 'bottom' | 'left' | 'right') => void;
  isExpanded?: boolean;
  isConnectionActive?: boolean;
  description?: string;
  keywords?: string;
  domain?: string;
  createdAt?: string;
}

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

const boxStyle: React.CSSProperties = {
  background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
  border: '2px solid #dee2e6',
  borderRadius: '12px',
  padding: '20px 24px',
  width: '280px',
  height: '180px',
  cursor: 'pointer',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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

const fileNameStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: '700',
  color: '#212529',
  textAlign: 'center',
  wordBreak: 'break-word',
  lineHeight: '1.3',
  fontFamily: '"Georgia", "Times New Roman", serif',
  marginBottom: '6px',
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
  fontSize: '10px',
  color: '#6c757d',
  textAlign: 'center',
  marginTop: '6px',
  fontStyle: 'italic',
  lineHeight: '1.4',
  fontFamily: '"Georgia", "Times New Roman", serif',
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
};

export const EcoreFileBox: React.FC<NodeProps<EcoreFileBoxData>> = ({
  id,
  data,
  selected = false,
  xPos,
  yPos,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [showKeywordsModal, setShowKeywordsModal] = useState(false);

  const {
    fileName,
    fileContent,
    onExpand,
    onSelect,
    onDelete,
    onRename,
    onConnectionStart,
    isExpanded = false,
    isConnectionActive = false,
    description,
    keywords,
    domain,
    createdAt,
  } = data;

  const boxRef = useRef<HTMLDivElement>(null);

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

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return 'Unknown Date';
    }
  };

  return (
    <>
      <div
        ref={boxRef}
        style={{
          ...boxStyle,
          ...(selected ? selectedBoxStyle : {}),
          ...(isHovered ? boxHoverStyle : {}),
          display: isExpanded ? 'none' : 'block',
          position: 'relative',
        }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={`Click to select, double-click to expand\n${fileName}`}
      >
        <ConnectionHandle
          position="top"
          isVisible={selected || isConnectionActive}
          onConnectionStart={(pos) => {
            console.log('Connection started from', pos, 'on node', id);
            if (onConnectionStart) {
              onConnectionStart(id, pos);
            }
          }}
        />
        <ConnectionHandle
          position="bottom"
          isVisible={selected || isConnectionActive}
          onConnectionStart={(pos) => {
            console.log('Connection started from', pos, 'on node', id);
            if (onConnectionStart) {
              onConnectionStart(id, pos);
            }
          }}
        />
        <ConnectionHandle
          position="left"
          isVisible={selected || isConnectionActive}
          onConnectionStart={(pos) => {
            console.log('Connection started from', pos, 'on node', id);
            if (onConnectionStart) {
              onConnectionStart(id, pos);
            }
          }}
        />
        <ConnectionHandle
          position="right"
          isVisible={selected || isConnectionActive}
          onConnectionStart={(pos) => {
            console.log('Connection started from', pos, 'on node', id);
            if (onConnectionStart) {
              onConnectionStart(id, pos);
            }
          }}
        />

        <div style={fileNameStyle}>
          <span>
            {fileName.replace(/\.ecore$/i, '')}
          </span>
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
        title="Delete ECORE File from Workspace"
        message={`Do you want to delete "${fileName}" from workspace?`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

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