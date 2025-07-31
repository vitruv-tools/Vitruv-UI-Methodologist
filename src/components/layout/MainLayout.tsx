import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { FlowCanvas } from '../flow/FlowCanvas';
import { Node, Edge } from 'reactflow';

interface MainLayoutProps {
  onDeploy?: (nodes: Node[], edges: Edge[]) => void;
  onSave?: () => void;
  onLoad?: () => void;
  onNew?: () => void;
}

export function MainLayout({ onDeploy, onSave, onLoad, onNew }: MainLayoutProps) {
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      <Sidebar />
      <div style={{ flexGrow: 1, position: 'relative' }}>
        <Header 
          onSave={onSave}
          onLoad={onLoad}
          onNew={onNew}
        />
        <div>
          <FlowCanvas onDeploy={onDeploy} />
        </div>
      </div>
    </div>
  );
} 