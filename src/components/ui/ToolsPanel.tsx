import React, { useState } from 'react';

interface ToolsPanelProps {
  isVisible: boolean;
  diagramType?: string;
  onClose?: () => void;
}

const toolsPanelStyle: React.CSSProperties = {
  width: '300px',
  background: '#ffffff',
  borderLeft: '1px solid #e0e0e0',
  padding: '20px',
  boxSizing: 'border-box',
  height: '100vh',
  overflowY: 'auto',
  boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
  transition: 'transform 0.3s ease',
  transform: 'translateX(0)',
};

const hiddenStyle: React.CSSProperties = {
  ...toolsPanelStyle,
  transform: 'translateX(100%)',
};

const titleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 'bold',
  marginBottom: '20px',
  color: '#333',
  textAlign: 'center',
  padding: '10px 0',
  borderBottom: '2px solid #3498db',
  position: 'relative',
};

const closeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  right: '0',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  fontSize: '18px',
  cursor: 'pointer',
  color: '#666',
  padding: '4px 8px',
  borderRadius: '4px',
  transition: 'all 0.2s ease',
};

const closeButtonHoverStyle: React.CSSProperties = {
  background: '#f8f9fa',
  color: '#333',
};

const toolGroupStyle: React.CSSProperties = {
  marginBottom: '24px',
};

const groupTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#555',
  marginBottom: '12px',
  padding: '8px 0',
  borderBottom: '1px solid #e0e0e0',
};

const toolButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '16px 20px',
  margin: '8px 0',
  border: '2px solid #e0e0e0',
  borderRadius: '8px',
  background: '#ffffff',
  color: '#333',
  fontSize: '14px',
  cursor: 'grab',
  transition: 'all 0.3s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  userSelect: 'none',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
};

const toolButtonHoverStyle: React.CSSProperties = {
  background: '#f8f9fa',
  borderColor: '#3498db',
  transform: 'translateY(-2px)',
  boxShadow: '0 4px 12px rgba(52, 152, 219, 0.2)',
};

const toolButtonDraggingStyle: React.CSSProperties = {
  background: '#e3f2fd',
  borderColor: '#2196f3',
  transform: 'scale(0.98)',
  opacity: 0.9,
  boxShadow: '0 6px 20px rgba(33, 150, 243, 0.3)',
};

const toolIconStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '6px',
  background: '#3498db',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontSize: '14px',
  fontWeight: 'bold',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
};

export const ToolsPanel: React.FC<ToolsPanelProps> = ({ isVisible, diagramType, onClose }) => {
  const [toolUsage, setToolUsage] = useState<Record<string, number>>({});

  if (!isVisible) return null;

  const handleDragStart = (event: React.DragEvent, toolType: string, toolName: string) => {
    console.log('Drag start for tool:', toolType, toolName);
    
    // Increment usage counter
    setToolUsage(prev => ({
      ...prev,
      [toolName]: (prev[toolName] || 0) + 1
    }));
    
    // Set drag data
    event.dataTransfer.setData('application/tool', JSON.stringify({
      type: toolType,
      name: toolName,
      diagramType: diagramType
    }));
    event.dataTransfer.effectAllowed = 'copy';
    
    // Set drag image with UML representation
    const dragElement = event.currentTarget as HTMLElement;
    const rect = dragElement.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      // Draw UML-style preview
      if (toolType === 'element') {
        // Draw UML rectangle with compartments
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rect.width, rect.height);
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, rect.width - 2, rect.height - 2);
        
        // Draw compartment dividers
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, rect.height * 0.3);
        ctx.lineTo(rect.width, rect.height * 0.3);
        ctx.moveTo(0, rect.height * 0.6);
        ctx.lineTo(rect.width, rect.height * 0.6);
        ctx.stroke();
        
        // Draw text
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(toolName, rect.width / 2, 20);
        
        if (toolName === 'interface') {
          ctx.font = 'italic 12px Arial';
          ctx.fillText('<<interface>>', rect.width / 2, 35);
        }
      } else {
        // Draw simple tool preview
        ctx.fillStyle = '#e3f2fd';
        ctx.fillRect(0, 0, rect.width, rect.height);
        ctx.fillStyle = '#2196f3';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(toolName, rect.width / 2, rect.height / 2 + 5);
      }
      
      event.dataTransfer.setDragImage(canvas, rect.width / 2, rect.height / 2);
    }
    
    // Add visual feedback
    const target = event.currentTarget as HTMLElement;
    Object.assign(target.style, toolButtonDraggingStyle);
  };

  const handleDragEnd = (event: React.DragEvent) => {
    console.log('Drag end for tool');
    // Reset visual feedback
    const target = event.currentTarget as HTMLElement;
    Object.assign(target.style, toolButtonStyle);
  };

  // Helper function to render tool button with usage counter
  const renderToolButton = (toolType: string, toolName: string, displayName: string, iconColor: string) => {
    const usageCount = toolUsage[toolName] || 0;
    
    // Get appropriate icon for UML elements
    const getIcon = () => {
      if (toolType === 'element') {
        switch (toolName) {
          case 'class':
            return '⬜';
          case 'abstract-class':
            return '⬜';
          case 'interface':
            return '⬜';
          case 'enumeration':
            return '⬜';
          case 'package':
            return '📦';
          default:
            return toolName.charAt(0).toUpperCase();
        }
      } else if (toolType === 'member') {
        switch (toolName) {
          case 'attribute':
            return '🔧';
          case 'method':
            return '⚙️';
          default:
            return toolName.charAt(0).toUpperCase();
        }
      } else if (toolType === 'relationship') {
        switch (toolName) {
          case 'association':
            return '↔️';
          case 'aggregation':
            return '◇';
          case 'composition':
            return '◆';
          case 'inheritance':
            return '△';
          case 'realization':
            return '⟶';
          case 'dependency':
            return '⟶';
          default:
            return toolName.charAt(0).toUpperCase();
        }
      } else if (toolType === 'multiplicity') {
        return toolName.charAt(0).toUpperCase();
      }
      return toolName.charAt(0).toUpperCase();
    };
    
    return (
      <button 
        style={toolButtonStyle} 
        draggable={true}
        onDragStart={(e) => handleDragStart(e, toolType, toolName)}
        onDragEnd={handleDragEnd}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, toolButtonHoverStyle)} 
        onMouseLeave={(e) => Object.assign(e.currentTarget.style, toolButtonStyle)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '16px' }}>{getIcon()}</span>
          <span style={{ fontWeight: '500' }}>{displayName}</span>
          {usageCount > 0 && (
            <span style={{
              background: '#e3f2fd',
              color: '#1976d2',
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '12px',
              fontWeight: 'bold',
              marginLeft: 'auto'
            }}>
              {usageCount}
            </span>
          )}
        </div>
        <div style={{...toolIconStyle, background: iconColor}}>
          {toolName.charAt(0).toUpperCase()}
        </div>
      </button>
    );
  };

  const renderClassDiagramTools = () => (
    <>
      <div style={toolGroupStyle}>
        <div style={groupTitleStyle}>Elements</div>
        {renderToolButton('element', 'class', 'Class', '#2ecc71')}
        {renderToolButton('element', 'abstract-class', 'Abstract Class', '#16a085')}
        {renderToolButton('element', 'interface', 'Interface', '#e74c3c')}
        {renderToolButton('element', 'enumeration', 'Enumeration', '#9b59b6')}
        {renderToolButton('element', 'package', 'Package', '#f39c12')}
      </div>

      <div style={toolGroupStyle}>
        <div style={groupTitleStyle}>Members</div>
        {renderToolButton('member', 'attribute', 'Attribute', '#1abc9c')}
        {renderToolButton('member', 'method', 'Method', '#d35400')}
      </div>

      <div style={toolGroupStyle}>
        <div style={groupTitleStyle}>Relationships</div>
        {renderToolButton('relationship', 'association', 'Association', '#34495e')}
        {renderToolButton('relationship', 'aggregation', 'Aggregation', '#27ae60')}
        {renderToolButton('relationship', 'composition', 'Composition', '#8e44ad')}
        {renderToolButton('relationship', 'inheritance', 'Inheritance', '#16a085')}
        {renderToolButton('relationship', 'realization', 'Realization', '#e67e22')}
        {renderToolButton('relationship', 'dependency', 'Dependency', '#95a5a6')}
      </div>

      <div style={toolGroupStyle}>
        <div style={groupTitleStyle}>Multiplicity</div>
        {renderToolButton('multiplicity', 'one', '1', '#e74c3c')}
        {renderToolButton('multiplicity', 'many', '*', '#3498db')}
        {renderToolButton('multiplicity', 'optional', '0..1', '#f39c12')}
        {renderToolButton('multiplicity', 'range', '1..*', '#9b59b6')}
      </div>

      {/* Usage summary */}
      <div style={{
        marginTop: '30px',
        padding: '16px',
        background: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#495057',
          marginBottom: '12px',
          textAlign: 'center'
        }}>
          📊 Usage Summary
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px',
          fontSize: '12px'
        }}>
          {Object.entries(toolUsage).map(([toolName, count]) => (
            <div key={toolName} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '4px 8px',
              background: '#ffffff',
              borderRadius: '4px',
              border: '1px solid #dee2e6'
            }}>
              <span style={{ color: '#6c757d' }}>{toolName}</span>
              <span style={{ fontWeight: 'bold', color: '#007bff' }}>{count}</span>
            </div>
          ))}
          {Object.keys(toolUsage).length === 0 && (
            <div style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              color: '#6c757d',
              fontStyle: 'italic',
              padding: '8px'
            }}>
              No tools used yet
            </div>
          )}
        </div>
      </div>
    </>
  );

  const renderDefaultTools = () => (
    <div style={{ textAlign: 'center', color: '#666', padding: '40px 20px' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px', color: '#3498db' }}>⚙️</div>
      <div>Select a diagram type to see available tools</div>
    </div>
  );

  return (
    <div style={isVisible ? toolsPanelStyle : hiddenStyle}>
      <div style={titleStyle}>
        TOOLS
        {onClose && (
          <button 
            style={closeButtonStyle}
            onClick={onClose}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, closeButtonHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, closeButtonStyle)}
            title="Close Tools Panel"
          >
            ×
          </button>
        )}
      </div>
      {diagramType === 'class' ? renderClassDiagramTools() : renderDefaultTools()}
    </div>
  );
};
