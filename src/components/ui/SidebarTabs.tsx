import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToolsPanel } from './ToolsPanel';
import { VsumsPanel } from './VsumsPanel';

interface SidebarTabsProps {
  width?: number;
  showBorder?: boolean;
}

export const SidebarTabs: React.FC<SidebarTabsProps> = ({ width = 350, showBorder = true }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const active = location.pathname.startsWith('/project') ? 'project' : location.pathname.startsWith('/mml') ? 'mml' : 'welcome';

  const tabBase: React.CSSProperties = {
    flex: 1,
    padding: '14.4px 12px',
    border: '1px solid #e5e7eb',
    borderBottom: 'none',
    background: '#f9fafb',
    color: '#374151',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
    userSelect: 'none',
  };

  const activeTab: React.CSSProperties = {
    background: '#ffffff',
    color: '#111827',
    borderBottom: '1px solid #ffffff',
  };

  const inactiveTabHover: React.CSSProperties = {
    background: '#f3f4f6',
  };

  return (
    <div style={{ width, height: '100%', display: 'flex', flexDirection: 'column', background: '#ffffff', borderRight: showBorder ? '1px solid #e5e7eb' : 'none' }}>
      <div style={{ display: 'flex', gap: 0, padding: 0, margin: 0, position: 'sticky', top: 0, zIndex: 1 }}>
        <button
          style={{ ...tabBase, ...(active === 'mml' ? activeTab : {}) }}
          onMouseEnter={(e) => { if (active !== 'mml') Object.assign(e.currentTarget.style, inactiveTabHover); }}
          onMouseLeave={(e) => { if (active !== 'mml') Object.assign(e.currentTarget.style, tabBase); }}
          onClick={() => navigate('/mml')}
        >
          MML
        </button>
        <button
          style={{ ...tabBase, ...(active === 'project' ? activeTab : {}) }}
          onMouseEnter={(e) => { if (active !== 'project') Object.assign(e.currentTarget.style, inactiveTabHover); }}
          onMouseLeave={(e) => { if (active !== 'project') Object.assign(e.currentTarget.style, tabBase); }}
          onClick={() => navigate('/project')}
        >
          Project
        </button>
      </div>
      <div style={{ borderTop: '1px solid #e5e7eb', height: '100%', overflow: 'hidden' }}>
        {active === 'project' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <VsumsPanel />
          </div>
        )}
        {active === 'mml' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <ToolsPanel title="Meta Models" allowCreate enableItemClick showBorder={false} />
          </div>
        )}
        {active === 'welcome' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 16, color: '#6b7280' }}>
            <div style={{ fontWeight: 700, color: '#111827', marginBottom: 8 }}>Choose a workspace</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              Select <span style={{ fontWeight: 700 }}>MML</span> to browse and upload Meta Models, or
              select <span style={{ fontWeight: 700 }}>Project</span> to open vSUMS project tools.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


