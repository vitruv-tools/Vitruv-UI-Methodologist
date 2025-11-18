import React, { useEffect, useState, useCallback } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { MetaModelsPanel } from '../components/ui/MetaModelsPanel';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { SidebarTabs } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { VsumTabs } from '../components/ui/VsumTabs';
import { apiService } from '../services/api';
import { useToast } from '../components/ui/ToastProvider';
import { WorkspaceSnapshot, WorkspaceSnapshotRequest } from '../types/workspace';

interface OpenTabInstance { instanceId: string; id: number; }

export const ProjectPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const [showRight, setShowRight] = useState(false);
  const [openTabs, setOpenTabs] = useState<OpenTabInstance[]>([]);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
  const [openChoice, setOpenChoice] = useState<{ id: number; existingInstanceId: string } | null>(null);
  const { showInfo } = useToast();

  const createInstanceId = useCallback((id: number) => `${id}-${Date.now()}-${Math.random().toString(36).slice(2,8)}` , []);

  const requestWorkspaceSnapshot = useCallback(() => {
    return new Promise<WorkspaceSnapshot | null>((resolve) => {
      const timeout = window.setTimeout(() => resolve(null), 2000);
      const detail: WorkspaceSnapshotRequest = {
        resolve: (snapshot) => {
          window.clearTimeout(timeout);
          resolve(snapshot);
        },
      };
      window.dispatchEvent(new CustomEvent<WorkspaceSnapshotRequest>('vitruv.requestWorkspaceSnapshot', { detail }));
    });
  }, []);

  const closeActiveWorkspaceTab = useCallback(() => {
    if (!activeInstanceId) return;
    setOpenTabs(prev => {
      const filtered = prev.filter(x => x.instanceId !== activeInstanceId);
      const nextActive = filtered.length > 0 ? filtered[filtered.length - 1].instanceId : null;
      setActiveInstanceId(nextActive);
      return filtered;
    });
    setShowRight(false);
    window.dispatchEvent(new CustomEvent('vitruv.resetWorkspace'));
  }, [activeInstanceId]);

  const openVsumById = useCallback(async (id: number, { forceNew }: { forceNew?: boolean } = {}) => {
    let instanceId = forceNew ? undefined : openTabs.find(t => t.id === id)?.instanceId;
    if (!instanceId) {
      instanceId = createInstanceId(id);
      setOpenTabs(prev => [...prev, { instanceId: instanceId!, id }]);
    } else {
      showInfo('This project is already open. Switched to it.');
    }
    setActiveInstanceId(instanceId);

    await fetchAndLoadProjectBoxes(id);
  }, [openTabs, createInstanceId, showInfo]);

  useEffect(() => {
    const handler = async (e: Event) => {
      const custom = e as CustomEvent<{ id: number; forceNew?: boolean }>;
      const id = custom.detail?.id;
      if (typeof id !== 'number') return;
      const existing = openTabs.find(t => t.id === id);
      if (existing && !custom.detail?.forceNew) {
        setOpenChoice({ id, existingInstanceId: existing.instanceId });
        return;
      }
      await openVsumById(id, { forceNew: custom.detail?.forceNew });
    };
    window.addEventListener('vitruv.openVsum', handler as EventListener);
    return () => window.removeEventListener('vitruv.openVsum', handler as EventListener);
  }, [openTabs, openVsumById]);

  // Close active workspace tab when canvas becomes empty (no boxes)
  useEffect(() => {
    window.addEventListener('vitruv.closeActiveWorkspace', closeActiveWorkspaceTab as EventListener);
    return () => window.removeEventListener('vitruv.closeActiveWorkspace', closeActiveWorkspaceTab as EventListener);
  }, [closeActiveWorkspaceTab]);

  // Ensure "Add Meta Models" sidebar is hidden when no VSUM tabs are open
  useEffect(() => {
    if (openTabs.length === 0 && showRight) {
      setShowRight(false);
    }
  }, [openTabs.length, showRight]);

  return (
    <>
    <MainLayout
      user={user}
      onLogout={signOut}
      leftSidebar={<SidebarTabs width={350} />}
      leftSidebarWidth={350}
      showWelcomeScreen={openTabs.length === 0}
      welcomeTitle="Welcome to Project Workspace"
      rightSidebar={(showRight && openTabs.length > 0) ? (
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
              activeVsumId={activeInstanceId ? (openTabs.find(t => t.instanceId === activeInstanceId)?.id) || undefined : undefined}
              selectedMetaModelIds={[]}
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
                        metaModelId: model.id,
                        metaModelSourceId: model.sourceId ?? model.id,
                      }
                    }));
                  }
                  
                  // Also dispatch the event to add meta model to VSUM
                  window.dispatchEvent(new CustomEvent('vitruv.addMetaModelToActiveVsum', { detail: { id: model.id, sourceId: model.sourceId ?? model.id } }));
                } catch (error) {
                  console.error('Failed to fetch file:', error);
                  // Still dispatch the add event even if file fetch fails
                  window.dispatchEvent(new CustomEvent('vitruv.addMetaModelToActiveVsum', { detail: { id: model.id, sourceId: model.sourceId ?? model.id } }));
                }
              }}
            />
          </div>
        </div>
      ) : null}
      rightSidebarWidth={350}
      workspaceOverlay={openTabs.length > 0 ? (
        <VsumTabs
          openTabs={openTabs}
          activeInstanceId={activeInstanceId}
          onActivate={(instanceId) => setActiveInstanceId(instanceId)}
          onClose={(instanceId) => {
            setOpenTabs(prev => prev.filter(x => x.instanceId !== instanceId));
            setActiveInstanceId(prev => (prev === instanceId ? (openTabs.find(x => x.instanceId !== instanceId)?.instanceId ?? null) : prev));
          }}
          showAddButton={!showRight}
          onAddMetaModels={() => setShowRight(true)}
          requestWorkspaceSnapshot={requestWorkspaceSnapshot}
        />
      ) : null}
      showWorkspaceInfo={false}
    />
    <ConfirmDialog
      isOpen={!!openChoice}
      title="Project already open"
      message="Do you want to open it in a new tab, or reuse the same workspace?"
      confirmText="Open New Tab"
      cancelText="Open In Same"
      onConfirm={async () => {
        if (!openChoice) return;
        const id = openChoice.id;
        setOpenChoice(null);
        await openVsumById(id, { forceNew: true });
      }}
      onCancel={async () => {
        if (!openChoice) return;
        const { id, existingInstanceId } = openChoice;
        setOpenChoice(null);
        setActiveInstanceId(existingInstanceId);
        await fetchAndLoadProjectBoxes(id);
      }}
    />
    </>
  );
};

// Render the choice dialog via portal at the end of the component
// helper to fetch and load boxes for a vsum id
async function fetchAndLoadProjectBoxes(id: number) {
  window.dispatchEvent(new CustomEvent('vitruv.resetWorkspace'));
  try {
    const response = await apiService.getVsumDetails(id);
    const details = response.data;
    for (const metaModel of details.metaModels || []) {
      if (metaModel.ecoreFileId) {
        try {
          const fileContent = await apiService.getFile(metaModel.ecoreFileId);
          window.dispatchEvent(new CustomEvent('vitruv.addFileToWorkspace', {
            detail: {
              fileContent: fileContent,
              fileName: metaModel.name + '.ecore',
              description: metaModel.description,
              keywords: metaModel.keyword?.join(', '),
              domain: metaModel.domain,
              createdAt: metaModel.createdAt,
              metaModelId: metaModel.id,
              metaModelSourceId: metaModel.sourceId ?? metaModel.id,
            }
          }));
        } catch (error) {
          console.error(`Failed to load ECORE file for meta model ${metaModel.name}:`, error);
        }
      }
    }

    if (details.metaModelsRelation && details.metaModelsRelation.length > 0) {
      const relations = details.metaModelsRelation.map((relation: any) => ({
        id: relation.id,
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        reactionFileId: relation.reactionFileStorageId ?? null,
      }));

      // Wait for metamodel boxes to be fully rendered before loading relations
      // Set preserveExisting to false when loading from backend (full reload)
      // This allows backend relations to be loaded even if there are existing edges
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('vitruv.loadMetaModelRelations', {
          detail: { relations, preserveExisting: false }
        }));
      }, 300);
    }
  } catch (error) {
    console.error('Failed to fetch vsum details:', error);
  }
}


