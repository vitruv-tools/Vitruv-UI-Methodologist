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
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      display: 'flex',
      overflow: 'hidden'
    }}>
      <Sidebar />
      <div style={{ 
        flexGrow: 1, 
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0 // Prevents flex item from overflowing
      }}>
        <Header 
          onSave={onSave}
          onLoad={onLoad}
          onNew={onNew}
        />
        <div style={{ flexGrow: 1, position: 'relative' }}>
          <FlowCanvas onDeploy={onDeploy} />
        </div>
      </div>
    </div>
  );
} 