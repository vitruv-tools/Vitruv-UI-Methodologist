import React from 'react';

interface HeaderProps {
  onSave?: () => void;
  onLoad?: () => void;
  onNew?: () => void;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  title?: string;
}

export function Header({ 
  onSave, 
  onLoad, 
  onNew, 
  onToggleSidebar, 
  sidebarOpen = true, 
  title = 'Vitruvius Modeler' 
}: HeaderProps) {
  return (
    <header style={{
      height: '60px',
      background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      position: 'relative',
      zIndex: 20,
      minHeight: '60px',
    }} className="header-responsive">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: 'pointer',
              padding: '8px 12px',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
            }}
            title={sidebarOpen ? 'Close Sidebar' : 'Open Sidebar'}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            }}
          >
            ☰
          </button>
        )}
        <h1 style={{ 
          margin: 0, 
          fontSize: '20px', 
          fontWeight: 600,
          textShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}>
          {title}
        </h1>
      </div>
      
      <div style={{ display: 'flex', gap: '12px' }}>
        {onNew && (
          <Button onClick={onNew} variant="primary" size="small">
            New
          </Button>
        )}
        {onLoad && (
          <Button onClick={onLoad} variant="secondary" size="small">
            Load
          </Button>
        )}
        {onSave && (
          <Button onClick={onSave} variant="secondary" size="small">
            Save
          </Button>
        )}
      </div>
    </header>
  );
} 