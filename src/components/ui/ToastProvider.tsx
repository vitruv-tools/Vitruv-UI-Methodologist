import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  durationMs: number;
}

interface ToastContextValue {
  showSuccess: (message: string, durationMs?: number) => void;
  showError: (message: string, durationMs?: number) => void;
  showInfo: (message: string, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 16,
  right: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  zIndex: 2000
};

const baseToastStyle: React.CSSProperties = {
  minWidth: 280,
  maxWidth: 420,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid transparent',
  boxShadow: '0 10px 20px rgba(0,0,0,0.15)',
  color: '#1f2937',
  backgroundColor: '#ffffff',
  fontSize: 13,
  fontWeight: 500,
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10
};

function getToastStyle(type: ToastType): React.CSSProperties {
  if (type === 'success') {
    return {
      ...baseToastStyle,
      borderColor: '#c6f6d5',
      backgroundColor: '#f0fff4'
    };
  }
  if (type === 'error') {
    return {
      ...baseToastStyle,
      borderColor: '#feb2b2',
      backgroundColor: '#fff5f5'
    };
  }
  return {
    ...baseToastStyle,
    borderColor: '#bee3f8',
    backgroundColor: '#ebf8ff'
  };
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: '18px',
  color: '#111827'
};

const closeButtonStyle: React.CSSProperties = {
  marginLeft: 'auto',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: '#6b7280',
  fontSize: 14
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type: ToastType, message: string, durationMs = 3000) => {
    const id = idRef.current++;
    const toast: ToastItem = { id, type, message, durationMs };
    setToasts((prev) => [toast, ...prev]);
    window.setTimeout(() => remove(id), durationMs);
  }, [remove]);

  const value = useMemo<ToastContextValue>(() => ({
    showSuccess: (message: string, durationMs?: number) => push('success', message, durationMs),
    showError: (message: string, durationMs?: number) => push('error', message, durationMs),
    showInfo: (message: string, durationMs?: number) => push('info', message, durationMs)
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div style={containerStyle} aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} style={getToastStyle(t.type)} role="status">
            <p style={titleStyle}>{t.message}</p>
            <button style={closeButtonStyle} onClick={() => remove(t.id)} aria-label="Close">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

