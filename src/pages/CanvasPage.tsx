import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShareProjectModal } from '../components/ui/ShareProjectModal';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Node, Edge } from 'reactflow';
import { CanvasMode, FlowCanvas } from '../components/flow/FlowCanvas';
import { DrawerModel } from '../components/canvas/ModelDrawer';
import { ModelDrawerModal } from '../components/canvas/ModelDrawerModal';
import { CanvasUmlPanelLayer } from '../components/canvas/CanvasUmlPanelLayer';
import { apiService, VsumRole, VsumUserResponse } from '../services/api';
import { VsumDetails } from '../types';
import { VsumMetaModelRef } from '../types/vsum';
import { WorkspaceSnapshot, WorkspaceSnapshotRequest } from '../types/workspace';
import { MODAL_Z_INDEX, useModalBodyLock } from '../components/ui/modalUtils';
import { CanvasProjectTabs } from '../components/canvas/CanvasProjectTabs';
import { CanvasProjectLoadStateOverlay } from '../components/canvas/CanvasProjectLoadStateOverlay';
import {
  CanvasPopupNotification,
  type CanvasPopupNotificationType,
} from '../components/canvas/CanvasPopupNotification';
import { CanvasProjectControls } from '../components/canvas/CanvasProjectControls';
import { CanvasSidebarToolbar } from '../components/canvas/CanvasSidebarToolbar';
import { CanvasProjectAccessControls } from '../components/canvas/CanvasProjectAccessControls';
import { CanvasConstraintsOverlay } from '../components/canvas/CanvasConstraintsOverlay';
import { getCanvasPanelMemberName } from '../components/canvas/canvasMemberPresentation';
import { useCanvasModeState } from '../hooks/useCanvasModeState';
import { useCanvasProjectRename } from '../hooks/useCanvasProjectRename';
import {
  useCanvasUmlPanels,
  type CanvasUmlPanelLoadErrorMessage,
} from '../hooks/useCanvasUmlPanels';
import { UnsavedTabCloseDialog } from '../components/canvas/UnsavedTabCloseDialog';
import { CanvasTabSession, OpenCanvasTab } from '../types/canvasTab';
import { createCanvasTabInstanceId } from '../utils/canvasTabId';
import {
  findMembershipForEmail,
  findVsumOwner,
  parseVsumMembersResponse,
  pickMostRestrictiveRole,
  readStoredProjectAccess,
  clearStoredProjectAccess,
  resolveProjectAccessRole,
  resolveVsumAccessRole,
  fetchOwnerContactForVsum,
  mergeStoredProjectAccess,
  sharedByToMember,
  uniqueVsumMembers,
  type SharedByContact,
} from '../utils/vsumMemberUtils';
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
import {
  getCanvasProjectLoadFailureState,
  type CanvasProjectLoadState,
} from '../utils/canvasProjectLoadState';
import {
  fetchEcoreFileById,
  fetchLibraryDrawerModels,
  metaModelToDrawerModel,
} from '../utils/canvasModelLibrary';

function isStaleTabLoad(forInstanceId: string | undefined, activeInstanceId: string | null): boolean {
  return Boolean(forInstanceId && activeInstanceId !== forInstanceId);
}

function clearVsumTabSessions(
  tabs: OpenCanvasTab[],
  sessions: Map<string, CanvasTabSession>,
  vsumId: number,
  forInstanceId?: string,
): void {
  for (const tab of tabs) {
    if (tab.projectId === vsumId) {
      sessions.delete(tab.instanceId);
    }
  }
  if (forInstanceId) {
    sessions.delete(forInstanceId);
  }
}

async function dispatchWorkspaceMetaModels(metaModels: VsumMetaModelRef[]): Promise<void> {
  for (const model of metaModels) {
    if (!model.ecoreFileId) continue;
    try {
      const fileContent = await apiService.getFile(model.ecoreFileId);
      globalThis.dispatchEvent(new CustomEvent('vitruv.addFileToWorkspace', {
        detail: {
          fileContent,
          fileName: `${model.name}.ecore`,
          description: model.description,
          keywords: model.keyword?.join(', '),
          domain: model.domain,
          createdAt: model.createdAt,
          metaModelId: model.id,
          metaModelSourceId: model.sourceId ?? model.id,
          ecoreFileId: model.ecoreFileId,
          genModelFileId: model.genModelFileId,
          fromServerLoad: true,
        },
      }));
      await new Promise(r => setTimeout(r, 50));
    } catch {
      // model without readable ecore file – skip canvas box
    }
  }
}

async function dispatchMetaModelRelations(
  relations: VsumDetails['metaModelsRelation'],
): Promise<void> {
  if (!relations?.length) return;
  globalThis.dispatchEvent(new CustomEvent('vitruv.loadMetaModelRelations', {
    detail: {
      relations: mapRelationsForCanvasLoad(relations),
      preserveExisting: false,
    },
  }));
  await new Promise(r => setTimeout(r, 150));
}

function finalizeVsumTabBaseline(
  tabs: OpenCanvasTab[],
  vsumId: number,
  details: VsumDetails,
  forInstanceId: string | undefined,
  activeInstanceId: string | null,
  setBaselineForInstance: (instanceId: string, snapshot: WorkspaceSnapshot) => void,
  loadedTabs: Set<string>,
): void {
  const tab = tabs.find(t => t.projectId === vsumId);
  if (!tab) return;
  setBaselineForInstance(tab.instanceId, workspaceSnapshotFromVsumDetails(details));
  if (!forInstanceId || activeInstanceId === forInstanceId) {
    loadedTabs.add(tab.instanceId);
  }
}

function applyVsumAccessAfterDetails(
  vsumId: number,
  mergedRole: VsumRole | null,
  loadStoredRole: VsumRole | null,
  loadNavRole: VsumRole | null,
  loadInferredRole: VsumRole | null,
  ownerContact: SharedByContact | null,
  setProjectSharer: React.Dispatch<React.SetStateAction<VsumUserResponse | null>>,
): void {
  if (ownerContact) {
    setProjectSharer(sharedByToMember(ownerContact, vsumId));
    mergeStoredProjectAccess(vsumId, {
      accessRole: mergedRole ?? loadStoredRole ?? loadNavRole ?? 'VIEWER',
      sharedBy: ownerContact,
    });
    return;
  }
  const isOwnerAccess = mergedRole === 'OWNER' || (!loadInferredRole && mergedRole !== 'VIEWER');
  if (isOwnerAccess) {
    mergeStoredProjectAccess(vsumId, {
      accessRole: mergedRole ?? 'OWNER',
      sharedBy: null,
    });
    return;
  }
  const persistedSharedBy = readStoredProjectAccess(vsumId)?.sharedBy;
  if (persistedSharedBy) {
    setProjectSharer(sharedByToMember(persistedSharedBy, vsumId));
  }
}

type ApplyProjectMembersFn = (
  members: VsumUserResponse[],
  options?: { fallbackRole?: VsumRole | null; sharedBy?: SharedByContact | null; vsumId?: number },
) => void;

async function loadVsumProjectMembers(
  vsumId: number,
  applyProjectMembers: ApplyProjectMembersFn,
  memberOptions: { fallbackRole?: VsumRole | null; sharedBy?: SharedByContact | null; vsumId?: number },
): Promise<void> {
  try {
    const membersRes = await apiService.getVsumMembers(vsumId);
    applyProjectMembers(parseVsumMembersResponse(membersRes), memberOptions);
  } catch {
    applyProjectMembers([], memberOptions);
  }
}

async function syncVsumApiRole(
  vsumId: number,
  loadStoredRole: VsumRole | null,
  loadNavRole: VsumRole | null,
  loadInferredRole: VsumRole | null,
  noteApiRole: (projectId: number, role: VsumRole | null) => void,
): Promise<void> {
  try {
    const vsumRes = await apiService.getVsum(vsumId);
    const apiRole = resolveVsumAccessRole(vsumRes.data?.role, vsumRes.data?.roleEn);
    const merged = pickMostRestrictiveRole(apiRole, loadStoredRole, loadNavRole, loadInferredRole);
    if (merged) noteApiRole(vsumId, merged);
  } catch {
    // Role may already be set from members list or navigation state.
  }
}

interface HydrateCanvasWorkspaceParams {
  details: VsumDetails;
  forInstanceId?: string;
  activeInstanceId: string | null;
  flowCanvasRef: React.RefObject<{ getNodes?: () => Node[]; establishBaseline?: () => void } | null>;
  canvasMode: CanvasMode;
  setConstraintsNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setMyLibraryModels: React.Dispatch<React.SetStateAction<DrawerModel[]>>;
  setPublicLibraryModels: React.Dispatch<React.SetStateAction<DrawerModel[]>>;
}

async function hydrateCanvasWorkspace(params: HydrateCanvasWorkspaceParams): Promise<boolean> {
  const {
    details,
    forInstanceId,
    activeInstanceId,
    flowCanvasRef,
    canvasMode,
    setConstraintsNodes,
    setMyLibraryModels,
    setPublicLibraryModels,
  } = params;
  const isStale = () => isStaleTabLoad(forInstanceId, activeInstanceId);

  const { myModels, publicModels } = await fetchLibraryDrawerModels();
  setMyLibraryModels(myModels);
  setPublicLibraryModels(publicModels);
  if (isStale()) return false;

  await dispatchWorkspaceMetaModels(details.metaModels || []);
  if (isStale()) return false;

  await waitForMetaModelsOnCanvas(
    () => flowCanvasRef.current?.getNodes?.() ?? [],
    details.metaModels ?? [],
  );
  if (isStale()) return false;

  if (canvasMode === 'constraints') {
    setConstraintsNodes(flowCanvasRef.current?.getNodes?.() ?? []);
  }

  await dispatchMetaModelRelations(details.metaModelsRelation);
  if (isStale()) return false;

  await new Promise(r => setTimeout(r, 150));
  if (isStale()) return false;

  // The project's existing metamodels/relations just loaded via a sequence of
  // canvas mutations (one per file, one per relation) — none of that should be
  // undoable by the user. Establish it as the undo baseline, mirroring how
  // loadDiagramData() resets the baseline for every other bulk-load path.
  flowCanvasRef.current?.establishBaseline?.();

  globalThis.dispatchEvent(new CustomEvent('vitruv.fitEcoreWorkspace'));
  return true;
}

function persistLeavingTabSession(
  previousId: string | null,
  nextId: string | null,
  loadingTabId: string | null,
  cancelled: boolean,
  openTabs: OpenCanvasTab[],
  sessions: Map<string, CanvasTabSession>,
  captureSession: () => CanvasTabSession,
): void {
  if (!previousId || previousId === nextId || loadingTabId === previousId) return;
  const tabStillOpen = openTabs.some(t => t.instanceId === previousId);
  if (!cancelled && tabStillOpen) {
    sessions.set(previousId, captureSession());
  }
}

async function loadOpenCanvasTab(
  nextId: string,
  cancelled: boolean,
  openTabs: OpenCanvasTab[],
  loadingTabRef: React.MutableRefObject<string | null>,
  clearCanvasWorkspace: () => void,
  loadVsum: (vsumId: number, forInstanceId?: string) => Promise<void>,
): Promise<void> {
  const tab = openTabs.find(t => t.instanceId === nextId);
  if (!tab) return;

  if (!cancelled) {
    loadingTabRef.current = nextId;
    clearCanvasWorkspace();
    globalThis.dispatchEvent(new CustomEvent('vitruv.resetWorkspace'));
  }
  try {
    await loadVsum(tab.projectId, nextId);
  } finally {
    if (loadingTabRef.current === nextId) {
      loadingTabRef.current = null;
    }
  }
}

// ── CanvasPage ────────────────────────────────────────────────────────────────

export const CanvasPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const flowCanvasRef = useRef<any>(null);

  const [vsumName, setVsumName] = useState<string>('');
  const projectApiRolesRef = useRef<Map<number, VsumRole>>(new Map());
  const [roleRevision, setRoleRevision] = useState(0);
  const bumpProjectRole = useCallback(() => setRoleRevision(r => r + 1), []);
  const [drawerModels, setDrawerModels] = useState<DrawerModel[]>([]);
  const [myLibraryModels, setMyLibraryModels] = useState<DrawerModel[]>([]);
  const [publicLibraryModels, setPublicLibraryModels] = useState<DrawerModel[]>([]);
  const [addedModelIds, setAddedModelIds] = useState<Set<number>>(new Set());
  const [loadingProject, setLoadingProject] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);

  const panelZBase = MODAL_Z_INDEX;

  // check / download / save
  const [checkingBuild, setCheckingBuild] = useState(false);
  const [downloadingArtifact, setDownloadingArtifact] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [popup, setPopup] = useState<{ message: string; type: CanvasPopupNotificationType } | null>(null);
  const notifyUmlPanelLoadError = useCallback((message: CanvasUmlPanelLoadErrorMessage) => {
    setPopup({ message, type: 'error' });
    setTimeout(() => setPopup(null), 4000);
  }, []);

  const [openTabs, setOpenTabs] = useState<OpenCanvasTab[]>([]);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
  const sessionsRef = useRef<Map<string, CanvasTabSession>>(new Map());
  const savedBaselinesRef = useRef<Map<string, WorkspaceSnapshot>>(new Map());
  const prevActiveInstanceIdRef = useRef<string | null>(null);
  const openTabsRef = useRef(openTabs);
  openTabsRef.current = openTabs;
  const activeInstanceIdRef = useRef(activeInstanceId);
  activeInstanceIdRef.current = activeInstanceId;
  const loadingTabRef = useRef<string | null>(null);
  const loadedTabsRef = useRef<Set<string>>(new Set());
  const viewerLastUpdatedRef = useRef<string | null>(null);
  const [closeConfirmInstanceId, setCloseConfirmInstanceId] = useState<string | null>(null);
  const [closeConfirmSaving, setCloseConfirmSaving] = useState(false);
  const [dirtyRevision, setDirtyRevision] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [projectMembers, setProjectMembers] = useState<VsumUserResponse[]>([]);
  const [projectSharer, setProjectSharer] = useState<VsumUserResponse | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);

  const createInstanceId = useCallback(
    (projectId: number) => createCanvasTabInstanceId(projectId),
    [],
  );

  const activeTab = openTabs.find(t => t.instanceId === activeInstanceId);
  const activeProjectId = activeTab?.projectId ?? (id ? Number(id) : undefined);
  const [projectLoadState, setProjectLoadState] = useState<CanvasProjectLoadState>({ status: 'loading' });

  const navAccess = React.useMemo(() => {
    const projectId = activeProjectId ?? (id ? Number(id) : undefined);
    if (!projectId || !Number.isFinite(projectId)) return null;

    const stored = readStoredProjectAccess(projectId);
    const state = location.state as {
      vsumId?: number;
      accessRole?: string;
      sharedBy?: SharedByContact;
    } | null;
    const routeId = id ? Number(id) : undefined;
    const routeMatches = Boolean(
      state?.accessRole
      && routeId === projectId
      && (!state.vsumId || state.vsumId === projectId),
    );

    return {
      accessRole: (routeMatches ? state?.accessRole : undefined) ?? stored?.accessRole,
      sharedBy: (routeMatches ? state?.sharedBy : undefined) ?? stored?.sharedBy ?? null,
    };
  }, [activeProjectId, id, location.state]);

  const navAccessRole = resolveVsumAccessRole(navAccess?.accessRole);
  const sharedInferredRole: VsumRole | null = navAccess?.sharedBy ? 'VIEWER' : null;

  const noteApiRole = useCallback((projectId: number, role: VsumRole | null) => {
    if (role) projectApiRolesRef.current.set(projectId, role);
    else projectApiRolesRef.current.delete(projectId);
    bumpProjectRole();
  }, [bumpProjectRole]);

  const effectiveVsumRole = React.useMemo(() => {
    if (!activeProjectId || roleRevision < 0) return null;
    return resolveProjectAccessRole(activeProjectId, projectApiRolesRef.current.get(activeProjectId));
  }, [activeProjectId, roleRevision]);

  const isViewOnly = effectiveVsumRole === 'VIEWER';
  const canShare = effectiveVsumRole === 'OWNER';
  const isSharedAccess = effectiveVsumRole === 'VIEWER'
    || effectiveVsumRole === 'MEMBER'
    || Boolean(navAccess?.sharedBy);

  const displayProjectSharer = React.useMemo(() => {
    if (projectSharer) return projectSharer;
    if (!activeProjectId) return null;
    const stored = readStoredProjectAccess(activeProjectId)?.sharedBy;
    if (!stored) return null;
    return sharedByToMember(stored, activeProjectId);
  }, [projectSharer, activeProjectId]);

  const isViewOnlyProject = useCallback((projectId: number): boolean => {
    if (roleRevision < 0) return false;
    return resolveProjectAccessRole(projectId, projectApiRolesRef.current.get(projectId)) === 'VIEWER';
  }, [roleRevision]);

  const applyProjectMembers = useCallback((
    members: VsumUserResponse[],
    options?: { fallbackRole?: VsumRole | null; sharedBy?: SharedByContact | null; vsumId?: number },
  ) => {
    const unique = uniqueVsumMembers(members);
    setProjectMembers(unique);

    const storedSharedBy = options?.vsumId
      ? readStoredProjectAccess(options.vsumId)?.sharedBy ?? null
      : null;
    const sharedBy = options?.sharedBy ?? storedSharedBy;

    const owner = findVsumOwner(unique);
    if (owner) {
      setProjectSharer(owner);
      if (options?.vsumId) {
        mergeStoredProjectAccess(options.vsumId, {
          sharedBy: {
            firstName: owner.firstName,
            lastName: owner.lastName,
            email: owner.email,
          },
        });
      }
    } else if (sharedBy && options?.vsumId) {
      setProjectSharer(sharedByToMember(sharedBy, options.vsumId));
    }

    const myMembership = findMembershipForEmail(unique, user?.email);
    const resolvedRole = pickMostRestrictiveRole(
      resolveVsumAccessRole(myMembership?.role, myMembership?.roleEn),
      resolveVsumAccessRole(options?.fallbackRole),
      navAccessRole,
      sharedInferredRole,
    );
    if (resolvedRole && options?.vsumId) noteApiRole(options.vsumId, resolvedRole);
  }, [navAccessRole, sharedInferredRole, user?.email, noteApiRole]);

  const refreshProjectMembers = useCallback(async () => {
    if (!activeProjectId) return;
    setMembersLoading(true);
    try {
      try {
        const membersRes = await apiService.getVsumMembers(activeProjectId);
        applyProjectMembers(parseVsumMembersResponse(membersRes), {
          fallbackRole: navAccessRole,
          sharedBy: navAccess?.sharedBy ?? null,
          vsumId: activeProjectId,
        });
      } catch {
        applyProjectMembers([], {
          fallbackRole: navAccessRole,
          sharedBy: navAccess?.sharedBy ?? null,
          vsumId: activeProjectId,
        });
      }

      if (isViewOnlyProject(activeProjectId)) {
        const ownerContact = await fetchOwnerContactForVsum(activeProjectId);
        if (ownerContact) {
          setProjectSharer(sharedByToMember(ownerContact, activeProjectId));
          mergeStoredProjectAccess(activeProjectId, {
            accessRole: 'VIEWER',
            sharedBy: ownerContact,
          });
        }
      }
    } finally {
      setMembersLoading(false);
    }
  }, [activeProjectId, applyProjectMembers, navAccess?.sharedBy, isViewOnlyProject, navAccessRole]);

  const handleRemoveMember = useCallback(async (vsumUserId: number) => {
    try {
      await apiService.removeVsumMember(vsumUserId);
      globalThis.dispatchEvent(new CustomEvent('vitruv.refreshVsums'));
      await refreshProjectMembers();
      setPopup({ message: 'Access removed.', type: 'success' });
      setTimeout(() => setPopup(null), 3000);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to remove access';
      setPopup({ message, type: 'error' });
      setTimeout(() => setPopup(null), 4000);
    }
  }, [refreshProjectMembers]);

  useEffect(() => {
    if (!activeProjectId) return;
    const stored = readStoredProjectAccess(activeProjectId);
    const navRole = resolveVsumAccessRole(navAccess?.accessRole);
    if (navRole || navAccess?.sharedBy) {
      mergeStoredProjectAccess(activeProjectId, {
        accessRole: navRole ?? (navAccess?.sharedBy ? 'VIEWER' : stored?.accessRole ?? 'OWNER'),
        sharedBy: navAccess?.sharedBy ?? stored?.sharedBy ?? null,
      });
      noteApiRole(activeProjectId, navRole ?? (navAccess?.sharedBy ? 'VIEWER' : null));
    }
    const sharedBy = navAccess?.sharedBy ?? stored?.sharedBy ?? null;
    if (sharedBy) {
      setProjectSharer(sharedByToMember(sharedBy, activeProjectId));
    } else {
      setProjectSharer(null);
    }
    setProjectMembers([]);
    bumpProjectRole();
  }, [activeProjectId, navAccess?.sharedBy, navAccess?.accessRole, bumpProjectRole, noteApiRole]);

  // Resolve owner contact for shared projects (list API may omit owner fields).
  useEffect(() => {
    if (!activeProjectId || !isSharedAccess) return;
    const stored = readStoredProjectAccess(activeProjectId)?.sharedBy;
    if (stored) {
      setProjectSharer(sharedByToMember(stored, activeProjectId));
      return;
    }
    let cancelled = false;
    void fetchOwnerContactForVsum(activeProjectId).then(contact => {
      if (cancelled || !contact) return;
      setProjectSharer(sharedByToMember(contact, activeProjectId));
      mergeStoredProjectAccess(activeProjectId, { sharedBy: contact });
    });
    return () => { cancelled = true; };
  }, [activeProjectId, isSharedAccess]);

  // Add-reaction mode
  const [addReactionMode, setAddReactionMode] = useState(false);
  useEffect(() => {
    if (isViewOnly) setAddReactionMode(false);
  }, [isViewOnly]);

  // Canvas mode (Modeling / Constraints / Views)
  const getCanvasNodes = useCallback(
    (): Node[] => flowCanvasRef.current?.getNodes?.() ?? [],
    [],
  );
  const {
    canvasMode,
    canvasModeRef,
    constraintsNodes,
    setConstraintsNodes,
    constraintHighlightNodeId,
    setConstraintHighlightNodeId,
    constraintFilterNodeId,
    setConstraintFilterNodeId,
    handleCanvasModeChange,
  } = useCanvasModeState({
    projectId: activeProjectId,
    isViewOnly,
    getCanvasNodes,
  });
  const updateCanvasEcoreFileData = useCallback((
    fileName: string,
    content: string,
    ecoreFileId?: number,
  ) => {
    if (ecoreFileId === undefined) {
      flowCanvasRef.current?.updateEcoreFileData?.(fileName, content);
      return;
    }
    flowCanvasRef.current?.updateEcoreFileData?.(fileName, content, ecoreFileId);
  }, []);
  const {
    umlPanels,
    topPanelId,
    handleEcoreFileExpand,
    closePanel,
    focusPanel,
    handleUmlPanelEcoreContentUpdated,
    buildUmlSaveContext,
    clearPanels,
    restorePanels,
    removePanelsForDeletedModel,
  } = useCanvasUmlPanels({
    activeProjectId,
    openTabCount: openTabs.length,
    isViewOnly,
    getCanvasNodes,
    fetchEcoreFile: fetchEcoreFileById,
    updateEcoreFileData: updateCanvasEcoreFileData,
    onLoadError: notifyUmlPanelLoadError,
  });

  useModalBodyLock(umlPanels.length > 0 || showDrawer);

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
    const tab = openTabsRef.current.find(t => t.instanceId === instanceId);
    if (tab && isViewOnlyProject(tab.projectId)) return false;
    const baseline = savedBaselinesRef.current.get(instanceId);
    if (!baseline) return false;
    if (instanceId === activeInstanceId) {
      return !workspaceSnapshotsEqual(baseline, getLiveSnapshot());
    }
    const session = sessionsRef.current.get(instanceId);
    if (!session) return false;
    return !workspaceSnapshotsEqual(baseline, session.workspaceSnapshot);
  }, [activeInstanceId, getLiveSnapshot, isViewOnlyProject]);

  const updateTabName = useCallback((projectId: number, name: string) => {
    setOpenTabs(prev => prev.map(t => (t.projectId === projectId ? { ...t, name } : t)));
  }, []);

  const renameProject = useCallback((projectId: number, name: string): Promise<unknown> => {
    return apiService.renameVsum(projectId, { name });
  }, []);

  const handleProjectRenamed = useCallback((name: string) => {
    setVsumName(name);
    if (activeProjectId) updateTabName(activeProjectId, name);
  }, [activeProjectId, updateTabName]);

  const {
    editingName,
    nameInput,
    savingName,
    setNameInput,
    startRename,
    confirmRename,
    cancelRename,
  } = useCanvasProjectRename({
    projectId: activeProjectId,
    projectName: vsumName,
    isViewOnly,
    renameProject,
    onRenamed: handleProjectRenamed,
  });

  const clearCanvasWorkspace = useCallback(() => {
    flowCanvasRef.current?.loadDiagramData?.([], []);
    setDrawerModels([]);
    setMyLibraryModels([]);
    setPublicLibraryModels([]);
    setAddedModelIds(new Set());
    clearPanels();
    setShowDrawer(false);
    cancelRename();
  }, [cancelRename, clearPanels]);

  const applyTabSession = useCallback((session: CanvasTabSession) => {
    setVsumName(session.vsumName);
    setDrawerModels(session.drawerModels);
    setMyLibraryModels(session.myLibraryModels);
    setPublicLibraryModels(session.publicLibraryModels);
    setAddedModelIds(new Set(session.addedModelIds));
    restorePanels(session.umlPanels, session.topPanelId);
    setShowDrawer(false);
    cancelRename();
    setLoadingProject(false);

    if (canvasModeRef.current === 'constraints') {
      setConstraintsNodes(session.nodes);
    }

    const load = () => {
      flowCanvasRef.current?.loadDiagramData?.(session.nodes, session.edges);
    };
    load();
    setTimeout(load, 50);
  }, [cancelRename, canvasModeRef, restorePanels, setConstraintsNodes]);

  const captureRef = useRef(captureCurrentTabSession);
  captureRef.current = captureCurrentTabSession;
  const applyRef = useRef(applyTabSession);
  applyRef.current = applyTabSession;

  const switchToTab = useCallback((instanceId: string) => {
    const tab = openTabsRef.current.find(t => t.instanceId === instanceId);
    if (!tab || activeInstanceId === instanceId) return;
    bumpProjectRole();
    setActiveInstanceId(instanceId);
    if (String(tab.projectId) !== id) {
      navigate(`/canvas/${tab.projectId}`, { replace: true });
    }
  }, [navigate, id, activeInstanceId, bumpProjectRole]);

  const handleSelectProject = useCallback((projectId: number, name: string, accessRole?: string) => {
    const stored = readStoredProjectAccess(projectId);
    const resolved = resolveVsumAccessRole(accessRole ?? stored?.accessRole);
    if (resolved || stored?.sharedBy) {
      mergeStoredProjectAccess(projectId, {
        accessRole: resolved ?? (stored?.sharedBy ? 'VIEWER' : 'OWNER'),
        sharedBy: stored?.sharedBy ?? null,
      });
    } else if (!stored) {
      mergeStoredProjectAccess(projectId, { accessRole: 'OWNER' });
    }
    bumpProjectRole();
    const existing = openTabsRef.current.find(t => t.projectId === projectId);
    if (existing) {
      switchToTab(existing.instanceId);
      return;
    }
    const instanceId = createInstanceId(projectId);
    setOpenTabs(prev => [...prev, { instanceId, projectId, name }]);
    setActiveInstanceId(instanceId);
    navigate(`/canvas/${projectId}`);
  }, [createInstanceId, navigate, switchToTab, bumpProjectRole]);

  const performCloseTab = useCallback((instanceId: string) => {
    sessionsRef.current.delete(instanceId);
    savedBaselinesRef.current.delete(instanceId);
    loadedTabsRef.current.delete(instanceId);
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
    const tab = openTabsRef.current.find(t => t.instanceId === instanceId);
    if (tab && isViewOnlyProject(tab.projectId)) {
      performCloseTab(instanceId);
      return;
    }
    if (isInstanceDirty(instanceId)) {
      setCloseConfirmInstanceId(instanceId);
      return;
    }
    performCloseTab(instanceId);
  }, [isInstanceDirty, isViewOnlyProject, performCloseTab]);

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
    const ids = new Set<string>();
    for (const tab of openTabs) {
      if (isInstanceDirty(tab.instanceId)) ids.add(tab.instanceId);
    }
    return ids;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dirtyRevision intentionally forces re-evaluation on every 700 ms poll tick
  }, [openTabs, dirtyRevision, isInstanceDirty]);

  useEffect(() => {
    const timer = globalThis.setInterval(() => setDirtyRevision(r => r + 1), 700);
    return () => globalThis.clearInterval(timer);
  }, []);

  // Ensure route project is represented as a tab
  useEffect(() => {
    if (!id) return;
    const projectId = Number(id);
    if (!Number.isFinite(projectId)) {
      setProjectLoadState({
        status: 'notFound',
        message: 'This project URL is invalid.',
      });
      return;
    }

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

  const loadVsum = useCallback(async (vsumId: number, forInstanceId?: string) => {
    setProjectLoadState({ status: 'loading' });
    setLoadingProject(true);
    clearCanvasWorkspace();
    globalThis.dispatchEvent(new CustomEvent('vitruv.resetWorkspace'));
    clearVsumTabSessions(openTabsRef.current, sessionsRef.current, vsumId, forInstanceId);

    const stored = readStoredProjectAccess(vsumId);
    const loadStoredRole = resolveVsumAccessRole(stored?.accessRole);
    const loadNavRole = resolveVsumAccessRole(navAccess?.accessRole);
    const loadInferredRole: VsumRole | null = (stored?.sharedBy || navAccess?.sharedBy) ? 'VIEWER' : null;
    const memberOptions = {
      fallbackRole: navAccessRole,
      sharedBy: stored?.sharedBy ?? navAccess?.sharedBy ?? null,
      vsumId,
    };

    try {
      const response = await apiService.getVsumDetails(vsumId);
      if (isStaleTabLoad(forInstanceId, activeInstanceIdRef.current)) return;
      setProjectLoadState({ status: 'hydrating' });

      const details: VsumDetails = response.data;
      setVsumName(details.name);
      updateTabName(vsumId, details.name);
      setDrawerModels((details.metaModels || []).map(m => metaModelToDrawerModel(m, true)));

      const detailsRole = resolveVsumAccessRole(details.role, details.roleEn);
      const mergedRole = pickMostRestrictiveRole(
        detailsRole,
        loadStoredRole,
        loadNavRole,
        loadInferredRole,
      );
      if (mergedRole) noteApiRole(vsumId, mergedRole);

      const ownerContact = await fetchOwnerContactForVsum(vsumId, details);
      applyVsumAccessAfterDetails(
        vsumId,
        mergedRole,
        loadStoredRole,
        loadNavRole,
        loadInferredRole,
        ownerContact,
        setProjectSharer,
      );
      viewerLastUpdatedRef.current = details.updatedAt ?? null;

      await loadVsumProjectMembers(vsumId, applyProjectMembers, memberOptions);
      await syncVsumApiRole(vsumId, loadStoredRole, loadNavRole, loadInferredRole, noteApiRole);

      const hydrated = await hydrateCanvasWorkspace({
        details,
        forInstanceId,
        activeInstanceId: activeInstanceIdRef.current,
        flowCanvasRef,
        canvasMode: canvasModeRef.current,
        setConstraintsNodes,
        setMyLibraryModels,
        setPublicLibraryModels,
      });
      if (!hydrated) return;

      finalizeVsumTabBaseline(
        openTabsRef.current,
        vsumId,
        details,
        forInstanceId,
        activeInstanceIdRef.current,
        setBaselineForInstance,
        loadedTabsRef.current,
      );
      setProjectLoadState({ status: 'ready' });
    } catch (e) {
      console.error('Failed to load VSUM:', e);
      if (isStaleTabLoad(forInstanceId, activeInstanceIdRef.current)) return;
      setProjectLoadState(getCanvasProjectLoadFailureState(e));
    } finally {
      if (!forInstanceId || activeInstanceIdRef.current === forInstanceId) {
        setLoadingProject(false);
      }
    }
  }, [clearCanvasWorkspace, setBaselineForInstance, updateTabName, applyProjectMembers, navAccess, navAccessRole, noteApiRole, canvasModeRef, setConstraintsNodes]);

  // Viewers: reload when the owner saves changes; detect when access is revoked.
  useEffect(() => {
    if (!isViewOnly || !activeProjectId) return;

    const updatedAtMs = (value?: string | null): number | null => {
      if (!value) return null;
      const ms = Date.parse(value);
      return Number.isFinite(ms) ? ms : null;
    };

    const handleAccessRevoked = () => {
      clearStoredProjectAccess(activeProjectId);
      globalThis.dispatchEvent(new CustomEvent('vitruv.refreshVsums'));
      setPopup({ message: 'You no longer have access to this project.', type: 'error' });
      navigate('/');
    };

    const checkForUpdates = async () => {
      if (loadingTabRef.current) return;
      try {
        const listRes = await apiService.getVsumsPaginated('', 0, 100);
        const stillHasAccess = (listRes.data ?? []).some(v => v.id === activeProjectId);
        if (!stillHasAccess) {
          handleAccessRevoked();
          return;
        }

        const res = await apiService.getVsum(activeProjectId);
        const remoteUpdated = res.data?.updatedAt;
        if (!remoteUpdated) return;
        const remoteMs = updatedAtMs(remoteUpdated);
        const localMs = updatedAtMs(viewerLastUpdatedRef.current);
        if (remoteMs != null && localMs != null && remoteMs > localMs) {
          await loadVsum(activeProjectId, activeInstanceId ?? undefined);
        }
        viewerLastUpdatedRef.current = remoteUpdated;
      } catch {
        // ignore transient polling errors
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkForUpdates();
    };

    document.addEventListener('visibilitychange', onVisible);
    const timer = globalThis.setInterval(() => void checkForUpdates(), 15000);
    return () => {
      globalThis.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isViewOnly, activeProjectId, activeInstanceId, loadVsum, navigate]);

  // Switch tabs: capture leaving tab, restore or load active tab
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const previousId = prevActiveInstanceIdRef.current;
      const nextId = activeInstanceId;

      persistLeavingTabSession(
        previousId,
        nextId,
        loadingTabRef.current,
        cancelled,
        openTabsRef.current,
        sessionsRef.current,
        () => captureRef.current(),
      );

      prevActiveInstanceIdRef.current = nextId;
      if (!nextId) return;

      // Clear stale nodes so the new ConstraintsView instance mounts with a blank slate.
      if (canvasModeRef.current === 'constraints') {
        setConstraintsNodes([]);
      }

      const cached = sessionsRef.current.get(nextId);
      if (cached && loadedTabsRef.current.has(nextId)) {
        if (openTabsRef.current.some(t => t.instanceId === nextId)) bumpProjectRole();
        applyRef.current(cached);
        setProjectLoadState({ status: 'ready' });
        return;
      }
      sessionsRef.current.delete(nextId);

      await loadOpenCanvasTab(
        nextId,
        cancelled,
        openTabsRef.current,
        loadingTabRef,
        clearCanvasWorkspace,
        loadVsum,
      );
    };

    run();
    return () => { cancelled = true; };
  }, [activeInstanceId, clearCanvasWorkspace, loadVsum, bumpProjectRole, canvasModeRef, setConstraintsNodes]);

  // ── Add model from drawer ─────────────────────────────────────────────────

  const handleAddModel = useCallback(async (model: DrawerModel) => {
    if (isViewOnly) return;
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
  }, [isViewOnly]);

  const handleDeleteModel = useCallback(async (model: DrawerModel) => {
    if (isViewOnly) return;
    await apiService.deleteMetaModel(String(model.id));
    const sourceId = model.sourceId ?? model.id;
    const nodes = flowCanvasRef.current?.getNodes?.() ?? [];
    const edges = flowCanvasRef.current?.getEdges?.() ?? [];
    const removeIds = new Set(
      nodes
        .filter((n: Node) => {
          if (n.type !== 'ecoreFile') return false;
          const mmId = n.data?.metaModelId;
          const mmSourceId = n.data?.metaModelSourceId;
          return mmId === model.id || mmId === sourceId || mmSourceId === model.id || mmSourceId === sourceId;
        })
        .map((n: Node) => n.id),
    );
    if (removeIds.size > 0) {
      flowCanvasRef.current?.loadDiagramData?.(
        nodes.filter((n: Node) => !removeIds.has(n.id)),
        edges.filter((e: Edge) => !removeIds.has(e.source) && !removeIds.has(e.target)),
      );
    }
    setMyLibraryModels(prev => prev.filter(m => m.id !== model.id));
    setPublicLibraryModels(prev => prev.filter(m => m.id !== model.id));
    setDrawerModels(prev => prev.filter(m => m.id !== model.id && m.sourceId !== model.id && m.sourceId !== sourceId));
    removePanelsForDeletedModel(model.id, sourceId);
  }, [isViewOnly, removePanelsForDeletedModel]);

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
    const isViewOnlyRef = { current: false };
    const syncViewOnly = () => {
      if (!activeProjectId) {
        isViewOnlyRef.current = false;
        return;
      }
      isViewOnlyRef.current = resolveProjectAccessRole(
        activeProjectId,
        projectApiRolesRef.current.get(activeProjectId),
      ) === 'VIEWER';
    };
    syncViewOnly();

    const handleReset = () => {
      flowCanvasRef.current?.loadDiagramData?.([], []);
    };
    const handleAddFile = (e: Event) => {
      syncViewOnly();
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      if (isViewOnlyRef.current && !detail.fromServerLoad) return;
      const existing = flowCanvasRef.current?.getNodes?.() || [];
      const metaModelId = detail.metaModelId ?? detail.metaModelSourceId;
      if (
        existing.some((n: any) =>
          n.type === 'ecoreFile'
          && (
            n.data.fileName === detail.fileName
            || (metaModelId != null && (
              n.data.metaModelId === metaModelId
              || n.data.metaModelSourceId === metaModelId
            ))
          ),
        )
      ) return;
      flowCanvasRef.current?.addEcoreFile?.(detail.fileName, detail.fileContent, detail);
    };
    globalThis.addEventListener('vitruv.resetWorkspace', handleReset as EventListener);
    globalThis.addEventListener('vitruv.addFileToWorkspace', handleAddFile as EventListener);
    return () => {
      globalThis.removeEventListener('vitruv.resetWorkspace', handleReset as EventListener);
      globalThis.removeEventListener('vitruv.addFileToWorkspace', handleAddFile as EventListener);
    };
  }, [activeProjectId, navAccess?.sharedBy, roleRevision]);

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
    if (isViewOnly || !activeProjectId) return;
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
  }, [activeProjectId, isViewOnly]);

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
    if (isViewOnly || !activeProjectId) return;
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
  }, [activeProjectId, activeInstanceId, setBaselineForInstance, isViewOnly]);

  const navigateHome = useCallback(() => navigate('/'), [navigate]);

  const handleReactionModeEnd = useCallback(() => setAddReactionMode(false), []);

  const handleOpenReactionEditor = useCallback(() => {
    const opened = flowCanvasRef.current?.openSelectedReactionEditor?.();
    if (!opened) {
      setPopup({
        message: 'Select a reaction connection on the canvas first, or double-click a connection line.',
        type: 'info',
      });
      setTimeout(() => setPopup(null), 4000);
    }
  }, []);
  const handleHistoryChange = useCallback((undoAvailable: boolean, redoAvailable: boolean) => {
    setCanUndo(undoAvailable);
    setCanRedo(redoAvailable);
  }, []);
  const handleCloseDrawer = useCallback(() => setShowDrawer(false), []);
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

  const handleCloseConfirmSave = useCallback(async () => {
    if (isViewOnly || !closeConfirmInstanceId) return;
    setCloseConfirmSaving(true);
    const ok = await saveTabInstance(closeConfirmInstanceId);
    setCloseConfirmSaving(false);
    if (!ok) {
      setPopup({ message: 'Failed to save changes.', type: 'error' });
      setTimeout(() => setPopup(null), 4000);
      return;
    }
    const instanceId = closeConfirmInstanceId;
    setCloseConfirmInstanceId(null);
    performCloseTab(instanceId);
    setPopup({ message: 'Changes saved.', type: 'success' });
    setTimeout(() => setPopup(null), 3000);
  }, [closeConfirmInstanceId, saveTabInstance, performCloseTab, isViewOnly]);

  const handleCloseWithoutSaving = useCallback(() => {
    if (!closeConfirmInstanceId) return;
    performCloseTab(closeConfirmInstanceId);
    setCloseConfirmInstanceId(null);
  }, [closeConfirmInstanceId, performCloseTab]);

  const handleCloseConfirmCancel = useCallback(() => setCloseConfirmInstanceId(null), []);

  const handleRetryProjectLoad = useCallback(() => {
    if (activeProjectId) void loadVsum(activeProjectId, activeInstanceId ?? undefined);
  }, [activeProjectId, activeInstanceId, loadVsum]);

  const shouldRenderCanvasShell =
    projectLoadState.status === 'loading' ||
    projectLoadState.status === 'hydrating' ||
    projectLoadState.status === 'ready';

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>

      {shouldRenderCanvasShell && (
      <div style={{
        width: '100%',
        height: '100%',
        visibility: projectLoadState.status === 'ready' ? 'visible' : 'hidden',
      }}>
      <FlowCanvas
        key={activeInstanceId ?? `canvas-${activeProjectId ?? 'new'}`}
        ref={flowCanvasRef}
        vsumId={activeProjectId?.toString()}
        readOnly={isViewOnly}
        canvasMode={canvasMode}
        onDiagramChange={handleDiagramChange}
        onEcoreFileExpand={handleEcoreFileExpand}
        umlModalOpen={umlPanels.length > 0}
        addReactionMode={addReactionMode}
        onReactionModeEnd={handleReactionModeEnd}
        onHistoryChange={handleHistoryChange}
        onCanvasModeChange={handleCanvasModeChange}
        constraintHighlightNodeId={constraintHighlightNodeId}
        constraintFilterNodeId={constraintFilterNodeId}
        onConstraintNodeFilter={setConstraintFilterNodeId}
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

      <CanvasUmlPanelLayer
        panels={umlPanels}
        vsumName={vsumName}
        activeProjectId={activeProjectId}
        topPanelId={topPanelId}
        panelZBase={panelZBase}
        viewOnly={isViewOnly}
        buildSaveContext={buildUmlSaveContext}
        onClose={closePanel}
        onFocus={focusPanel}
        onHome={navigateHome}
        onEcoreContentUpdated={handleUmlPanelEcoreContentUpdated}
        fetchEcoreFile={fetchEcoreFileById}
      />

      {/* Model drawer modal */}
      {showDrawer && !isViewOnly && (
        <ModelDrawerModal
          models={drawerModels}
          addedModelIds={addedModelIds}
          loading={loadingProject}
          myLibraryModels={myLibraryModels}
          publicLibraryModels={publicLibraryModels}
          onClose={handleCloseDrawer}
          onAddModel={handleAddModel}
          onDeleteModel={handleDeleteModel}
          onFetchFile={fetchEcoreFileById}
        />
      )}

      <CanvasConstraintsOverlay
        projectId={activeProjectId}
        visible={canvasMode === 'constraints' && !isViewOnly}
        canvasNodes={constraintsNodes}
        onHighlightNode={setConstraintHighlightNodeId}
        filterNodeId={constraintFilterNodeId}
      />

      {/* Left sidebar toolbar */}
      {canvasMode !== 'constraints' && <CanvasSidebarToolbar
        readOnly={isViewOnly}
        addReactionMode={addReactionMode}
        onToggleReactionMode={() => setAddReactionMode(v => !v)}
        onOpenReactionEditor={handleOpenReactionEditor}
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
      />}

      <CanvasProjectControls
        readOnly={isViewOnly}
        sharedByLabel={
          isSharedAccess && displayProjectSharer
            ? getCanvasPanelMemberName(displayProjectSharer)
            : undefined
        }
        projectName={vsumName || (loadingProject ? 'Loading…' : 'Project')}
        projectId={activeProjectId}
        openProjectIds={openTabs.map(t => t.projectId)}
        editingName={editingName}
        nameInput={nameInput}
        savingName={savingName}
        onBack={() => navigate('/')}
        onRefresh={() => activeProjectId && loadVsum(activeProjectId, activeInstanceId ?? undefined)}
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
        onSave={handleCloseConfirmSave}
        onCloseWithoutSaving={handleCloseWithoutSaving}
        onCancel={handleCloseConfirmCancel}
      />

      <CanvasProjectAccessControls
        projectMembers={projectMembers}
        projectSharer={displayProjectSharer}
        canShare={canShare}
        isViewOnly={isViewOnly}
        isSharedAccess={isSharedAccess}
        membersLoading={membersLoading}
        currentUserEmail={user?.email}
        currentUserName={[user?.givenName, user?.familyName].filter(Boolean).join(' ') || user?.username}
        onRefreshMembers={refreshProjectMembers}
        onRemoveMember={canShare ? handleRemoveMember : undefined}
        onShareClick={() => setShowShareModal(true)}
      />

      {canShare && (
      <ShareProjectModal
        isOpen={showShareModal}
        vsumId={activeProjectId}
        projectName={vsumName}
        onClose={() => setShowShareModal(false)}
        onInvited={refreshProjectMembers}
      />
      )}
      </div>
      )}

      {projectLoadState.status !== 'ready' && (
        <CanvasProjectLoadStateOverlay
          state={projectLoadState}
          projectId={activeProjectId}
          onBack={() => navigate('/')}
          onRetry={handleRetryProjectLoad}
        />
      )}

      {/* Popup notification */}
      {popup && <CanvasPopupNotification message={popup.message} type={popup.type} />}
    </div>
  );
};
