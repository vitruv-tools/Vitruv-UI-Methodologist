import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { MetaModelsPanel } from '../components/ui/MetaModelsPanel';
import { SidebarTabs } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { VsumTabs } from '../components/ui/VsumTabs';
import { apiService } from '../services/api';
import { useToast } from '../components/ui/ToastProvider';
import {
  ProjectEditorSession,
  WorkspaceSnapshot,
  WorkspaceSnapshotRequest,
} from '../types/workspace';
import { createCanvasTabInstanceId } from '../utils/canvasTabId';
import { captureEditorSession, restoreEditorSession } from '../utils/projectTabSession';

interface OpenTabInstance {
  instanceId: string;
  id: number;
}

export const ProjectPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const [showRight, setShowRight] = useState(false);
  const [openTabs, setOpenTabs] = useState<OpenTabInstance[]>([]);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
  const [sessionSnapshotsByInstanceId, setSessionSnapshotsByInstanceId] = useState<
    Record<string, WorkspaceSnapshot | null>
  >({});
  const { showInfo } = useToast();

  const openTabsRef = useRef(openTabs);
  openTabsRef.current = openTabs;
  const sessionsRef = useRef<Map<string, ProjectEditorSession>>(new Map());
  const prevActiveInstanceIdRef = useRef<string | null>(null);

  const createInstanceId = useCallback((id: number) => createCanvasTabInstanceId(id), []);

  const removeSessionForInstance = useCallback((instanceId: string) => {
    sessionsRef.current.delete(instanceId);
    setSessionSnapshotsByInstanceId(prev => {
      if (!(instanceId in prev)) return prev;
      const next = { ...prev };
      delete next[instanceId];
      return next;
    });
  }, []);

  const removeSessionsForProject = useCallback((projectId: number) => {
    for (const tab of openTabsRef.current) {
      if (tab.id === projectId) {
        removeSessionForInstance(tab.instanceId);
      }
    }
  }, [removeSessionForInstance]);

  const addMetaModelToWorkspace = useCallback(async (model: any) => {
    try {
      if (model.ecoreFileId) {
        const fileContent = await apiService.getFile(model.ecoreFileId);

        globalThis.dispatchEvent(new CustomEvent('vitruv.addFileToWorkspace', {
          detail: {
            fileContent: fileContent,
            fileName: model.name + '.ecore',
            description: model.description,
            keywords: model.keyword?.join(', '),
            domain: model.domain,
            metaModelId: model.id,
            metaModelSourceId: model.sourceId ?? model.id,
            createdAt: model.createdAt,
          }
        }));
      }

      globalThis.dispatchEvent(new CustomEvent('vitruv.addMetaModelToActiveVsum', { detail: { id: model.id, sourceId: model.sourceId ?? model.id } }));
    } catch (error) {
      console.error('Failed to fetch file:', error);
      globalThis.dispatchEvent(new CustomEvent('vitruv.addMetaModelToActiveVsum', { detail: { id: model.id, sourceId: model.sourceId ?? model.id } }));
    }
  }, []);

  const requestWorkspaceSnapshot = useCallback(() => {
    return new Promise<WorkspaceSnapshot | null>((resolve) => {
      const timeout = globalThis.setTimeout(() => resolve(null), 2000);
      const detail: WorkspaceSnapshotRequest = {
        resolve: (snapshot) => {
          globalThis.clearTimeout(timeout);
          resolve(snapshot);
        },
      };
      globalThis.dispatchEvent(new CustomEvent<WorkspaceSnapshotRequest>('vitruv.requestWorkspaceSnapshot', { detail }));
    });
  }, []);

  const handleCloseTab = useCallback((instanceId: string) => {
    removeSessionForInstance(instanceId);
    setOpenTabs(prev => {
      const filtered = prev.filter(x => x.instanceId !== instanceId);
      setActiveInstanceId(current =>
        current === instanceId ? (filtered.at(-1)?.instanceId ?? null) : current,
      );
      return filtered;
    });
  }, [removeSessionForInstance]);

  const closeActiveWorkspaceTab = useCallback(() => {
    if (!activeInstanceId) return;
    removeSessionForInstance(activeInstanceId);
    setOpenTabs(prev => {
      const filtered = prev.filter(x => x.instanceId !== activeInstanceId);
      const nextActive = filtered.length > 0 ? filtered.at(-1)!.instanceId : null;
      setActiveInstanceId(nextActive);
      return filtered;
    });
    setShowRight(false);
    globalThis.dispatchEvent(new CustomEvent('vitruv.resetWorkspace'));
  }, [activeInstanceId, removeSessionForInstance]);

  const openVsumById = useCallback(async (id: number, { forceNew }: { forceNew?: boolean } = {}) => {
    let instanceId = forceNew ? undefined : openTabs.find(t => t.id === id)?.instanceId;
    if (instanceId) {
      showInfo('This project is already open. Switched to it.');
    } else {
      instanceId = createInstanceId(id);
      setOpenTabs(prev => [...prev, { instanceId: instanceId!, id }]);
    }
    setActiveInstanceId(instanceId);
  }, [openTabs, createInstanceId, showInfo]);

  useEffect(() => {
    const handler = async (e: Event) => {
      const custom = e as CustomEvent<{ id: number; forceNew?: boolean }>;
      const id = custom.detail?.id;
      if (typeof id !== 'number') return;
      const existing = openTabs.find(t => t.id === id);
      if (existing && !custom.detail?.forceNew) {
        setActiveInstanceId(existing.instanceId);
        showInfo('This project is already open. Switched to it.');
        return;
      }
      try {
        await openVsumById(id, { forceNew: custom.detail?.forceNew });
      } catch (error) {
        console.error('Failed to open VSUM:', error);
        showInfo(error instanceof Error ? error.message : 'Failed to open project');
      }
    };
    globalThis.addEventListener('vitruv.openVsum', handler as EventListener);
    return () => globalThis.removeEventListener('vitruv.openVsum', handler as EventListener);
  }, [openTabs, openVsumById, showInfo]);

  useEffect(() => {
    globalThis.addEventListener('vitruv.closeActiveWorkspace', closeActiveWorkspaceTab as EventListener);
    return () => globalThis.removeEventListener('vitruv.closeActiveWorkspace', closeActiveWorkspaceTab as EventListener);
  }, [closeActiveWorkspaceTab]);

  useEffect(() => {
    const handleReloadWorkspace = async () => {
      if (!activeInstanceId) return;

      const activeTab = openTabsRef.current.find(t => t.instanceId === activeInstanceId);
      if (!activeTab) return;

      try {
        await fetchAndLoadProjectBoxes(activeTab.id, true);
      } catch (error) {
        console.error('Failed to reload workspace:', error);
      }
    };

    globalThis.addEventListener('vitruv.reloadWorkspace', handleReloadWorkspace as EventListener);
    return () => globalThis.removeEventListener('vitruv.reloadWorkspace', handleReloadWorkspace as EventListener);
  }, [activeInstanceId]);

  useEffect(() => {
    if (openTabs.length === 0 && showRight) {
      setShowRight(false);
    }
  }, [openTabs.length, showRight]);

  // Switch tabs: save leaving tab state, restore or load the active tab
  useEffect(() => {
    let cancelled = false;

    const applyTabSwitch = async () => {
      const previousId = prevActiveInstanceIdRef.current;
      const nextId = activeInstanceId;

      if (previousId && previousId !== nextId) {
        try {
          const session = await captureEditorSession();
          const tabStillOpen = openTabsRef.current.some(t => t.instanceId === previousId);
          if (!cancelled && tabStillOpen) {
            sessionsRef.current.set(previousId, session);
            setSessionSnapshotsByInstanceId(prev => ({
              ...prev,
              [previousId]: session.cachedWorkspaceSnapshot,
            }));
          }
        } catch (error) {
          console.warn('Failed to capture editor session when leaving tab', error);
        }
      }

      prevActiveInstanceIdRef.current = nextId;

      if (!nextId) {
        if (previousId !== nextId) {
          globalThis.dispatchEvent(new CustomEvent('vitruv.resetWorkspace'));
        }
        return;
      }

      const cached = sessionsRef.current.get(nextId);
      if (cached) {
        restoreEditorSession(cached);
        return;
      }

      const activeTab = openTabsRef.current.find(t => t.instanceId === nextId);
      if (activeTab) {
        await fetchAndLoadProjectBoxes(activeTab.id);
      }
    };

    applyTabSwitch();
    return () => { cancelled = true; };
  }, [activeInstanceId]);

  const handleVsumDeleted = useCallback((e: Event) => {
    const custom = e as CustomEvent<{ id: number }>;
    const deletedId = custom.detail?.id;
    if (typeof deletedId !== 'number') return;

    const tabsToClose = openTabsRef.current.filter(t => t.id === deletedId);
    if (tabsToClose.length === 0) return;

    tabsToClose.forEach(t => removeSessionForInstance(t.instanceId));

    setOpenTabs(prev => {
      const filtered = prev.filter(t => t.id !== deletedId);
      setActiveInstanceId(current => {
        if (!current || !tabsToClose.some(t => t.instanceId === current)) return current;
        return filtered.length > 0 ? filtered.at(-1)!.instanceId : null;
      });
      return filtered;
    });

    showInfo('The deleted project has been closed.');
  }, [removeSessionForInstance, showInfo]);

  useEffect(() => {
    globalThis.addEventListener('vitruv.vsumDeleted', handleVsumDeleted as EventListener);
    return () => globalThis.removeEventListener('vitruv.vsumDeleted', handleVsumDeleted as EventListener);
  }, [handleVsumDeleted]);

  useEffect(() => {
    const handleVsumRestored = async (e: Event) => {
      const custom = e as CustomEvent<{ id: number }>;
      const restoredId = custom.detail?.id;
      if (typeof restoredId !== 'number') return;

      removeSessionsForProject(restoredId);

      const activeTab = openTabsRef.current.find(
        t => t.id === restoredId && t.instanceId === prevActiveInstanceIdRef.current,
      );
      if (activeTab) {
        try {
          await fetchAndLoadProjectBoxes(restoredId);
          showInfo('Project workspace has been reloaded with the restored version.');
        } catch (error) {
          console.error('Failed to reload workspace after version restore:', error);
        }
      }
    };

    globalThis.addEventListener('vitruv.vsumRestored', handleVsumRestored as EventListener);
    return () => globalThis.removeEventListener('vitruv.vsumRestored', handleVsumRestored as EventListener);
  }, [removeSessionsForProject, showInfo]);

  return (
    <MainLayout
      user={user}
      vsumId={activeInstanceId ?
        openTabs.find(t => t.instanceId === activeInstanceId)?.id?.toString()
        : undefined}
      onLogout={signOut}
      leftSidebar={<SidebarTabs width={350} />}
      leftSidebarWidth={350}
      showWelcomeScreen={openTabs.length === 0}
      welcomeTitle="Methodological Dashboard"
      workspaceKey={activeInstanceId || undefined}
      preserveWorkspaceOnMount={openTabs.length > 0}
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
              onAddToActiveVsum={addMetaModelToWorkspace}
            />
          </div>
        </div>
      ) : null}
      rightSidebarWidth={350}
      workspaceOverlay={openTabs.length > 0 ? (
        <VsumTabs
          openTabs={openTabs}
          activeInstanceId={activeInstanceId}
          onActivate={setActiveInstanceId}
          onClose={handleCloseTab}
          showAddButton={!showRight}
          onAddMetaModels={() => setShowRight(true)}
          requestWorkspaceSnapshot={requestWorkspaceSnapshot}
          sessionSnapshotsByInstanceId={sessionSnapshotsByInstanceId}
        />
      ) : null}
      showWorkspaceInfo={false}
    />
  );
};

async function fetchAndLoadProjectBoxes(id: number, skipReset: boolean = false) {
  if (!skipReset) {
    globalThis.dispatchEvent(new CustomEvent('vitruv.resetWorkspace'));
  }

  try {
    const response = await apiService.getVsumDetails(id);
    const details = response.data;

    for (const metaModel of details.metaModels || []) {
      if (metaModel.ecoreFileId) {
        try {
          const fileContent = await apiService.getFile(metaModel.ecoreFileId);
          globalThis.dispatchEvent(new CustomEvent('vitruv.addFileToWorkspace', {
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

    setTimeout(() => {
      if (details.metaModelsRelation && details.metaModelsRelation.length > 0) {
        const relations = details.metaModelsRelation.map((relation: any) => ({
          id: relation.id,
          sourceId: relation.sourceId,
          targetId: relation.targetId,
          reactionFileId: relation.reactionFileId ?? relation.reactionFileStorageId ?? null,
        }));

        globalThis.dispatchEvent(new CustomEvent('vitruv.loadMetaModelRelations', {
          detail: { relations, preserveExisting: false }
        }));
      }

      setTimeout(() => {
        globalThis.dispatchEvent(new CustomEvent('vitruv.autoLayoutWorkspace'));
      }, 100);
    }, 400);
  } catch (error) {
    console.error('Failed to fetch vsum details:', error);
  }
}
