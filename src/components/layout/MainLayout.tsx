import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { FlowCanvas } from '../flow/FlowCanvas';
import { ToolsPanel } from '../ui/ToolsPanel';

interface MainLayoutProps {
  onDeploy?: (nodes: any[], edges: any[]) => void;
  onSave?: () => void;
  onLoad?: () => void;
  onNew?: () => void;
}

export function MainLayout({ onDeploy, onSave, onLoad, onNew }: MainLayoutProps) {
  const [selectedDiagramType, setSelectedDiagramType] = useState<string | undefined>();
  const [showToolsPanel, setShowToolsPanel] = useState(false);

  const handleDiagramSelection = (diagramType: string) => {
    console.log('Diagram selected:', diagramType);
    setSelectedDiagramType(diagramType);
    setShowToolsPanel(true);
  };

  const handleCloseToolsPanel = () => {
    console.log('Closing tools panel');
    setShowToolsPanel(false);
    setSelectedDiagramType(undefined);
  };

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      display: 'flex',
      overflow: 'hidden'
    }}>
      <Sidebar onDiagramSelect={handleDiagramSelection} />
      <div style={{ 
        flexGrow: 1, 
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0, // Prevents flex item from overflowing
        marginLeft: 0 // Ensure no gap
      }}>
        <Header 
          onSave={onSave}
          onLoad={onLoad}
          onNew={onNew}
        />
        
        {/* Status indicator */}
        {showToolsPanel && (
          <div style={{
            background: '#e3f2fd',
            borderBottom: '1px solid #2196f3',
            padding: '8px 20px',
            fontSize: '14px',
            color: '#1976d2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>
              🎯 Active: {selectedDiagramType === 'class' ? 'UML Class Diagram' : selectedDiagramType} Tools
            </span>
            <button
              onClick={handleCloseToolsPanel}
              style={{
                background: 'none',
                border: '1px solid #2196f3',
                borderRadius: '4px',
                padding: '4px 8px',
                color: '#2196f3',
                cursor: 'pointer',
                fontSize: '12px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#2196f3';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = '#2196f3';
              }}
            >
              Close Tools
            </button>
          </div>
        )}
        
        <div style={{ flexGrow: 1, position: 'relative', display: 'flex' }}>
          <FlowCanvas onDeploy={onDeploy} />
          <ToolsPanel 
            isVisible={showToolsPanel} 
            diagramType={selectedDiagramType}
            onClose={handleCloseToolsPanel}
          />
        </div>
      </div>
    </div>
  );
} 