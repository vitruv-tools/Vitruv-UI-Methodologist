import React, { useEffect, useState } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { MetaModelsPanel } from '../components/ui/MetaModelsPanel';
import { SidebarTabs } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { VsumTabs } from '../components/ui/VsumTabs';

export const ProjectPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const [showRight, setShowRight] = useState(false);
  const [openVsums, setOpenVsums] = useState<number[]>([]);
  const [activeVsumId, setActiveVsumId] = useState<number | null>(null);
  const [selectedMetaModelIds, setSelectedMetaModelIds] = useState<number[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ id: number }>;
      const id = custom.detail?.id;
      if (typeof id !== 'number') return;
      setOpenVsums(prev => prev.includes(id) ? prev : [...prev, id]);
      setActiveVsumId(id);
    };
    window.addEventListener('vitruv.openVsum', handler as EventListener);
    return () => window.removeEventListener('vitruv.openVsum', handler as EventListener);
  }, []);

  // Listen for active Vsum meta model selection changes to reflect in MetaModelsPanel
  useEffect(() => {
    const onActiveIds = (e: Event) => {
      const ce = e as CustomEvent<{ ids: number[] }>;
      const ids = Array.isArray(ce.detail?.ids) ? ce.detail!.ids : [];
      setSelectedMetaModelIds(ids);
    };
    window.addEventListener('vitruv.activeVsumMetaModels', onActiveIds as EventListener);
    return () => window.removeEventListener('vitruv.activeVsumMetaModels', onActiveIds as EventListener);
  }, []);

  return (
    <MainLayout
      user={user}
      onLogout={signOut}
      leftSidebar={<SidebarTabs />}
      leftSidebarInitialWidth={350}
      rightSidebar={showRight ? (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <button
            onClick={() => setShowRight(false)}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: '#f3f4f6',
              color: '#111827',
              border: '1px solid #d1d5db',
              borderRadius: '100%',
              padding: '3px 10px 6px 10px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#e5e7eb'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
          >
            x
          </button>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <MetaModelsPanel
              activeVsumId={activeVsumId || undefined}
              selectedMetaModelIds={activeVsumId ? selectedMetaModelIds : []}
              onAddToActiveVsum={(model) => {
                window.dispatchEvent(new CustomEvent('vitruv.addMetaModelToActiveVsum', { detail: { id: model.id } }));
              }}
              initialWidth={350}
            />
          </div>
        </div>
      ) : null}
      rightSidebarWidth={350}
      workspaceOverlay={openVsums.length > 0 ? (
        <VsumTabs
          openVsums={openVsums}
          activeVsumId={activeVsumId}
          onActivate={(id) => setActiveVsumId(id)}
          onClose={(id) => {
            setOpenVsums(prev => prev.filter(x => x !== id));
            setActiveVsumId(prev => (prev === id ? (openVsums.find(x => x !== id) ?? null) : prev));
          }}
        />
      ) : null}
      workspaceTopRightSlot={!showRight ? (
        <button
          style={{
            background: '#3498db',
            color: '#ffffff',
            border: '1px solid #2980b9',
            borderRadius: 6,
            padding: '8px 12px',
            fontWeight: 700,
            cursor: 'pointer',
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


