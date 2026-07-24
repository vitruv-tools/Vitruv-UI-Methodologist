import React from 'react';

export type CanvasPopupNotificationType = 'success' | 'error' | 'info';

interface CanvasPopupNotificationProps {
  message: string;
  type: CanvasPopupNotificationType;
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

export const CanvasPopupNotification: React.FC<CanvasPopupNotificationProps> = ({
  message,
  type,
}) => {
  const popupStyles = getPopupNotificationStyles(type);
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, maxWidth: 480, width: 'max-content',
      maxHeight: '60vh', overflowY: 'auto',
      background: popupStyles.background,
      border: popupStyles.border,
      color: popupStyles.color,
      borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 500,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', boxSizing: 'border-box',
    }}>
      {message}
    </div>
  );
};
