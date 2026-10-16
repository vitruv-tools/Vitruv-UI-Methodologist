import React, { useState } from 'react';
import { copyTextToClipboard } from '../../utils/apiErrorMessage';

export type CanvasPopupNotificationType = 'success' | 'error' | 'info';

interface CanvasPopupNotificationProps {
  message: string;
  type: CanvasPopupNotificationType;
  details?: string;
  onClose?: () => void;
}

function getPopupNotificationStyles(type: CanvasPopupNotificationType) {
  if (type === 'success') {
    return { background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d' };
  }
  if (type === 'error') {
    return { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' };
  }
  return { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' };
}

const actionButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'inherit',
  fontSize: 12,
  fontWeight: 700,
  padding: '2px 0',
  opacity: 0.8,
};

export const CanvasPopupNotification: React.FC<CanvasPopupNotificationProps> = ({
  message,
  type,
  details,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const popupStyles = getPopupNotificationStyles(type);
  const copyText = details?.trim() || message;

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(copyText);
    if (!ok) return;
    setCopied(true);
    globalThis.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      data-testid="canvas-popup-notification"
      style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, maxWidth: 480, width: 'max-content',
      maxHeight: '60vh', overflowY: 'auto',
      background: popupStyles.background,
      border: popupStyles.border,
      color: popupStyles.color,
      borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 500,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <p style={{
          margin: 0,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          userSelect: 'text',
          flex: 1,
        }}>
          {message}
        </p>
        {type === 'error' && (
          <button
            type="button"
            style={actionButtonStyle}
            onClick={() => { void handleCopy(); }}
            aria-label="Copy error message"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
        {onClose && (
          <button
            type="button"
            style={{ ...actionButtonStyle, fontSize: 16, lineHeight: 1 }}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};
