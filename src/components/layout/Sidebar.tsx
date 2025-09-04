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
  padding: '10px 10px',
  boxSizing: 'border-box',
  height: '100vh',
  borderRight: '1px solid #e0e0e0',
  overflowY: 'auto',
  overflowX: 'hidden',
};

const titleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 'bold',
  marginBottom: '10px',
  color: '#333',
  textAlign: 'left',
  padding: '4px 0',
  borderBottom: '1px solid #e0e0e0',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: '500',
  marginBottom: '16px',
  color: '#666',
  textAlign: 'left',
  padding: '2px 0',
  fontStyle: 'italic',
};

export function Sidebar({ onDiagramSelect, onEcoreFileUpload, onEcoreFileDelete }: SidebarProps) {
  return (
    <aside style={sidebarStyle}>
      {/* Subtitle removed as per request */}
      <ToolsPanel
        onEcoreFileUpload={onEcoreFileUpload}
        onEcoreFileDelete={onEcoreFileDelete}
      />
    </aside>
  );
} 