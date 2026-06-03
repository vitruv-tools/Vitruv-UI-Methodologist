import React from 'react';
import { OpenCanvasTab } from '../../types/canvasTab';
import { ProjectPickerMenu } from './ProjectPickerMenu';

const pillShell: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  background: '#ffffff',
  borderRadius: 6,
  boxShadow: '0 2px 10px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)',
  height: 32,
  padding: '0 4px',
  gap: 3,
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
};

interface CanvasProjectTabsProps {
  tabs: OpenCanvasTab[];
  activeInstanceId: string | null;
  activeProjectId?: number;
  openProjectIds: number[];
  dirtyInstanceIds?: Set<string>;
  loading?: boolean;
  onActivate: (instanceId: string) => void;
  onRequestClose: (instanceId: string) => void;
  onSelectProject: (projectId: number, name: string) => void;
}

export const CanvasProjectTabs: React.FC<CanvasProjectTabsProps> = ({
  tabs,
  activeInstanceId,
  activeProjectId,
  openProjectIds,
  dirtyInstanceIds = new Set(),
  loading = false,
  onActivate,
  onRequestClose,
  onSelectProject,
}) => {
  if (tabs.length === 0) return null;

  return (
    <div style={pillShell}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          overflowX: 'auto',
          maxWidth: 'min(360px, 50vw)',
          padding: '0 2px',
        }}
      >
        {tabs.map(tab => {
          const isActive = tab.instanceId === activeInstanceId;
          const isDirty = dirtyInstanceIds.has(tab.instanceId);
          const label = tab.name || `Project #${tab.projectId}`;
          const duplicateCount = tabs.filter(t => t.projectId === tab.projectId).length;

          return (
            <div
              key={tab.instanceId}
              role="tab"
              tabIndex={0}
              aria-selected={isActive}
              onClick={() => onActivate(tab.instanceId)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onActivate(tab.instanceId);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '0 8px',
                height: 24,
                borderRadius: 4,
                border: isActive ? '1px solid #049484' : '1px solid #e5e7eb',
                background: isActive ? '#f0fdfc' : '#fafafa',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = '#f1f5f9';
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = '#fafafa';
              }}
            >
              {isDirty && (
                <span
                  title="Unsaved changes"
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: '#f59e0b',
                    flexShrink: 0,
                  }}
                />
              )}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#049484' : '#64748b',
                  whiteSpace: 'nowrap',
                  maxWidth: 110,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={label}
              >
                {label}
                {duplicateCount > 1 && (
                  <span style={{ marginLeft: 3, fontSize: 9, color: '#94a3b8' }}>#{tab.projectId}</span>
                )}
              </span>
              <button
                type="button"
                aria-label={`Close ${label}`}
                onClick={e => {
                  e.stopPropagation();
                  onRequestClose(tab.instanceId);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: 12,
                  lineHeight: 1,
                  padding: 0,
                  width: 14,
                  height: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ width: 1, height: 18, background: '#e2e8f0', flexShrink: 0 }} />

      <ProjectPickerMenu
        variant="compact"
        currentProjectId={activeProjectId}
        activeProjectId={activeProjectId}
        openProjectIds={openProjectIds}
        currentProjectName=""
        disabled={loading}
        onSelectProject={p => onSelectProject(p.id, p.name)}
      />
    </div>
  );
};
