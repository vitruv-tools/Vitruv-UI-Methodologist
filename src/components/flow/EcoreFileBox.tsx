import React, { useState, useRef } from 'react';
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

type HandlePosition = 'top' | 'bottom' | 'left' | 'right';

// Font Families
const FONT_SERIF = '"Georgia", "Times New Roman", serif';
const FONT_SANS = '"Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif';

// Common Styles
const gradientBackground = (color1: string, color2: string) => 
  `linear-gradient(145deg, ${color1} 0%, ${color2} 100%)`;


const createModalStyle = (): React.CSSProperties => ({
  background: gradientBackground('#ffffff', '#f8f9fa'),
  border: '2px solid #dee2e6',
  borderRadius: '16px',
  padding: '32px',
  maxWidth: '600px',
  width: '90%',
  maxHeight: '80vh',
  overflow: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 8px 32px rgba(0,0,0,0.1)',
  position: 'relative',
  fontFamily: FONT_SANS,
});

const createButtonStyle = (
  bgStart: string,
  bgEnd: string,
  size: { width: number | string; height: number },
  fontSize: number = 16
): React.CSSProperties => ({
  background: gradientBackground(bgStart, bgEnd),
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  width: size.width,
  height: size.height,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: `${fontSize}px`,
  fontWeight: '600',
  transition: 'all 0.2s ease',
  fontFamily: FONT_SANS,
});

const createTextStyle = (
  fontSize: number,
  color: string,
  additionalStyles?: React.CSSProperties
): React.CSSProperties => ({
  fontSize: `${fontSize}px`,
  color,
  fontFamily: FONT_SERIF,
  ...additionalStyles,
});

// Modal Styles
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  backdropFilter: 'blur(4px)',
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '24px',
  paddingBottom: '16px',
  borderBottom: '2px solid #e9ecef',
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

// Box Styles
const boxStyle: React.CSSProperties = {
  background: gradientBackground('#ffffff', '#f8f9fa'),
  border: '2px solid #dee2e6',

  borderRadius: '0',
  padding: '14px 16px',
  width: '220px',

  cursor: 'pointer',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  userSelect: 'none',
  fontFamily: FONT_SANS,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  boxSizing: 'border-box',
};

const boxVariantStyles = {
  hover: {
    border: '2px solid #6c757d',
    boxShadow: '0 8px 32px rgba(108, 117, 125, 0.15)',
    transform: 'translateY(-2px) scale(1.01)',
    background: gradientBackground('#ffffff', '#f1f3f4'),
  },
  selected: {
    border: '2px solid #495057',
    boxShadow: '0 8px 32px rgba(73, 80, 87, 0.2)',
    transform: 'scale(1.02)',
    background: gradientBackground('#ffffff', '#e9ecef'),
  },
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
  fontFamily: FONT_SANS,
};

// Utility Functions
const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) {
    return { text, isTruncated: false };
  }
  return { text: text.substring(0, maxLength) + '...', isTruncated: true };
};

const formatDate = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return 'Unknown Date';
  }
};

const removeEcoreExtension = (fileName: string) => fileName.replace(/\.ecore$/i, '');

// Sub-Components
const SeeMoreButton: React.FC<{ onClick: (e: React.MouseEvent) => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    style={{
      background: 'none',
      border: 'none',
      color: '#3498db',
      fontSize: '10px',
      cursor: 'pointer',
      marginLeft: '6px',
      textDecoration: 'underline',
      fontFamily: FONT_SERIF,
      padding: '0',
      lineHeight: '1',
    }}
  >
    See more
  </button>
);

const ModalContent: React.FC<{
  fileName: string;
  content: string;
  title: string;
  createdAt?: string;
  onClose: () => void;
  onOverlayClick: (e: React.MouseEvent) => void;
}> = ({ fileName, content, title, createdAt, onClose, onOverlayClick }) => {
  const [isCloseHovered, setIsCloseHovered] = useState(false);

  return (
    <div style={modalOverlayStyle} onClick={onOverlayClick}>
      <div style={createModalStyle()}>
        <div style={modalHeaderStyle}>
          <h2 style={createTextStyle(24, '#212529', { fontWeight: '700', margin: 0 })}>
            {removeEcoreExtension(fileName)} - {title}
          </h2>
          <button
            style={{
              ...createButtonStyle('#6c757d', '#495057', { width: 32, height: 32 }),
              ...(isCloseHovered && {
                background: gradientBackground('#495057', '#343a40'),
                transform: 'scale(1.05)',
                boxShadow: '0 6px 16px rgba(108, 117, 125, 0.4)',
              }),
            }}
            onClick={onClose}
            onMouseEnter={() => setIsCloseHovered(true)}
            onMouseLeave={() => setIsCloseHovered(false)}
            title="Close"
          >
            ×
          </button>
        </div>

        <div style={createTextStyle(16, '#495057', { 
          lineHeight: '1.8',
          textAlign: 'justify',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        })}>
          {content}
        </div>

        <div style={modalFooterStyle}>
          <span>Model: {removeEcoreExtension(fileName)}</span>
          <span>Created: {createdAt ? formatDate(createdAt) : 'Unknown Date'}</span>
        </div>
      </div>
    </div>
  );
};

const InfoSection: React.FC<{
  label: string;
  content: string;
  maxLength: number;
  onShowMore: (e: React.MouseEvent) => void;
  additionalStyles?: React.CSSProperties;
}> = ({ label, content, maxLength, onShowMore, additionalStyles }) => {
  const { text, isTruncated } = truncateText(content, maxLength);

  return (
    <div style={{
      fontSize: '10px',
      color: '#6c757d',
      textAlign: 'center',
      marginTop: '6px',
      fontStyle: 'italic',
      lineHeight: '1.4',
      fontFamily: FONT_SERIF,
      wordBreak: 'break-word',
      overflowWrap: 'break-word',
      ...additionalStyles,
    }}>
      <span style={{ fontWeight: '600', color: '#495057' }}>{label}: </span>
      {text}
      {isTruncated && <SeeMoreButton onClick={onShowMore} />}
    </div>
  );
};

export const EcoreFileBox: React.FC<NodeProps<EcoreFileBoxData>> = ({
  id,
  data,
  selected = false,
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
    onConnectionStart,
    isExpanded = false,
    isConnectionActive = false,
    description,
    keywords,
    createdAt,
  } = data;

  const boxRef = useRef<HTMLDivElement>(null);

  // Event Handlers
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

  const handleModalClose = (setter: React.Dispatch<React.SetStateAction<boolean>>) => () => {
    setter(false);
  };

  const handleModalOverlayClick = (setter: React.Dispatch<React.SetStateAction<boolean>>) => 
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        setter(false);
      }
    };

  const confirmDelete = () => {
    onDelete?.(id);
    setShowDeleteConfirm(false);
  };

  const handleConnectionStartWrapper = (position: HandlePosition) => {
    console.log('Connection started from', position, 'on node', id);
    onConnectionStart?.(id, position);
  };

  // Render Connection Handles
  const connectionHandles = (['top', 'bottom', 'left', 'right'] as const).map(position => (
    <ConnectionHandle
      key={position}
      position={position}
      isVisible={selected || isConnectionActive}
      onConnectionStart={() => handleConnectionStartWrapper(position)}
    />
  ));

  return (
    <>
      <div
        ref={boxRef}
        style={{
          ...boxStyle,
          ...(selected && boxVariantStyles.selected),
          ...(isHovered && boxVariantStyles.hover),
          display: isExpanded ? 'none' : 'block',
          position: 'relative',
        }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={`Click to select, double-click to expand\n${fileName}`}
      >
        {connectionHandles}

        <div style={createTextStyle(14, '#212529', { 
          fontWeight: '700',
          textAlign: 'center',
          wordBreak: 'break-word',
          lineHeight: '1.3',
          marginBottom: '6px',
        })}>
          <span>{removeEcoreExtension(fileName)}</span>
        </div>

        {description && (
          <InfoSection
            label="Description"
            content={description}
            maxLength={70}
            onShowMore={(e) => {
              e.stopPropagation();
              setShowDescriptionModal(true);
            }}
          />
        )}

        {keywords && (
          <InfoSection
            label="Keywords"
            content={keywords}
            maxLength={40}
            onShowMore={(e) => {
              e.stopPropagation();
              setShowKeywordsModal(true);
            }}
            additionalStyles={{ marginTop: '4px', fontWeight: '500', color: '#495057' }}
          />
        )}

        <button
          style={{
            ...createButtonStyle('#dc3545', '#c82333', { width: 'auto', height: 24 }, 10),
            position: 'absolute',
            top: '-8px',
            left: '-8px',
            padding: '0 8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            border: '1px solid #ffffff',
            boxShadow: '0 2px 8px rgba(220, 53, 69, 0.3)',
            ...(isHovered && {
              background: gradientBackground('#c82333', '#a71e2a'),
              transform: 'scale(1.05)',
              boxShadow: '0 4px 12px rgba(220, 53, 69, 0.4)',
            }),
          }}
          onClick={handleDeleteClick}
          title="Delete file"
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
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {isHovered && (
        <div style={{ ...tooltipStyle, opacity: 1 }}>
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
            {fileContent.length > 200 ? `${fileContent.substring(0, 200)}...` : fileContent}
          </div>
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid #495057',
          }} />
        </div>
      )}

      {showDescriptionModal && description && (
        <ModalContent
          fileName={fileName}
          content={description}
          title="Description"
          createdAt={createdAt}
          onClose={handleModalClose(setShowDescriptionModal)}
          onOverlayClick={handleModalOverlayClick(setShowDescriptionModal)}
        />
      )}

      {showKeywordsModal && keywords && (
        <ModalContent
          fileName={fileName}
          content={keywords}
          title="Keywords"
          createdAt={createdAt}
          onClose={handleModalClose(setShowKeywordsModal)}
          onOverlayClick={handleModalOverlayClick(setShowKeywordsModal)}
        />
      )}
    </>
  );
};