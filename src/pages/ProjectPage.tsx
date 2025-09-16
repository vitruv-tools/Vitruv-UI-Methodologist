import React, { useState } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { MetaModelsPanel } from '../components/ui/MetaModelsPanel';
import { VsumsPanel } from '../components/ui/VsumsPanel';
import { useAuth } from '../contexts/AuthContext';

export const ProjectPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const [showRight, setShowRight] = useState(false);

  return (
    <MainLayout
      user={user}
      onLogout={signOut}
      leftSidebar={<VsumsPanel />}
      leftSidebarWidth={350}
      rightSidebar={showRight ? (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            padding: 8,
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
            background: '#ffffff'
          }}>
            <button
              onClick={() => setShowRight(false)}
              style={{
                background: '#f3f4f6',
                color: '#111827',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                padding: '6px 10px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#e5e7eb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
            >
              Close
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <MetaModelsPanel />
          </div>
        </div>
      ) : null}
      rightSidebarWidth={350}
      workspaceTopRightSlot={!showRight ? (
        <button
          style={{
            background: '#3498db',
            color: '#ffffff',
            border: '1px solid #2980b9',
            borderRadius: 6,
            padding: '8px 12px',
            fontWeight: 700,
            cursor: 'pointer'
          }}
          onClick={() => setShowRight(true)}
        >
          + ADD META MODELS
        </button>
      ) : null}
      showWorkspaceInfo={false}
    />
  );
};


