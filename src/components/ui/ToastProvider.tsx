import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { copyTextToClipboard } from '../../utils/apiErrorMessage';

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

const DEFAULT_SUCCESS_MS = 4000;
const DEFAULT_INFO_MS = 4000;
/** Stay until the user closes it — errors must be readable and copyable. */
const DEFAULT_ERROR_MS = 0;

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 16,
  right: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  zIndex: 2000,
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
  gap: 10,
};

function getToastStyle(type: ToastType): React.CSSProperties {
  if (type === 'success') {
    return {
      ...baseToastStyle,
      borderColor: '#c6f6d5',
      backgroundColor: '#f0fff4',
    };
  }
  if (type === 'error') {
    return {
      ...baseToastStyle,
      borderColor: '#feb2b2',
      backgroundColor: '#fff5f5',
    };
  }
  return {
    ...baseToastStyle,
    borderColor: '#bee3f8',
    backgroundColor: '#ebf8ff',
  };
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: '18px',
  color: '#111827',
  userSelect: 'text',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  flex: 1,
};

const actionButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: '#6b7280',
  fontSize: 12,
  fontWeight: 600,
  padding: 0,
  flexShrink: 0,
};

function defaultDuration(type: ToastType, durationMs?: number): number {
  if (durationMs != null) return durationMs;
  if (type === 'error') return DEFAULT_ERROR_MS;
  if (type === 'success') return DEFAULT_SUCCESS_MS;
  return DEFAULT_INFO_MS;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const clearTimer = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      globalThis.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const remove = useCallback((id: number) => {
    clearTimer(id);
    setToasts(prev => prev.filter(t => t.id !== id));
  }, [clearTimer]);

  const scheduleRemove = useCallback((id: number, durationMs: number) => {
    clearTimer(id);
    if (durationMs <= 0) return;
    const timer = globalThis.setTimeout(() => remove(id), durationMs);
    timersRef.current.set(id, timer);
  }, [clearTimer, remove]);

  const push = useCallback((type: ToastType, message: string, durationMs?: number) => {
    const id = idRef.current++;
    const resolvedDuration = defaultDuration(type, durationMs);
    const toast: ToastItem = { id, type, message, durationMs: resolvedDuration };
    setToasts(prev => [toast, ...prev]);
    scheduleRemove(id, resolvedDuration);
  }, [scheduleRemove]);

  const value = useMemo<ToastContextValue>(() => ({
    showSuccess: (message, durationMs) => push('success', message, durationMs),
    showError: (message, durationMs) => push('error', message, durationMs),
    showInfo: (message, durationMs) => push('info', message, durationMs),
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div style={containerStyle} aria-live="assertive" aria-atomic="true">
        {toasts.map(t => (
          <output
            key={t.id}
            style={getToastStyle(t.type)}
            onMouseEnter={() => clearTimer(t.id)}
            onMouseLeave={() => scheduleRemove(t.id, t.durationMs)}
          >
            <p style={titleStyle}>{t.message}</p>
            {t.type === 'error' && (
              <button
                type="button"
                style={actionButtonStyle}
                onClick={() => { void copyTextToClipboard(t.message); }}
                aria-label="Copy error message"
              >
                Copy
              </button>
            )}
            <button
              type="button"
              style={{ ...actionButtonStyle, fontSize: 14, marginLeft: t.type === 'error' ? 0 : 'auto' }}
              onClick={() => remove(t.id)}
              aria-label="Close"
            >
              ×
            </button>
          </output>
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
