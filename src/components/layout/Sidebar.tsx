import React from 'react';
import { ToolsPanel } from '../ui/ToolsPanel';

interface SidebarProps {
  onDiagramSelect?: (diagramType: string) => void;
  onEcoreFileUpload?: (fileContent: string, meta?: { fileName?: string; uploadId?: string; description?: string; keywords?: string; domain?: string; createdAt?: string }) => void;
  onEcoreFileDelete?: (fileName: string) => void;
}

const sidebarStyle: React.CSSProperties = {
  width: '350px',
  background: '#ffffff',
  boxSizing: 'border-box',
  height: '100vh',
  borderRight: '1px solid #e0e0e0',
  overflowY: 'auto',
  overflowX: 'hidden',
};

// ... existing code ...

export function Sidebar({ onDiagramSelect, onEcoreFileUpload, onEcoreFileDelete }: Readonly<SidebarProps>) {
  return (
    <aside style={sidebarStyle}>
      <ToolsPanel
        onEcoreFileUpload={onEcoreFileUpload}
        onEcoreFileDelete={onEcoreFileDelete}
      />
    </aside>
  );
} 