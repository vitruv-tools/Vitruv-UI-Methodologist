import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { Node, Edge } from 'reactflow';
import { FlowCanvas } from '../components/flow/FlowCanvas';
import { FloatingUMLPanel } from '../components/canvas/FloatingUMLPanel';
import { ModelDrawer, DrawerModel } from '../components/canvas/ModelDrawer';
import { apiService } from '../services/api';
import { VsumDetails } from '../types';
import { WorkspaceSnapshot, WorkspaceSnapshotRequest } from '../types/workspace';
import { MODAL_Z_INDEX, modalBackdropStyle, useModalBodyLock } from '../components/ui/modalUtils';
import { CanvasProjectTabs } from '../components/canvas/CanvasProjectTabs';
import { ProjectPickerMenu } from '../components/canvas/ProjectPickerMenu';
import { UnsavedTabCloseDialog } from '../components/canvas/UnsavedTabCloseDialog';
import { CanvasTabSession, CanvasUmlPanelState, OpenCanvasTab } from '../types/canvasTab';
import { waitForMetaModelsOnCanvas } from '../utils/canvasLoadUtils';
import {
  cloneWorkspaceSnapshot,
  emptyWorkspaceSnapshot,
  mapRelationsForCanvasLoad,
  prepareSnapshotForSyncSave,
  workspaceSnapshotFromVsumDetails,
  workspaceSnapshotsEqual,
} from '../utils/workspaceSnapshotUtils';
import { downloadBlobAsFile } from '../utils/downloadFile';
import { syncVsumWorkspaceChanges } from '../utils/vsumSyncSave';

const MODE_TOGGLE_TOP = 14;
const MODE_TOGGLE_HEIGHT = 52;
const PROJECT_TABS_HEIGHT = 32;
const CENTER_STACK_BOTTOM = MODE_TOGGLE_TOP + MODE_TOGGLE_HEIGHT + 4 + PROJECT_TABS_HEIGHT;

type UMLPanel = CanvasUmlPanelState;

// ── CanvasPage ────────────────────────────────────────────────────────────────

export const CanvasPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const flowCanvasRef = useRef<any>(null);

  const [vsumName, setVsumName] = useState<string>('');
  const [drawerModels, setDrawerModels] = useState<DrawerModel[]>([]);
  const [myLibraryModels, setMyLibraryModels] = useState<DrawerModel[]>([]);
  const [publicLibraryModels, setPublicLibraryModels] = useState<DrawerModel[]>([]);
  const [addedModelIds, setAddedModelIds] = useState<Set<number>>(new Set());
  const [loadingProject, setLoadingProject] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);

  // project-name editing
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [umlPanels, setUmlPanels] = useState<UMLPanel[]>([]);
  const [topPanelId, setTopPanelId] = useState<string | null>(null);
  const panelZBase = MODAL_Z_INDEX;

  useModalBodyLock(umlPanels.length > 0 || showDrawer);

  // check / download / save
  const [checkingBuild, setCheckingBuild] = useState(false);
  const [downloadingArtifact, setDownloadingArtifact] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [popup, setPopup] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [openTabs, setOpenTabs] = useState<OpenCanvasTab[]>([]);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
  const sessionsRef = useRef<Map<string, CanvasTabSession>>(new Map());
  const savedBaselinesRef = useRef<Map<string, WorkspaceSnapshot>>(new Map());
  const prevActiveInstanceIdRef = useRef<string | null>(null);
  const openTabsRef = useRef(openTabs);
  openTabsRef.current = openTabs;
  const [closeConfirmInstanceId, setCloseConfirmInstanceId] = useState<string | null>(null);
  const [closeConfirmSaving, setCloseConfirmSaving] = useState(false);
  const [dirtyRevision, setDirtyRevision] = useState(0);

  const createInstanceId = useCallback(
    (projectId: number) => `${projectId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    [],
  );

  const activeTab = openTabs.find(t => t.instanceId === activeInstanceId);
  const activeProjectId = activeTab?.projectId ?? (id ? Number(id) : undefined);

  // Add-reaction mode
  const [addReactionMode, setAddReactionMode] = useState(false);

  // Undo/redo availability (driven by FlowCanvas callback)
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const getLiveSnapshot = useCallback((): WorkspaceSnapshot => {
    return flowCanvasRef.current?.getWorkspaceSnapshot?.() ?? emptyWorkspaceSnapshot();
  }, []);

  const setBaselineForInstance = useCallback((instanceId: string, snapshot?: WorkspaceSnapshot) => {
    const snap = snapshot ?? getLiveSnapshot();
    savedBaselinesRef.current.set(instanceId, cloneWorkspaceSnapshot(snap));
  }, [getLiveSnapshot]);

  const captureCurrentTabSession = useCallback((): CanvasTabSession => ({
    nodes: flowCanvasRef.current?.getNodes?.() ?? [],
    edges: flowCanvasRef.current?.getEdges?.() ?? [],
    vsumName,
    drawerModels,
    myLibraryModels,
    publicLibraryModels,
    addedModelIds: Array.from(addedModelIds),
    umlPanels,
    topPanelId,
    workspaceSnapshot: getLiveSnapshot(),
  }), [vsumName, drawerModels, myLibraryModels, publicLibraryModels, addedModelIds, umlPanels, topPanelId, getLiveSnapshot]);

  const isInstanceDirty = useCallback((instanceId: string): boolean => {
    const baseline = savedBaselinesRef.current.get(instanceId);
    if (!baseline) return false;
    if (instanceId === activeInstanceId) {
      return !workspaceSnapshotsEqual(baseline, getLiveSnapshot());
    }
    const session = sessionsRef.current.get(instanceId);
    if (!session) return false;
    return !workspaceSnapshotsEqual(baseline, session.workspaceSnapshot);
  }, [activeInstanceId, getLiveSnapshot]);

  const applyTabSession = useCallback((session: CanvasTabSession) => {
    setVsumName(session.vsumName);
    setDrawerModels(session.drawerModels);
    setMyLibraryModels(session.myLibraryModels);
    setPublicLibraryModels(session.publicLibraryModels);
    setAddedModelIds(new Set(session.addedModelIds));
    setUmlPanels(session.umlPanels);
    setTopPanelId(session.topPanelId);
    setShowDrawer(false);
    setEditingName(false);
    setLoadingProject(false);

    const load = () => {
      flowCanvasRef.current?.loadDiagramData?.(session.nodes, session.edges);
    };
    load();
    setTimeout(load, 50);
  }, []);

  const captureRef = useRef(captureCurrentTabSession);
  captureRef.current = captureCurrentTabSession;
  const applyRef = useRef(applyTabSession);
  applyRef.current = applyTabSession;

  const updateTabName = useCallback((projectId: number, name: string) => {
    setOpenTabs(prev => prev.map(t => (t.projectId === projectId ? { ...t, name } : t)));
  }, []);

  const switchToTab = useCallback((instanceId: string) => {
    const tab = openTabsRef.current.find(t => t.instanceId === instanceId);
    if (!tab || activeInstanceId === instanceId) return;
    setActiveInstanceId(instanceId);
    if (String(tab.projectId) !== id) {
      navigate(`/canvas/${tab.projectId}`, { replace: true });
    }
  }, [navigate, id, activeInstanceId]);

  const handleSelectProject = useCallback((projectId: number, name: string) => {
    const existing = openTabsRef.current.find(t => t.projectId === projectId);
    if (existing) {
      switchToTab(existing.instanceId);
      return;
    }
    const instanceId = createInstanceId(projectId);
    setOpenTabs(prev => [...prev, { instanceId, projectId, name }]);
    setActiveInstanceId(instanceId);
    navigate(`/canvas/${projectId}`);
  }, [createInstanceId, navigate, switchToTab]);

  const performCloseTab = useCallback((instanceId: string) => {
    sessionsRef.current.delete(instanceId);
    savedBaselinesRef.current.delete(instanceId);
    setOpenTabs(prev => {
      const filtered = prev.filter(t => t.instanceId !== instanceId);
      setActiveInstanceId(current => {
        if (current !== instanceId) return current;
        const next = filtered.at(-1);
        if (next) navigate(`/canvas/${next.projectId}`, { replace: true });
        else navigate('/');
        return next?.instanceId ?? null;
      });
      return filtered;
    });
  }, [navigate]);

  const requestCloseTab = useCallback((instanceId: string) => {
    if (isInstanceDirty(instanceId)) {
      setCloseConfirmInstanceId(instanceId);
      return;
    }
    performCloseTab(instanceId);
  }, [isInstanceDirty, performCloseTab]);

  const saveTabInstance = useCallback(async (instanceId: string): Promise<boolean> => {
    const tab = openTabsRef.current.find(t => t.instanceId === instanceId);
    if (!tab) return false;

    const snapshot =
      instanceId === activeInstanceId
        ? getLiveSnapshot()
        : sessionsRef.current.get(instanceId)?.workspaceSnapshot ?? emptyWorkspaceSnapshot();

    try {
      const payload = prepareSnapshotForSyncSave(snapshot);
      const { savedRelations } = await syncVsumWorkspaceChanges(tab.projectId, payload);
      const savedSnapshot: WorkspaceSnapshot = {
        metaModelIds: payload.metaModelIds,
        metaModelRelationRequests: savedRelations,
      };
      setBaselineForInstance(instanceId, savedSnapshot);
      const session = sessionsRef.current.get(instanceId);
      if (session) {
        sessionsRef.current.set(instanceId, {
          ...session,
          workspaceSnapshot: cloneWorkspaceSnapshot(savedSnapshot),
        });
      }
      return true;
    } catch (e) {
      console.error('Failed to save tab:', e);
      return false;
    }
  }, [activeInstanceId, getLiveSnapshot, setBaselineForInstance]);

  const dirtyInstanceIds = React.useMemo(() => {
    void dirtyRevision; // poll tick — re-run when live snapshot may have changed
    const ids = new Set<string>();
    for (const tab of openTabs) {
      if (isInstanceDirty(tab.instanceId)) ids.add(tab.instanceId);
    }
    return ids;
  }, [openTabs, dirtyRevision, isInstanceDirty]);

  useEffect(() => {
    const timer = globalThis.setInterval(() => setDirtyRevision(r => r + 1), 700);
    return () => globalThis.clearInterval(timer);
  }, []);

  // Ensure route project is represented as a tab
  useEffect(() => {
    if (!id) return;
    const projectId = Number(id);
    if (!Number.isFinite(projectId)) return;

    setOpenTabs(prev => {
      const existing = prev.find(t => t.projectId === projectId);
      if (existing) {
        setActiveInstanceId(existing.instanceId);
        return prev;
      }
      const instanceId = createInstanceId(projectId);
      setActiveInstanceId(instanceId);
      return [...prev, { instanceId, projectId, name: '' }];
    });
  }, [id, createInstanceId]);

  const loadVsum = useCallback(async (vsumId: number) => {
    setLoadingProject(true);

    // Drop cached tab session so reopen/refresh always reloads from the server.
    for (const tab of openTabsRef.current) {
      if (tab.projectId === vsumId) {
        sessionsRef.current.delete(tab.instanceId);
      }
    }

    try {
      const response = await apiService.getVsumDetails(vsumId);
      const details: VsumDetails = response.data;
      setVsumName(details.name);
      updateTabName(vsumId, details.name);

      const projectModels: DrawerModel[] = (details.metaModels || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        sourceId: m.sourceId ?? m.id,
        domain: m.domain,
        ecoreFileId: m.ecoreFileId,
        genModelFileId: m.genModelFileId,
        inProject: true,
        description: m.description,
        keyword: m.keyword,
        createdAt: m.createdAt,
      }));
      setDrawerModels(projectModels);

      // Fetch both library tabs in parallel — include ALL models so removing from
      // canvas makes them reappear; the drawer's addedModelIds filter handles hiding.
      const toDrawer = (m: any): DrawerModel => ({
        id: m.id,
        name: m.name,
        sourceId: m.sourceId ?? m.id,
        domain: m.domain,
        ecoreFileId: m.ecoreFileId,
        genModelFileId: m.genModelFileId,
        inProject: false,
        description: m.description,
        keyword: m.keyword,
        createdAt: m.createdAt,
      });

      const [myRes, pubRes] = await Promise.allSettled([
        apiService.findMetaModels({ ownedByUser: true }),
        apiService.findMetaModels({ ownedByUser: false }),
      ]);
      setMyLibraryModels(
        myRes.status === 'fulfilled' ? (myRes.value.data || []).map(toDrawer) : [],
      );
      setPublicLibraryModels(
        pubRes.status === 'fulfilled' ? (pubRes.value.data || []).map(toDrawer) : [],
      );

      globalThis.dispatchEvent(new CustomEvent('vitruv.resetWorkspace'));
      await new Promise(r => setTimeout(r, 100));

      for (const model of details.metaModels || []) {
        if (model.ecoreFileId) {
          try {
            const fileContent = await apiService.getFile(model.ecoreFileId);
            globalThis.dispatchEvent(new CustomEvent('vitruv.addFileToWorkspace', {
              detail: {
                fileContent,
                fileName: model.name + '.ecore',
                description: model.description,
                keywords: model.keyword?.join(', '),
                domain: model.domain,
                createdAt: model.createdAt,
                metaModelId: model.id,
                metaModelSourceId: model.sourceId ?? model.id,
                ecoreFileId: model.ecoreFileId,
                genModelFileId: model.genModelFileId,
              },
            }));
            await new Promise(r => setTimeout(r, 50));
          } catch {
            // model without ecore file – skip canvas box
          }
        }
      }

      await waitForMetaModelsOnCanvas(
        () => flowCanvasRef.current?.getNodes?.() ?? [],
        details.metaModels ?? [],
      );

      if (details.metaModelsRelation?.length) {
        globalThis.dispatchEvent(new CustomEvent('vitruv.loadMetaModelRelations', {
          detail: {
            relations: mapRelationsForCanvasLoad(details.metaModelsRelation),
            preserveExisting: false,
          },
        }));
        await new Promise(r => setTimeout(r, 150));
      }

      const tab = openTabsRef.current.find(t => t.projectId === vsumId);
      if (tab) {
        setBaselineForInstance(tab.instanceId, workspaceSnapshotFromVsumDetails(details));
      }
    } catch (e) {
      console.error('Failed to load VSUM:', e);
    } finally {
      setLoadingProject(false);
    }
  }, [setBaselineForInstance, updateTabName]);

  // Switch tabs: capture leaving tab, restore or load active tab
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const previousId = prevActiveInstanceIdRef.current;
      const nextId = activeInstanceId;

      if (previousId && previousId !== nextId) {
        const session = captureRef.current();
        const tabStillOpen = openTabsRef.current.some(t => t.instanceId === previousId);
        if (!cancelled && tabStillOpen) {
          sessionsRef.current.set(previousId, session);
        }
      }

      prevActiveInstanceIdRef.current = nextId;
      if (!nextId) return;

      const cached = sessionsRef.current.get(nextId);
      if (cached) {
        applyRef.current(cached);
        return;
      }

      const tab = openTabsRef.current.find(t => t.instanceId === nextId);
      if (tab) {
        await loadVsum(tab.projectId);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [activeInstanceId, loadVsum]);

  // ── Rename VSUM ───────────────────────────────────────────────────────────

  const startRename = useCallback(() => {
    setNameInput(vsumName);
    setEditingName(true);
  }, [vsumName]);

  const confirmRename = useCallback(async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || !activeProjectId || trimmed === vsumName) { setEditingName(false); return; }
    setSavingName(true);
    try {
      await apiService.renameVsum(activeProjectId, { name: trimmed });
      setVsumName(trimmed);
      updateTabName(activeProjectId, trimmed);
    } catch (e) {
      console.error('Rename failed:', e);
    } finally {
      setSavingName(false);
      setEditingName(false);
    }
  }, [nameInput, activeProjectId, vsumName, updateTabName]);

  const cancelRename = useCallback(() => setEditingName(false), []);

  // ── Add model from drawer ─────────────────────────────────────────────────

  const handleAddModel = useCallback(async (model: DrawerModel) => {
    if (!model.ecoreFileId) return;
    try {
      const fileContent = await apiService.getFile(model.ecoreFileId);
      globalThis.dispatchEvent(new CustomEvent('vitruv.addFileToWorkspace', {
        detail: {
          fileContent,
          fileName: model.name + '.ecore',
          domain: model.domain,
          metaModelId: model.id,
          metaModelSourceId: model.sourceId ?? model.id,
          ecoreFileId: model.ecoreFileId,
          genModelFileId: model.genModelFileId,
        },
      }));
    } catch (e) {
      console.error('Failed to add model:', e);
    }
  }, []);

  // ── UML expand → floating panel ───────────────────────────────────────────

  const handleEcoreFileExpand = useCallback((fileName: string, fileContent: string) => {
    const PANEL_TOP = openTabs.length > 0 ? CENTER_STACK_BOTTOM + 8 : MODE_TOGGLE_TOP + MODE_TOGGLE_HEIGHT + 8;
    const PANEL_BOTTOM_USED = 228; // bottom margin(16) + minimap(204) + gap(8)
    const panelH = Math.max(200, document.documentElement.clientHeight - PANEL_TOP - PANEL_BOTTOM_USED);

    const newPanel: UMLPanel = {
      id: `panel-${Date.now()}`,
      title: fileName.replace(/\.ecore$/, ''),
      fileName,
      ecoreContent: fileContent,
      top: PANEL_TOP,
      right: 16,
      width: 200,
      height: panelH,
    };
    setUmlPanels(prev => [...prev, newPanel]);
    setTopPanelId(newPanel.id);
  }, [openTabs.length]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { fileName, fileContent } = (e as CustomEvent).detail || {};
      if (fileName && fileContent) handleEcoreFileExpand(fileName, fileContent);
    };
    globalThis.addEventListener('vitruv.expandFileInWorkspace', handler as EventListener);
    return () => globalThis.removeEventListener('vitruv.expandFileInWorkspace', handler as EventListener);
  }, [handleEcoreFileExpand]);

  // ── Canvas event wiring ───────────────────────────────────────────────────

  useEffect(() => {
    const handleReset = () => {
      flowCanvasRef.current?.loadDiagramData?.([], []);
      flowCanvasRef.current?.resetExpandedFile?.();
      // addedModelIds clears automatically via onDiagramChange when nodes become []
    };
    const handleAddFile = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const existing = flowCanvasRef.current?.getNodes?.() || [];
      // skip placing on canvas if already there (by fileName)
      if (existing.find((n: any) => n.type === 'ecoreFile' && n.data.fileName === detail.fileName)) return;
      flowCanvasRef.current?.addEcoreFile?.(detail.fileName, detail.fileContent, detail);
      // addedModelIds is kept in sync via onDiagramChange — no manual update needed here
    };
    globalThis.addEventListener('vitruv.resetWorkspace', handleReset as EventListener);
    globalThis.addEventListener('vitruv.addFileToWorkspace', handleAddFile as EventListener);
    return () => {
      globalThis.removeEventListener('vitruv.resetWorkspace', handleReset as EventListener);
      globalThis.removeEventListener('vitruv.addFileToWorkspace', handleAddFile as EventListener);
    };
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<WorkspaceSnapshotRequest>).detail;
      if (!detail?.resolve) return;
      const snapshot: WorkspaceSnapshot =
        flowCanvasRef.current?.getWorkspaceSnapshot?.() ?? { metaModelIds: [], metaModelRelationRequests: [] };
      detail.resolve(snapshot);
    };
    globalThis.addEventListener('vitruv.requestWorkspaceSnapshot', handler as EventListener);
    return () => globalThis.removeEventListener('vitruv.requestWorkspaceSnapshot', handler as EventListener);
  }, []);

  // ── panel helpers ─────────────────────────────────────────────────────────

  // ── Check build ───────────────────────────────────────────────────────────

  const handleCheckBuild = useCallback(async () => {
    if (!activeProjectId) return;
    setCheckingBuild(true);
    setPopup({ message: 'Checking whether this VSUM can be built…', type: 'info' });
    try {
      const res = await apiService.buildVsum(activeProjectId);
      const msg = (res as any)?.message || 'This VSUM can be built successfully.';
      setPopup({ message: msg, type: 'success' });
    } catch (e: any) {
      const data = e?.response?.data;
      const detail = (typeof data?.message === 'string' && data.message) ||
        (typeof data === 'string' && data) ||
        e?.message || 'Build check failed.';
      setPopup({ message: detail, type: 'error' });
    } finally {
      setCheckingBuild(false);
      setTimeout(() => setPopup(null), 5000);
    }
  }, [activeProjectId]);

  // ── Download artifact ─────────────────────────────────────────────────────

  const handleDownloadArtifact = useCallback(async () => {
    if (!activeProjectId) return;
    setDownloadingArtifact(true);
    setPopup({ message: 'Downloading artifact…', type: 'info' });
    try {
      const blob = await apiService.downloadVsumArtifact(activeProjectId);
      downloadBlobAsFile(blob, `vsum-${activeProjectId}-artifact.zip`);
      setPopup({ message: 'Artifact downloaded successfully!', type: 'success' });
    } catch (e: any) {
      const data = e?.response?.data;
      const detail = (typeof data?.message === 'string' && data.message) ||
        (typeof data === 'string' && data) ||
        e?.message || 'Download failed.';
      setPopup({ message: detail, type: 'error' });
    } finally {
      setDownloadingArtifact(false);
      setTimeout(() => setPopup(null), 5000);
    }
  }, [activeProjectId]);

  // ── Save changes ──────────────────────────────────────────────────────────

  const handleSaveChanges = useCallback(async () => {
    if (!activeProjectId) return;
    setSavingChanges(true);
    setPopup({ message: 'Saving changes…', type: 'info' });
    try {
      const snapshot: WorkspaceSnapshot =
        flowCanvasRef.current?.getWorkspaceSnapshot?.() ?? emptyWorkspaceSnapshot();
      const payload = prepareSnapshotForSyncSave(snapshot);
      const { message, savedRelations } = await syncVsumWorkspaceChanges(activeProjectId, payload);
      const savedSnapshot: WorkspaceSnapshot = {
        metaModelIds: payload.metaModelIds,
        metaModelRelationRequests: savedRelations,
      };
      if (activeInstanceId) {
        setBaselineForInstance(activeInstanceId, savedSnapshot);
        const session = sessionsRef.current.get(activeInstanceId);
        if (session) {
          sessionsRef.current.set(activeInstanceId, {
            ...session,
            workspaceSnapshot: cloneWorkspaceSnapshot(savedSnapshot),
          });
        }
      }
      setPopup({ message, type: 'success' as const });
    } catch (e: any) {
      const data = e?.response?.data;
      const detail = (typeof data?.message === 'string' && data.message) ||
        (typeof data === 'string' && data) ||
        e?.message || 'Save failed.';
      setPopup({ message: detail, type: 'error' });
    } finally {
      setSavingChanges(false);
      setTimeout(() => setPopup(null), 5000);
    }
  }, [activeProjectId, activeInstanceId, setBaselineForInstance]);

  const closePanel = useCallback((panelId: string) => {
    setUmlPanels(prev => prev.filter(p => p.id !== panelId));
    setTopPanelId(prev => (prev === panelId ? null : prev));
  }, []);

  const focusPanel = useCallback((panelId: string) => setTopPanelId(panelId), []);
  const handleDiagramChange = useCallback((_nodes: Node[], _edges: Edge[]) => {
    const ids = new Set<number>();
    for (const n of _nodes) {
      if (n.type !== 'ecoreFile') continue;
      // collect both the VSUM-instance id and the original library source id
      if (n.data?.metaModelId != null) ids.add(Number(n.data.metaModelId));
      if (n.data?.metaModelSourceId != null) ids.add(Number(n.data.metaModelSourceId));
    }
    setAddedModelIds(ids);
  }, []);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>

      <FlowCanvas
        key="canvas-workspace"
        ref={flowCanvasRef}
        vsumId={activeProjectId?.toString()}
        onDiagramChange={handleDiagramChange}
        onEcoreFileExpand={handleEcoreFileExpand}
        umlModalOpen={umlPanels.length > 0}
        addReactionMode={addReactionMode}
        onReactionModeEnd={() => setAddReactionMode(false)}
        onHistoryChange={(u, r) => { setCanUndo(u); setCanRedo(r); }}
        projectTabsBelowModeToggle={
          openTabs.length > 0 ? (
            <CanvasProjectTabs
              tabs={openTabs}
              activeInstanceId={activeInstanceId}
              activeProjectId={activeProjectId}
              openProjectIds={openTabs.map(t => t.projectId)}
              dirtyInstanceIds={dirtyInstanceIds}
              loading={loadingProject}
              onActivate={switchToTab}
              onRequestClose={requestCloseTab}
              onSelectProject={handleSelectProject}
            />
          ) : null
        }
      />

      {umlPanels.map((panel, idx) => (
        <FloatingUMLPanel
          key={panel.id}
          id={panel.id}
          title={panel.title}
          fileName={panel.fileName}
          layoutScopeId={activeProjectId != null ? String(activeProjectId) : 'default'}
          ecoreContent={panel.ecoreContent}
          initialTop={panel.top}
          initialRight={panel.right}
          panelWidth={panel.width}
          panelHeight={panel.height}
          onClose={closePanel}
          onFocus={focusPanel}
          zIndex={panelZBase + (topPanelId === panel.id ? umlPanels.length : idx)}
        />
      ))}

      {/* Model drawer modal */}
      {showDrawer && ReactDOM.createPortal(
        <>
          {/* Backdrop */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setShowDrawer(false)}
            style={{ ...modalBackdropStyle, zIndex: MODAL_Z_INDEX }}
          />
          {/* Panel */}
          <div style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(800px, 92vw)',
            height: 'min(700px, 88vh)',
            zIndex: MODAL_Z_INDEX + 1,
            pointerEvents: 'auto',
            background: '#ffffff',
            borderRadius: 10,
            boxShadow: '0 24px 64px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.10)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}>
            <ModelDrawer
              models={drawerModels}
              addedModelIds={addedModelIds}
              loading={loadingProject}
              onClose={() => setShowDrawer(false)}
              onAddModel={handleAddModel}
              myLibraryModels={myLibraryModels}
              publicLibraryModels={publicLibraryModels}
              onFetchFile={(fileId) => apiService.getFile(fileId)}
            />
          </div>
        </>,
        document.body
      )}

      {/* Left sidebar toolbar */}
      <LeftSidebar
        addReactionMode={addReactionMode}
        onToggleReactionMode={() => setAddReactionMode(v => !v)}
        onToggleModelDrawer={() => setShowDrawer(d => !d)}
        onDownloadArtifact={handleDownloadArtifact}
        onSaveChanges={handleSaveChanges}
        onCheckBuild={handleCheckBuild}
        onUndo={() => flowCanvasRef.current?.undo?.()}
        onRedo={() => flowCanvasRef.current?.redo?.()}
        canUndo={canUndo}
        canRedo={canRedo}
        downloadingArtifact={downloadingArtifact}
        savingChanges={savingChanges}
        checkingBuild={checkingBuild}
      />

      <LeftPill
        projectName={vsumName || (loadingProject ? 'Loading…' : 'Project')}
        projectId={activeProjectId}
        openProjectIds={openTabs.map(t => t.projectId)}
        editingName={editingName}
        nameInput={nameInput}
        savingName={savingName}
        onBack={() => navigate('/')}
        onRefresh={() => activeProjectId && loadVsum(activeProjectId)}
        onSelectProject={handleSelectProject}
        onStartRename={startRename}
        onNameInputChange={setNameInput}
        onConfirmRename={confirmRename}
        onCancelRename={cancelRename}
        loading={loadingProject}
      />

      <UnsavedTabCloseDialog
        isOpen={closeConfirmInstanceId !== null}
        projectName={openTabs.find(t => t.instanceId === closeConfirmInstanceId)?.name}
        saving={closeConfirmSaving}
        onSave={async () => {
          if (!closeConfirmInstanceId) return;
          setCloseConfirmSaving(true);
          const ok = await saveTabInstance(closeConfirmInstanceId);
          setCloseConfirmSaving(false);
          if (ok) {
            const id = closeConfirmInstanceId;
            setCloseConfirmInstanceId(null);
            performCloseTab(id);
            setPopup({ message: 'Changes saved.', type: 'success' });
            setTimeout(() => setPopup(null), 3000);
          } else {
            setPopup({ message: 'Failed to save changes.', type: 'error' });
            setTimeout(() => setPopup(null), 4000);
          }
        }}
        onCloseWithoutSaving={() => {
          if (closeConfirmInstanceId) {
            performCloseTab(closeConfirmInstanceId);
            setCloseConfirmInstanceId(null);
          }
        }}
        onCancel={() => setCloseConfirmInstanceId(null)}
      />

      <RightPill />
      {/* (showDrawer/onToggleDrawer/modelCount kept for future use) */}

      {/* Popup notification */}
      {popup && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, maxWidth: 480, width: 'max-content',
          background: popup.type === 'success' ? '#f0fdf4' : popup.type === 'error' ? '#fef2f2' : '#eff6ff',
          border: `1px solid ${popup.type === 'success' ? '#86efac' : popup.type === 'error' ? '#fca5a5' : '#bfdbfe'}`,
          color: popup.type === 'success' ? '#15803d' : popup.type === 'error' ? '#dc2626' : '#1d4ed8',
          borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}>
          {popup.message}
        </div>
      )}
    </div>
  );
};

// ── LeftPill ──────────────────────────────────────────────────────────────────

interface LeftPillProps {
  projectName: string;
  projectId?: number;
  openProjectIds: number[];
  editingName: boolean;
  nameInput: string;
  savingName: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onSelectProject: (projectId: number, name: string) => void;
  onStartRename: () => void;
  onNameInputChange: (v: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  loading: boolean;
}

const LeftPill: React.FC<LeftPillProps> = ({
  projectName, projectId, openProjectIds, editingName, nameInput, savingName,
  onBack, onRefresh, onSelectProject, onStartRename, onNameInputChange, onConfirmRename, onCancelRename, loading,
}) => (
  <div style={pillStyle('left')}>
    {/* Logo — click to go back */}
    <img
      src="/assets/vitruvius1.png"
      alt="Back to overview"
      title="Back to overview"
      onClick={onBack}
      style={{
        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
        margin: '0 4px', cursor: 'pointer',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    />

    <Divider />

    {editingName ? (
      <>
        <input
          autoFocus
          value={nameInput}
          onChange={e => onNameInputChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onConfirmRename(); if (e.key === 'Escape') onCancelRename(); }}
          disabled={savingName}
          style={{
            fontSize: 13, fontWeight: 600, color: '#0f172a',
            border: '1.5px solid #93c5fd', borderRadius: 6,
            padding: '2px 8px', outline: 'none', width: 170,
            background: '#fff',
          }}
        />
        <PillBtn onClick={onConfirmRename} title="Save" active spinning={savingName}>
          <CheckIcon />
        </PillBtn>
        <PillBtn onClick={onCancelRename} title="Cancel">
          <XIcon />
        </PillBtn>
      </>
    ) : (
      <>
        <ProjectPickerMenu
          currentProjectId={projectId}
          activeProjectId={projectId}
          openProjectIds={openProjectIds}
          currentProjectName={projectName}
          disabled={loading}
          onSelectProject={p => onSelectProject(p.id, p.name)}
        />
        <PillBtn onClick={onStartRename} title="Edit project name">
          <PencilIcon />
        </PillBtn>
      </>
    )}

    <Divider />

    <PillBtn onClick={onRefresh} title="Reload" spinning={loading && !editingName}>
      <RefreshIcon />
    </PillBtn>
  </div>
);

// ── Avatar helpers ────────────────────────────────────────────────────────────

interface Collaborator { id: string; initials: string; name: string; color: string; }

// Mock data – replace with real API data later
const MOCK_COLLABORATORS: Collaborator[] = [];
const MY_ACCOUNT = { id: 'me', initials: 'MO', name: 'Max Oesterle (You)', color: '#1e293b', ringColor: '#049484' };

interface AvatarProps {
  initials: string;
  bg: string;
  size?: number;
  ring?: string;
  title?: string;
  onClick?: () => void;
}

const UserAvatar: React.FC<AvatarProps> = ({ initials, bg, size = 30, ring, title, onClick }) => (
  <div
    title={title}
    onClick={onClick}
    style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color: '#fff',
      fontSize: Math.round(size * 0.36), fontWeight: 700, letterSpacing: '0.01em',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, userSelect: 'none',
      boxShadow: ring
        ? `0 0 0 2px #fff, 0 0 0 4.5px ${ring}`
        : '0 0 0 2px #fff',
      cursor: onClick ? 'pointer' : 'default',
    }}
  >
    {initials}
  </div>
);

// ── RightPill ─────────────────────────────────────────────────────────────────

const RightPill: React.FC = () => {
  const [showAccounts, setShowAccounts] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close both panels on outside click
  useEffect(() => {
    if (!showAccounts && !showProfileMenu) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as unknown as HTMLElement)) {
        setShowAccounts(false);
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAccounts, showProfileMenu]);

  // All members for the scrollable panel
  const allMembers = [...MOCK_COLLABORATORS, MY_ACCOUNT];
  const stackAvatars = allMembers.slice(0, 3);
  const overflowCount = allMembers.length > 3 ? allMembers.length - 3 : 0;

  return (
    <div ref={wrapRef} style={{ ...pillStyle('right'), padding: '0 10px', gap: 0, position: 'absolute' }}>

      {/* ── Collaborator stack — click to see all members ── */}
      <div
        title="Show all members"
        onClick={() => { setShowAccounts(v => !v); setShowProfileMenu(false); }}
        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '0 4px' }}
      >
        {stackAvatars.map((c, i) => (
          <div key={c.id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 3 - i }}>
            <UserAvatar
              initials={c.initials}
              bg={c.color}
              size={30}
              ring={'ringColor' in c ? (c as typeof MY_ACCOUNT).ringColor : undefined}
            />
          </div>
        ))}
        {overflowCount > 0 && (
          <div style={{ marginLeft: -8, zIndex: 0 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: '#e2e8f0', color: '#475569',
              fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #fff', userSelect: 'none',
            }}>
              +{overflowCount}
            </div>
          </div>
        )}
      </div>

      <Divider />

      {/* ── My account avatar — click for profile menu ── */}
      <div style={{ position: 'relative', padding: '0 4px' }}>
        <div
          title="My account"
          onClick={() => { setShowProfileMenu(v => !v); setShowAccounts(false); }}
          style={{ cursor: 'pointer', display: 'flex' }}
        >
          <UserAvatar
            initials={MY_ACCOUNT.initials}
            bg={MY_ACCOUNT.color}
            size={32}
            ring={MY_ACCOUNT.ringColor}
          />
        </div>

        {/* Profile dropdown */}
        {showProfileMenu && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: '#ffffff',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.07)',
            padding: '6px',
            zIndex: 500,
            minWidth: 180,
          }}>
            {/* Account info header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px 12px',
              borderBottom: '1px solid #f1f5f9',
              marginBottom: 4,
            }}>
              <UserAvatar initials={MY_ACCOUNT.initials} bg={MY_ACCOUNT.color} size={36} ring={MY_ACCOUNT.ringColor} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                  {MY_ACCOUNT.name.replace(' (You)', '')}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>My Account</div>
              </div>
            </div>

            {/* Menu items */}
            {[
              { label: 'Manage Profile', icon: '👤' },
              { label: 'Log out', icon: '→', danger: true },
            ].map(item => (
              <ProfileMenuItem key={item.label} label={item.label} icon={item.icon} danger={item.danger} />
            ))}
          </div>
        )}
      </div>

      <Divider />

      {/* Share button */}
      <ShareBtn />

      {/* ── All-members panel ── */}
      {showAccounts && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          left: 0,               // same width as the pill above
          background: '#ffffff',
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.07)',
          padding: '12px 10px',
          zIndex: 500,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: '#94a3b8',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            marginBottom: 10, paddingLeft: 2, whiteSpace: 'nowrap',
          }}>
            Project Members
          </div>
          {/* overflow: visible so box-shadow rings aren't clipped */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 6,
            maxHeight: 260, overflowY: 'auto', overflowX: 'visible',
            scrollbarWidth: 'thin', padding: '2px 4px',
          }}>
            {allMembers.map(m => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center',
                gap: 10, flexShrink: 0,
              }}>
                <UserAvatar
                  initials={m.initials}
                  bg={m.color}
                  size={34}
                  ring={'ringColor' in m ? (m as typeof MY_ACCOUNT).ringColor : undefined}
                  title={m.name}
                />
                <span style={{
                  fontSize: 13, fontWeight: 500, color: '#0f172a',
                  whiteSpace: 'nowrap',
                }}>
                  {m.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ProfileMenuItem: React.FC<{ label: string; icon: string; danger?: boolean }> = ({ label, icon, danger }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '8px 10px', border: 'none', borderRadius: 6,
        background: hov ? (danger ? '#fef2f2' : '#f8fafc') : 'transparent',
        color: danger ? '#dc2626' : '#0f172a',
        fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      {label}
    </button>
  );
};

// ── ShareBtn ──────────────────────────────────────────────────────────────────

const ShareBtn: React.FC = () => {
  const [hov, setHov] = useState(false);
  return (
    <button
      title="Share project"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 34, padding: '0 14px', border: 'none', borderRadius: 6,
        background: hov ? '#038472' : '#049484',
        color: '#ffffff', fontSize: 13, fontWeight: 700,
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
        whiteSpace: 'nowrap', transition: 'background 0.15s', flexShrink: 0,
      }}
    >
      <ShareIcon />
      Share
    </button>
  );
};

const PlusBoxIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="7" x2="12" y2="17" />
    <line x1="7" y1="12" x2="17" y2="12" />
  </svg>
);

// ── LeftSidebar ───────────────────────────────────────────────────────────────

interface LeftSidebarProps {
  addReactionMode: boolean;
  onToggleReactionMode: () => void;
  onToggleModelDrawer: () => void;
  onDownloadArtifact: () => void;
  onSaveChanges: () => void;
  onCheckBuild: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  downloadingArtifact: boolean;
  savingChanges: boolean;
  checkingBuild: boolean;
}

const LeftSidebar: React.FC<LeftSidebarProps> = ({
  addReactionMode, onToggleReactionMode, onToggleModelDrawer,
  onDownloadArtifact, onSaveChanges, onCheckBuild,
  onUndo, onRedo, canUndo, canRedo,
  downloadingArtifact, savingChanges, checkingBuild,
}) => {
  const busy = downloadingArtifact || savingChanges || checkingBuild;
  const sidebarCard: React.CSSProperties = {
    position: 'fixed',
    left: 14,
    zIndex: 400,
    background: '#ffffff',
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.13), 0 0 0 1px rgba(0,0,0,0.07)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: 64,
    padding: '6px 0',
    gap: 1,
  };

  return (
    <div style={{
      position: 'fixed',
      left: 14,
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 400,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
    }}>
      {/* ── Main toolbar ── */}
      <div style={{ ...sidebarCard, position: 'relative', left: 'auto', top: 'auto', zIndex: 'auto' as any }}>
        {/* Pointer / select mode */}
        <SidebarBtn title="Select (pointer)" active={!addReactionMode} onClick={() => { if (addReactionMode) onToggleReactionMode(); }}>
          <PointerIcon />
        </SidebarBtn>

        <SidebarDivider />

        {/* Download ZIP */}
        <SidebarBtn title="Download ZIP" onClick={onDownloadArtifact} loading={downloadingArtifact} disabled={busy}>
          <DownloadIcon />
        </SidebarBtn>

        {/* Save Changes */}
        <SidebarBtn title="Save changes" onClick={onSaveChanges} loading={savingChanges} disabled={busy}>
          <SaveIcon />
        </SidebarBtn>

        {/* Check Build */}
        <SidebarBtn title="Check build" onClick={onCheckBuild} loading={checkingBuild} disabled={busy} color="#049484">
          <CheckBuildIcon />
        </SidebarBtn>

        <SidebarDivider />

        {/* Add Reaction */}
        <SidebarBtn
          title={addReactionMode ? 'Cancel (click canvas)' : 'Add reaction — click two models'}
          active={addReactionMode}
          onClick={onToggleReactionMode}
        >
          <ReactionIcon />
        </SidebarBtn>

        {/* Add Meta-models */}
        <SidebarBtn title="Add meta-models" onClick={onToggleModelDrawer} filled>
          <PlusBoxIcon />
        </SidebarBtn>
      </div>

      {/* ── Undo / Redo — own card, just below the main one ── */}
      <div style={{ ...sidebarCard, position: 'relative', left: 'auto', top: 'auto', zIndex: 'auto' as any }}>
        <SidebarBtn title="Undo" onClick={onUndo} disabled={!canUndo}>
          <UndoIcon />
        </SidebarBtn>
        <SidebarBtn title="Redo" onClick={onRedo} disabled={!canRedo}>
          <RedoIcon />
        </SidebarBtn>
      </div>
    </div>
  );
};

interface SidebarBtnProps {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  filled?: boolean;
  disabled?: boolean;
  loading?: boolean;
  color?: string;
}

const SidebarBtn: React.FC<SidebarBtnProps> = ({ title, onClick, children, active, filled, disabled, loading, color }) => {
  const [hov, setHov] = useState(false);
  const activeColor = color || '#049484';
  const isFilled = filled || active;
  const bg = isFilled
    ? activeColor
    : hov && !disabled ? '#f1f5f9' : 'transparent';
  const iconColor = disabled
    ? '#c8d3dd'
    : isFilled ? '#ffffff'
    : hov ? '#1e293b' : '#475569';
  return (
    <button
      title={title}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 52, height: 52, border: 'none',
        borderRadius: 6, background: bg, color: iconColor,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s', flexShrink: 0,
      }}
    >
      <span style={loading ? { animation: 'spin 0.9s linear infinite', display: 'flex' } : undefined}>
        {children}
      </span>
    </button>
  );
};

const SidebarDivider = () => (
  <div style={{ width: 44, height: 1, background: '#e2e8f0', margin: '3px 0', flexShrink: 0 }} />
);

// ── shared pill UI helpers ────────────────────────────────────────────────────

const pillStyle = (side: 'left' | 'right'): React.CSSProperties => ({
  position: 'absolute',
  ...(side === 'left'
    ? { top: 14, left: 14, borderRadius: 8 }
    : { top: 14, right: 14, borderRadius: 8 }),
  zIndex: 400,
  background: '#ffffff',
  boxShadow: '0 4px 16px rgba(0,0,0,0.13), 0 0 0 1px rgba(0,0,0,0.07)',
  display: 'flex',
  alignItems: 'center',
  height: 52,
  padding: '0 8px',
  gap: 2,
});

const Divider = () => (
  <div style={{ width: 1, height: 26, background: '#e2e8f0', margin: '0 6px', flexShrink: 0 }} />
);

interface PillBtnProps {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
  spinning?: boolean;
}

const PillBtn: React.FC<PillBtnProps> = ({ onClick, title, children, active, spinning }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative', width: 40, height: 40, border: 'none', borderRadius: 6,
        background: active ? '#049484' : hov ? '#f1f5f9' : 'transparent',
        color: active ? '#ffffff' : hov ? '#1e293b' : '#475569',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s', flexShrink: 0,
      }}
    >
      <span style={spinning ? { animation: 'spin 0.9s linear infinite', display: 'flex' } : undefined}>
        {children}
      </span>
    </button>
  );
};

// ── SVG icons ─────────────────────────────────────────────────────────────────

const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);
const PencilIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const CheckIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const XIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const ShareIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);
/* ── Sidebar icons — simple, 20 px, strokeWidth 2.5 ── */
const PointerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4l7 18 3-7 7-3z" />
  </svg>
);
const ReactionIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="19" x2="19" y2="5" />
    <polyline points="9 5 19 5 19 15" />
  </svg>
);
const UndoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7h11a5 5 0 0 1 0 10H3" />
    <polyline points="7 3 3 7 7 11" />
  </svg>
);
const RedoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 7H10a5 5 0 0 0 0 10h11" />
    <polyline points="17 3 21 7 17 11" />
  </svg>
);
const CheckBuildIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 12 9 17 20 6" />
  </svg>
);
const DownloadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="15" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="4" y1="20" x2="20" y2="20" />
  </svg>
);
const SaveIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <rect x="8" y="3" width="8" height="6" />
    <rect x="7" y="13" width="10" height="8" />
  </svg>
);

