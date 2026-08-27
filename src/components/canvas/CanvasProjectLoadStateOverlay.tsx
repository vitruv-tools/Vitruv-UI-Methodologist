import React from 'react';
import type {
  CanvasProjectLoadState,
  CanvasProjectLoadStatus,
} from '../../utils/canvasProjectLoadState';

interface CanvasProjectLoadStateOverlayProps {
  state: CanvasProjectLoadState;
  projectId?: number;
  onBack: () => void;
  onRetry: () => void;
}

export const CanvasProjectLoadStateOverlay: React.FC<CanvasProjectLoadStateOverlayProps> = ({
  state,
  projectId,
  onBack,
  onRetry,
}) => {
  const isLoading = state.status === 'loading' || state.status === 'hydrating';
  const titleByStatus: Record<CanvasProjectLoadStatus, string> = {
    loading: 'Loading project…',
    hydrating: 'Opening workspace…',
    ready: '',
    forbidden: 'Access denied',
    notFound: 'Project not found',
    error: 'Unable to open project',
  };
  const defaultMessageByStatus: Record<CanvasProjectLoadStatus, string> = {
    loading: projectId ? `Checking access for project ${projectId}.` : 'Checking project access.',
    hydrating: 'Preparing the workspace.',
    ready: '',
    forbidden: 'You do not have permission to open this project.',
    notFound: 'This project does not exist or may have been deleted.',
    error: 'The project could not be loaded. Please try again.',
  };
  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: 5000,
    display: 'grid',
    placeItems: 'center',
    background: 'var(--v-page-bg)',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  };

  const content = (
      <div style={{
        width: 'min(420px, calc(100vw - 32px))',
        padding: '28px 30px',
        background: 'var(--v-surface)',
        border: '1px solid var(--v-border)',
        borderRadius: 14,
        boxShadow: '0 20px 60px rgba(15, 23, 42, 0.12)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 44,
          height: 44,
          margin: '0 auto 16px',
          borderRadius: 999,
          display: 'grid',
          placeItems: 'center',
          background: isLoading ? '#e6f7f5' : '#fef2f2',
          color: isLoading ? '#049484' : '#b91c1c',
          fontSize: 22,
          fontWeight: 700,
        }}>
          {isLoading ? (
            <span style={{
              width: 20,
              height: 20,
              border: '3px solid rgba(4, 148, 132, 0.22)',
              borderTopColor: '#049484',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          ) : '!' }
        </div>
        <h1 style={{
          margin: '0 0 8px',
          color: 'var(--v-text)',
          fontSize: 22,
          lineHeight: 1.2,
        }}>
          {titleByStatus[state.status]}
        </h1>
        <p style={{
          margin: 0,
          color: 'var(--v-text-muted)',
          fontSize: 14,
          lineHeight: 1.6,
        }}>
          {state.message || defaultMessageByStatus[state.status]}
        </p>
        {!isLoading && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 10,
            marginTop: 22,
            flexWrap: 'wrap',
          }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                border: '1px solid var(--v-border)',
                background: 'var(--v-surface)',
                color: 'var(--v-text-secondary)',
                borderRadius: 8,
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Back to project list
            </button>
            {state.status === 'error' && (
              <button
                type="button"
                onClick={onRetry}
                style={{
                  border: '1px solid #037368',
                  background: '#049484',
                  color: '#ffffff',
                  borderRadius: 8,
                  padding: '10px 16px',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>
  );

  if (isLoading) {
    return <output style={overlayStyle}>{content}</output>;
  }

  return (
    <div role="alert" style={overlayStyle}>
      {content}
    </div>
  );
};
