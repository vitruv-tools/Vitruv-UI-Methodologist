import React, { useRef } from 'react';
import { OpenCanvasTab } from '../../types/canvasTab';
import { ProjectPickerMenu } from './ProjectPickerMenu';

const MAX_VISIBLE_TABS = 4;
const TAB_GAP = 3;
const TAB_WIDTH_NORMAL = 128;
const TAB_WIDTH_COMPACT = 96;
const TRACKPAD_SCROLL_HINT = 'Scroll with two fingers on your trackpad to see more tabs';

const pillShellBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  background: '#ffffff',
  borderRadius: 6,
  boxShadow: '0 2px 10px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)',
  height: 38,
  padding: '0 5px',
  gap: 4,
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  overflow: 'hidden',
  minWidth: 0,
  maxWidth: 'min(520px, 72vw)',
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
  const scrollRef = useRef<HTMLDivElement>(null);

  if (tabs.length === 0) return null;

  const useCompactTabs = tabs.length > MAX_VISIBLE_TABS;
  const visibleTabSlots = Math.min(tabs.length, MAX_VISIBLE_TABS);
  const tabWidth = useCompactTabs ? TAB_WIDTH_COMPACT : TAB_WIDTH_NORMAL;
  const scrollAreaMaxWidth =
    visibleTabSlots * tabWidth + Math.max(0, visibleTabSlots - 1) * TAB_GAP;
  const isScrollable = tabs.length > MAX_VISIBLE_TABS;

  const handleTabStripWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    e.stopPropagation();
  };

  return (
    <div style={pillShellBase}>
      <div
        style={{
          position: 'relative',
          flex: '1 1 auto',
          minWidth: 0,
          maxWidth: scrollAreaMaxWidth,
        }}
      >
        <div
          ref={scrollRef}
          className="canvas-project-tabs-scroll"
          role="tablist"
          aria-label="Open projects"
          title={isScrollable ? TRACKPAD_SCROLL_HINT : undefined}
          onWheel={handleTabStripWheel}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: TAB_GAP,
            overflowX: isScrollable ? 'scroll' : 'hidden',
            overflowY: 'hidden',
            padding: '0 2px',
            minWidth: 0,
            scrollbarWidth: 'thin',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
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
                  gap: useCompactTabs ? 3 : 4,
                  padding: useCompactTabs ? '0 7px' : '0 10px',
                  height: useCompactTabs ? 26 : 28,
                  borderRadius: 5,
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
                      width: useCompactTabs ? 4 : 5,
                      height: useCompactTabs ? 4 : 5,
                      borderRadius: '50%',
                      background: '#f59e0b',
                      flexShrink: 0,
                    }}
                  />
                )}
                <span
                  style={{
                    fontSize: useCompactTabs ? 11 : 12,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#049484' : '#64748b',
                    whiteSpace: 'nowrap',
                    maxWidth: useCompactTabs ? 80 : 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={label}
                >
                  {label}
                  {duplicateCount > 1 && (
                    <span style={{ marginLeft: 3, fontSize: useCompactTabs ? 8 : 9, color: '#94a3b8' }}>
                      #{tab.projectId}
                    </span>
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
                    fontSize: useCompactTabs ? 12 : 13,
                    lineHeight: 1,
                    padding: 0,
                    width: useCompactTabs ? 14 : 16,
                    height: useCompactTabs ? 14 : 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
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
        {isScrollable && (
          <div
            aria-hidden
            title={TRACKPAD_SCROLL_HINT}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: 14,
              pointerEvents: 'none',
              background: 'linear-gradient(to right, transparent, #ffffff)',
            }}
          />
        )}
      </div>
      <style>{`
        .canvas-project-tabs-scroll::-webkit-scrollbar { height: 5px; }
        .canvas-project-tabs-scroll::-webkit-scrollbar-track { background: transparent; }
        .canvas-project-tabs-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .canvas-project-tabs-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      <div style={{ width: 1, height: 22, background: '#e2e8f0', flexShrink: 0 }} />

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
