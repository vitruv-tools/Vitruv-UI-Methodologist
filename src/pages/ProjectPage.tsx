import React, { useEffect, useState } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { MetaModelsPanel } from '../components/ui/MetaModelsPanel';
import { SidebarTabs } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { VsumTabs } from '../components/ui/VsumTabs';
import { apiService } from '../services/api';

export const ProjectPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const [showRight, setShowRight] = useState(false);
  const [openVsums, setOpenVsums] = useState<number[]>([]);
  const [activeVsumId, setActiveVsumId] = useState<number | null>(null);

  useEffect(() => {
    const handler = async (e: Event) => {
      const custom = e as CustomEvent<{ id: number }>;
      const id = custom.detail?.id;
      if (typeof id !== 'number') return;
      setOpenVsums(prev => prev.includes(id) ? prev : [...prev, id]);
      setActiveVsumId(id);

      // Fetch vsum details and load meta models into workspace
      try {
        const response = await apiService.getVsumDetails(id);
        const details = response.data;
        
        // Load each meta model into workspace
        for (const metaModel of details.metaModels || []) {
          if (metaModel.ecoreFileId) {
            try {
              const fileContent = await apiService.getFile(metaModel.ecoreFileId);
              
              // Dispatch event to add file to workspace
              window.dispatchEvent(new CustomEvent('vitruv.addFileToWorkspace', {
                detail: {
                  fileContent: fileContent,
                  fileName: metaModel.name + '.ecore',
                  description: metaModel.description,
                  keywords: metaModel.keyword?.join(', '),
                  domain: metaModel.domain,
                  createdAt: metaModel.createdAt,
                }
              }));
            } catch (error) {
              console.error(`Failed to load ECORE file for meta model ${metaModel.name}:`, error);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch vsum details:', error);
      }
    };
    window.addEventListener('vitruv.openVsum', handler as EventListener);
    return () => window.removeEventListener('vitruv.openVsum', handler as EventListener);
  }, []);

  return (
    <MainLayout
      user={user}
      onLogout={signOut}
      leftSidebar={<SidebarTabs width={350} />}
      leftSidebarWidth={350}
      showWelcomeScreen={openVsums.length === 0}
      welcomeTitle="Welcome to Project Workspace"
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
            <MetaModelsPanel
              activeVsumId={activeVsumId || undefined}
              selectedMetaModelIds={activeVsumId ? (openVsums.includes(activeVsumId) ? [] : []) : []}
              onAddToActiveVsum={async (model) => {
                // Fetch file content from the API
                try {
                  if (model.ecoreFileId) {
                    const fileContent = await apiService.getFile(model.ecoreFileId);
                    
                    // Dispatch event to add file to workspace
                    window.dispatchEvent(new CustomEvent('vitruv.addFileToWorkspace', {
                      detail: {
                        fileContent: fileContent,
                        fileName: model.name + '.ecore',
                        description: model.description,
                        keywords: model.keyword?.join(', '),
                        domain: model.domain,
                      }
                    }));
                  }
                  
                  // Also dispatch the event to add meta model to VSUM
                  window.dispatchEvent(new CustomEvent('vitruv.addMetaModelToActiveVsum', { detail: { id: model.id } }));
                } catch (error) {
                  console.error('Failed to fetch file:', error);
                  // Still dispatch the add event even if file fetch fails
                  window.dispatchEvent(new CustomEvent('vitruv.addMetaModelToActiveVsum', { detail: { id: model.id } }));
                }
              }}
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
          showAddButton={!showRight}
          onAddMetaModels={() => setShowRight(true)}
        />
      ) : null}
      showWorkspaceInfo={false}
    />
  );
};


