import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AuthService } from '../services/auth';
import { getUserInitials } from '../utils/userInitials';
import { ShareProjectModal } from '../components/ui/ShareProjectModal';
import { HoverTooltip } from '../components/ui/HoverTooltip';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ProfileModal } from '../components/ui/ProfileModal';
import ReactDOM from 'react-dom';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Node, Edge } from 'reactflow';
import { CanvasMode, FlowCanvas } from '../components/flow/FlowCanvas';
import { ConstraintsView } from '../components/constraints/ConstraintsView';
import { FloatingUMLPanel } from '../components/canvas/FloatingUMLPanel';
import { UmlDiagramSaveContext } from '../components/canvas/UMLDiagram';
import { ModelDrawer, DrawerModel } from '../components/canvas/ModelDrawer';
import { apiService, VsumRole, VsumUserResponse } from '../services/api';
import { VsumDetails } from '../types';
import { VsumMetaModelRef } from '../types/vsum';
import { WorkspaceSnapshot, WorkspaceSnapshotRequest } from '../types/workspace';
import { MODAL_Z_INDEX, modalBackdropStyle, useModalBodyLock } from '../components/ui/modalUtils';
import { CanvasProjectTabs } from '../components/canvas/CanvasProjectTabs';
import { ProjectPickerMenu } from '../components/canvas/ProjectPickerMenu';
import { UnsavedTabCloseDialog } from '../components/canvas/UnsavedTabCloseDialog';
import { CanvasTabSession, CanvasUmlPanelState, EcoreFileExpandMeta, OpenCanvasTab } from '../types/canvasTab';
import { canvasUmlLayoutFileName, canvasUmlLayoutScope } from '../utils/metaModelPreview';
import { createCanvasTabInstanceId } from '../utils/canvasTabId';
import {
  findMembershipForEmail,
  findVsumOwner,
  memberDisplayName,
  parseVsumMembersResponse,
  pickMostRestrictiveRole,
  readStoredProjectAccess,
  clearStoredProjectAccess,
  resolveProjectAccessRole,
  resolveVsumAccessRole,
  fetchOwnerContactForVsum,
  mergeStoredProjectAccess,
  mergeSharerWithMembers,
  formatProjectMemberStackLabel,
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
import { USER_PROFILE_DESCRIPTION, USER_PROFILE_LABEL } from '../constants/accountLabels';

const MODE_TOGGLE_TOP = 14;
const MODE_TOGGLE_HEIGHT = 44;
const PROJECT_TABS_HEIGHT = 38;
const CENTER_STACK_BOTTOM = MODE_TOGGLE_TOP + MODE_TOGGLE_HEIGHT + 4 + PROJECT_TABS_HEIGHT;

type UMLPanel = CanvasUmlPanelState;

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

function metaModelToDrawerModel(m: VsumMetaModelRef, inProject: boolean): DrawerModel {
  return {
    id: m.id,
    name: m.name,
    sourceId: m.sourceId ?? m.id,
    domain: m.domain,
    ecoreFileId: m.ecoreFileId,
    genModelFileId: m.genModelFileId,
    inProject,
    description: m.description,
    keyword: m.keyword,
    createdAt: m.createdAt,
  };
}

async function fetchLibraryDrawerModels(): Promise<{ myModels: DrawerModel[]; publicModels: DrawerModel[] }> {
  const toDrawer = (m: VsumMetaModelRef) => metaModelToDrawerModel(m, false);
  const [myRes, pubRes] = await Promise.allSettled([
    apiService.findMetaModels({ ownedByUser: true }),
    apiService.findMetaModels({ ownedByUser: false }),
  ]);
  return {
    myModels: myRes.status === 'fulfilled' ? (myRes.value.data || []).map(toDrawer) : [],
    publicModels: pubRes.status === 'fulfilled' ? (pubRes.value.data || []).map(toDrawer) : [],
  };
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
  flowCanvasRef: React.RefObject<{ getNodes?: () => Node[] } | null>;
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

const fetchEcoreFileById = (fileId: number) => apiService.getFile(fileId);

type PopupNotificationType = 'success' | 'error' | 'info';

function getPopupNotificationStyles(type: PopupNotificationType) {
  if (type === 'success') {
    return { background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d' };
  }
  if (type === 'error') {
    return { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' };
  }
  return { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' };
}

const CanvasPopupNotification: React.FC<{ message: string; type: PopupNotificationType }> = ({
  message,
  type,
}) => {
  const popupStyles = getPopupNotificationStyles(type);
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, maxWidth: 480, width: 'max-content',
      background: popupStyles.background,
      border: popupStyles.border,
      color: popupStyles.color,
      borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 500,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    }}>
      {message}
    </div>
  );
};

function updatePanelEcoreContent(panels: UMLPanel[], panelId: string, content: string): UMLPanel[] {
  return panels.map(p => (p.id === panelId ? { ...p, ecoreContent: content } : p));
}

function createUmlPanelSavedHandler(
  panelId: string,
  fileName: string,
  onSaved: (panelId: string, fileName: string, result: { ecoreContent: string }) => void,
): (result: { ecoreContent: string }) => void {
  return result => onSaved(panelId, fileName, result);
}

interface CanvasUmlPanelLayerProps {
  panels: UMLPanel[];
  vsumName: string;
  activeProjectId?: number;
  topPanelId: string | null;
  panelZBase: number;
  viewOnly?: boolean;
  buildSaveContext: (panel: UMLPanel) => UmlDiagramSaveContext | undefined;
  onClose: (panelId: string) => void;
  onFocus: (panelId: string) => void;
  onHome: () => void;
  onEcoreContentUpdated: (panelId: string, content: string) => void;
}

const CanvasUmlPanelLayer: React.FC<CanvasUmlPanelLayerProps> = ({
  panels,
  vsumName,
  activeProjectId,
  topPanelId,
  panelZBase,
  viewOnly = false,
  buildSaveContext,
  onClose,
  onFocus,
  onHome,
  onEcoreContentUpdated,
}) => (
  <>
    {panels.map((panel, idx) => (
      <FloatingUMLPanel
        key={panel.id}
        id={panel.id}
        title={vsumName || panel.title}
        fileName={panel.layoutStorageKey ?? canvasUmlLayoutFileName(panel)}
        layoutScopeId={panel.layoutScopeId ?? canvasUmlLayoutScope(activeProjectId)}
        ecoreContent={panel.ecoreContent}
        saveContext={buildSaveContext(panel)}
        viewOnly={viewOnly}
        initialTop={panel.top}
        initialRight={panel.right}
        panelWidth={panel.width}
        panelHeight={panel.height}
        onClose={onClose}
        onFocus={onFocus}
        onHome={onHome}
        ecoreFileId={panel.ecoreFileId}
        fetchEcoreFile={fetchEcoreFileById}
        onEcoreContentUpdated={content => onEcoreContentUpdated(panel.id, content)}
        zIndex={panelZBase + (topPanelId === panel.id ? panels.length : idx)}
      />
    ))}
  </>
);

interface ModelDrawerModalProps {
  models: DrawerModel[];
  addedModelIds: Set<number>;
  loading: boolean;
  myLibraryModels: DrawerModel[];
  publicLibraryModels: DrawerModel[];
  onClose: () => void;
  onAddModel: (model: DrawerModel) => void;
  onDeleteModel?: (model: DrawerModel) => Promise<void>;
}

const ModelDrawerModal: React.FC<ModelDrawerModalProps> = ({
  models,
  addedModelIds,
  loading,
  myLibraryModels,
  publicLibraryModels,
  onClose,
  onAddModel,
  onDeleteModel,
}) => ReactDOM.createPortal(
  <>
    <button
      type="button"
      aria-hidden="true"
      tabIndex={-1}
      onClick={onClose}
      style={{ ...modalBackdropStyle, zIndex: MODAL_Z_INDEX }}
    />
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
        models={models}
        addedModelIds={addedModelIds}
        loading={loading}
        onClose={onClose}
        onAddModel={onAddModel}
        onDeleteModel={onDeleteModel}
        myLibraryModels={myLibraryModels}
        publicLibraryModels={publicLibraryModels}
        onFetchFile={fetchEcoreFileById}
      />
    </div>
  </>,
  document.body,
);

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

  // Canvas mode (Modeling / Constraints / Views)
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('modeling');
  const canvasModeRef = useRef<CanvasMode>('modeling');
  const [constraintsNodes, setConstraintsNodes] = useState<Node[]>([]);
  useEffect(() => {
    if (isViewOnly) setAddReactionMode(false);
  }, [isViewOnly]);

  const [constraintHighlightNodeId, setConstraintHighlightNodeId] = useState<string | null>(null);
  const [constraintFilterNodeId, setConstraintFilterNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (isViewOnly && canvasMode === 'constraints') {
      setCanvasMode('modeling');
      canvasModeRef.current = 'modeling';
    }
  }, [isViewOnly, canvasMode]);

  const handleCanvasModeChange = useCallback((mode: CanvasMode) => {
    if (mode === 'constraints' && isViewOnly) return;
    if (mode === 'constraints') {
      setConstraintsNodes(flowCanvasRef.current?.getNodes?.() ?? []);
    } else {
      setConstraintHighlightNodeId(null);
      setConstraintFilterNodeId(null);
    }
    canvasModeRef.current = mode;
    setCanvasMode(mode);
  }, [isViewOnly]);


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

  const clearCanvasWorkspace = useCallback(() => {
    flowCanvasRef.current?.loadDiagramData?.([], []);
    setDrawerModels([]);
    setMyLibraryModels([]);
    setPublicLibraryModels([]);
    setAddedModelIds(new Set());
    setUmlPanels([]);
    setTopPanelId(null);
    setShowDrawer(false);
    setEditingName(false);
  }, []);

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

    if (canvasModeRef.current === 'constraints') {
      setConstraintsNodes(session.nodes);
    }

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

  const loadVsum = useCallback(async (vsumId: number, forInstanceId?: string) => {
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
    } catch (e) {
      console.error('Failed to load VSUM:', e);
    } finally {
      if (!forInstanceId || activeInstanceIdRef.current === forInstanceId) {
        setLoadingProject(false);
      }
    }
  }, [clearCanvasWorkspace, setBaselineForInstance, updateTabName, applyProjectMembers, navAccess, navAccessRole, noteApiRole]);

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
  }, [activeInstanceId, clearCanvasWorkspace, loadVsum, bumpProjectRole]);

  // ── Rename VSUM ───────────────────────────────────────────────────────────

  const startRename = useCallback(() => {
    setNameInput(vsumName);
    setEditingName(true);
  }, [vsumName]);

  const confirmRename = useCallback(async () => {
    if (isViewOnly) return;
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
  }, [nameInput, activeProjectId, vsumName, updateTabName, isViewOnly]);

  const cancelRename = useCallback(() => setEditingName(false), []);

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
    setUmlPanels(prev => prev.filter(
      p => p.metaModelId !== model.id && p.metaModelSourceId !== sourceId && p.metaModelId !== sourceId,
    ));
  }, [isViewOnly]);

  const handleEcoreFileExpand = useCallback(async (
    fileName: string,
    fileContent: string,
    meta?: EcoreFileExpandMeta,
  ) => {
    const layout = computeUmlPanelLayout(openTabs.length);
    const resolved = enrichEcoreMetaFromCanvas(
      fileName,
      fileContent,
      meta,
      () => flowCanvasRef.current?.getNodes?.() ?? [],
    );

    const loadedContent = await loadEcoreFileContent(
      fileName,
      resolved.content,
      resolved.ecoreFileId,
      flowCanvasRef.current?.updateEcoreFileData,
    );
    if (loadedContent === null) {
      setPopup({ message: 'Could not load UML diagram for this meta-model.', type: 'error' });
      setTimeout(() => setPopup(null), 4000);
      return;
    }
    if (!loadedContent.trim()) {
      setPopup({ message: 'No UML content available for this meta-model.', type: 'error' });
      setTimeout(() => setPopup(null), 4000);
      return;
    }

    const newPanel: UMLPanel = {
      id: `panel-${Date.now()}`,
      title: fileName.replace(/\.ecore$/, ''),
      fileName,
      ecoreContent: loadedContent,
      metaModelId: resolved.metaModelId,
      metaModelSourceId: resolved.metaModelSourceId,
      ecoreFileId: resolved.ecoreFileId,
      layoutScopeId: canvasUmlLayoutScope(activeProjectId),
      layoutStorageKey: canvasUmlLayoutFileName({
        fileName,
        metaModelSourceId: resolved.metaModelSourceId,
        metaModelId: resolved.metaModelId,
      }),
      top: layout.top,
      right: 16,
      width: 200,
      height: layout.height,
    };
    setUmlPanels(prev => [...prev, newPanel]);
    setTopPanelId(newPanel.id);
  }, [openTabs.length, activeProjectId]);

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

  const closePanel = useCallback((panelId: string) => {
    setUmlPanels(prev => prev.filter(p => p.id !== panelId));
    setTopPanelId(prev => (prev === panelId ? null : prev));
  }, []);

  const handleUmlPanelSaved = useCallback((
    panelId: string,
    fileName: string,
    result: { ecoreContent: string },
  ) => {
    setUmlPanels(prev => updatePanelEcoreContent(prev, panelId, result.ecoreContent));
    // Workspace-only: update the canvas copy, not the library metamodel file on the server.
    flowCanvasRef.current?.updateEcoreFileData?.(fileName, result.ecoreContent);
  }, []);

  const handleUmlPanelEcoreContentUpdated = useCallback((panelId: string, content: string) => {
    setUmlPanels(prev => updatePanelEcoreContent(prev, panelId, content));
  }, []);

  const buildUmlSaveContext = useCallback((panel: UMLPanel): UmlDiagramSaveContext | undefined => {
    if (isViewOnly || !panel.ecoreFileId) return undefined;
    const libraryMetaModelId = panel.metaModelSourceId ?? panel.metaModelId;
    return {
      metaModelId: libraryMetaModelId ? String(libraryMetaModelId) : '',
      ecoreFileId: panel.ecoreFileId,
      modelName: panel.title,
      saveTarget: 'workspace',
      onSaved: createUmlPanelSavedHandler(panel.id, panel.fileName, handleUmlPanelSaved),
    };
  }, [handleUmlPanelSaved, isViewOnly]);

  const focusPanel = useCallback((panelId: string) => setTopPanelId(panelId), []);
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

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>

      <FlowCanvas
        key={activeInstanceId ?? `canvas-${activeProjectId ?? 'new'}`}
        ref={flowCanvasRef}
        vsumId={activeProjectId?.toString()}
        readOnly={isViewOnly}
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
        />
      )}

      {/* Constraints overlay — always mounted to preserve state (edits, deletions).
          Visibility toggled via display so the FlowCanvas mode-toggle remains
          clickable through the transparent center gap when hidden. */}
      <div style={{
        position: 'absolute', top: 72, left: 0, right: 0, bottom: 0,
        display: canvasMode === 'constraints' && !isViewOnly ? 'flex' : 'none',
        zIndex: 100, pointerEvents: 'none',
      }}>
        <ConstraintsView key={activeProjectId ?? 'default'} vsumId={activeProjectId?.toString()} canvasNodes={constraintsNodes} onHighlightNode={setConstraintHighlightNodeId} filterNodeId={constraintFilterNodeId} />
      </div>

      {/* Left sidebar toolbar */}
      {canvasMode !== 'constraints' && <LeftSidebar
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

      <LeftPill
        readOnly={isViewOnly}
        sharedByLabel={
          isSharedAccess && displayProjectSharer
            ? panelMemberName(displayProjectSharer)
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

      <RightPill
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

      {/* Popup notification */}
      {popup && <CanvasPopupNotification message={popup.message} type={popup.type} />}
    </div>
  );
};

// ── LeftPill ──────────────────────────────────────────────────────────────────

interface LeftPillProps {
  readOnly?: boolean;
  sharedByLabel?: string;
  projectName: string;
  projectId?: number;
  openProjectIds: number[];
  editingName: boolean;
  nameInput: string;
  savingName: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onSelectProject: (projectId: number, name: string, accessRole?: string) => void;
  onStartRename: () => void;
  onNameInputChange: (v: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  loading: boolean;
}

const LeftPill: React.FC<LeftPillProps> = ({
  readOnly = false,
  sharedByLabel,
  projectName, projectId, openProjectIds, editingName, nameInput, savingName,
  onBack, onRefresh, onSelectProject, onStartRename, onNameInputChange, onConfirmRename, onCancelRename, loading,
}) => (
  <div style={pillStyle('left')}>
    {/* Logo — click to go back */}
    <button
      type="button"
      onClick={onBack}
      title="Back to overview"
      aria-label="Back to overview"
      style={{
        padding: 0,
        border: 'none',
        background: 'transparent',
        width: 24,
        height: 24,
        borderRadius: 6,
        flexShrink: 0,
        margin: '0 4px',
        cursor: 'pointer',
        transition: 'opacity 0.15s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.75'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
    >
      <img
        src="/assets/vitruvius1.png"
        alt=""
        aria-hidden="true"
        style={{ width: 24, height: 24, borderRadius: 6, display: 'block' }}
      />
    </button>

    <Divider />

    {editingName ? (
      <>
        <input
          autoFocus
          value={nameInput}
          onChange={e => onNameInputChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              onConfirmRename();
            } else if (e.key === 'Escape') {
              onCancelRename();
            }
          }}
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
          onSelectProject={p => onSelectProject(p.id, p.name, p.role)}
        />
        {!readOnly && (
          <PillBtn onClick={onStartRename} title="Edit project name">
            <PencilIcon />
          </PillBtn>
        )}
        {readOnly && (
          <span
            title={sharedByLabel
              ? `View-only access — shared by ${sharedByLabel}`
              : 'You have view-only access to this project'}
            style={{
              marginLeft: 4,
              padding: '2px 8px',
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 700,
              background: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              whiteSpace: 'nowrap',
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {sharedByLabel ? `Shared by ${sharedByLabel}` : 'View only'}
          </span>
        )}
      </>
    )}

    <Divider />

    <PillBtn onClick={onRefresh} title={readOnly ? 'Reload latest changes from owner' : 'Reload'} spinning={loading && !editingName}>
      <RefreshIcon />
    </PillBtn>
  </div>
);

// ── Avatar helpers ────────────────────────────────────────────────────────────

interface Collaborator { id: string; initials: string; name: string; color: string; ringColor?: string; }

const MEMBER_AVATAR_COLORS = [
  'linear-gradient(135deg, #049484, #06b89e)',
  'linear-gradient(135deg, #3b82f6, #60a5fa)',
  'linear-gradient(135deg, #8b5cf6, #a78bfa)',
  'linear-gradient(135deg, #f59e0b, #fbbf24)',
  'linear-gradient(135deg, #ec4899, #f472b6)',
];

function buildPanelMembers(
  projectMembers: VsumUserResponse[],
  projectSharer: VsumUserResponse | null,
  isSharedAccess: boolean,
  currentUserEmail?: string,
  currentUserName?: string,
): VsumUserResponse[] {
  const unique = uniqueVsumMembers(projectMembers);
  if (!isSharedAccess) return unique;

  const entries: VsumUserResponse[] = [];
  if (projectSharer) entries.push(projectSharer);

  const selfInList = findMembershipForEmail(unique, currentUserEmail);
  if (selfInList && !entries.some(e => e.id === selfInList.id)) {
    entries.push(selfInList);
  } else if (currentUserEmail && !entries.some(e =>
    e.email?.toLowerCase() === currentUserEmail.toLowerCase(),
  )) {
    const nameParts = (currentUserName ?? '').trim().split(/\s+/);
    entries.push({
      id: -2,
      vsumId: projectSharer?.vsumId ?? 0,
      firstName: nameParts[0] ?? '',
      lastName: nameParts.slice(1).join(' '),
      email: currentUserEmail,
      role: 'VIEWER',
      createdAt: '',
    });
  }

  unique.forEach(m => {
    if (!entries.some(e => e.id === m.id)) entries.push(m);
  });

  return entries;
}

function membersToCollaborators(members: VsumUserResponse[]): Collaborator[] {
  return uniqueVsumMembers(members).map((member, index) => {
    const name = memberDisplayName(member);
    return {
      id: String(member.id),
      initials: getUserInitials(name, member.email),
      name,
      color: MEMBER_AVATAR_COLORS[index % MEMBER_AVATAR_COLORS.length],
    };
  });
}

type PanelMemberRole = 'Owner' | 'Member' | 'Viewer';

function panelMemberName(m: VsumUserResponse): string {
  const full = memberDisplayName(m);
  if (full !== 'Member') return full;
  if (m.status === 'PENDING' || m.pending) return 'Pending invite';
  return m.email || 'Member';
}

function panelMemberRole(m: VsumUserResponse): PanelMemberRole {
  const r = (m.role ?? '').toUpperCase();
  if (r === 'OWNER') return 'Owner';
  if (r === 'VIEWER') return 'Viewer';
  return 'Member';
}

function panelRoleChipStyle(role: PanelMemberRole): React.CSSProperties {
  if (role === 'Owner') return { background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' };
  if (role === 'Viewer') return { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' };
  return { background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' };
}

function isPanelMemberPending(m: VsumUserResponse): boolean {
  return m.status === 'PENDING' || m.pending === true;
}

function formatPeopleCount(count: number): string {
  if (count === 1) return '1 person';
  return `${count} people`;
}

function resolveCollaboratorStackTitle(
  isSharedAccess: boolean,
  projectSharer: VsumUserResponse | null,
): string {
  if (isSharedAccess && projectSharer) {
    return `Shared by ${panelMemberName(projectSharer)}`;
  }
  return 'People with access';
}

function resolveStackAvatars(
  isSharedAccess: boolean,
  projectSharer: VsumUserResponse | null,
  collaborators: Collaborator[],
  myAccount: Collaborator,
): Collaborator[] {
  if (isSharedAccess && projectSharer) {
    return membersToCollaborators([projectSharer]).slice(0, 3);
  }
  if (collaborators.length > 0) {
    return collaborators.slice(0, 3);
  }
  return [myAccount];
}

function resolveSharedAccessSubtitle(membersLoading: boolean): string {
  if (membersLoading) return 'Loading owner details…';
  return 'Shared with you by the project owner';
}

function resolveMembersPanelSubtitle(options: {
  isSharedAccess: boolean;
  projectSharer: VsumUserResponse | null;
  membersLoading: boolean;
  isViewOnly: boolean;
  memberCount: number;
}): string {
  const { isSharedAccess, projectSharer, membersLoading, isViewOnly, memberCount } = options;
  if (isSharedAccess && projectSharer) {
    return `Shared by ${panelMemberName(projectSharer)}`;
  }
  if (isSharedAccess) {
    return resolveSharedAccessSubtitle(membersLoading);
  }
  if (isViewOnly) {
    return 'You have view-only access to this project';
  }
  if (memberCount === 1) {
    return 'You are the only person on this project. Invite viewers to share it.';
  }
  if (memberCount > 0) {
    return `${formatPeopleCount(memberCount)} can access this project`;
  }
  return 'No members loaded yet';
}

function computeUmlPanelLayout(openTabCount: number): { top: number; height: number } {
  const top = openTabCount > 0 ? CENTER_STACK_BOTTOM + 8 : MODE_TOGGLE_TOP + MODE_TOGGLE_HEIGHT + 8;
  const bottomUsed = 228;
  return {
    top,
    height: Math.max(200, document.documentElement.clientHeight - top - bottomUsed),
  };
}

function numberFromNodeData(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

interface ResolvedEcoreMeta {
  metaModelId?: number;
  metaModelSourceId?: number;
  ecoreFileId?: number;
  content: string;
}

function enrichEcoreMetaFromCanvas(
  fileName: string,
  fileContent: string,
  meta: EcoreFileExpandMeta | undefined,
  getNodes: () => Node[],
): ResolvedEcoreMeta {
  let metaModelId = meta?.metaModelId;
  let metaModelSourceId = meta?.metaModelSourceId;
  let ecoreFileId = meta?.ecoreFileId;
  let content = fileContent;

  if (ecoreFileId != null && metaModelId != null) {
    return { metaModelId, metaModelSourceId, ecoreFileId, content };
  }

  const node = getNodes().find(
    (n: Node) => n.type === 'ecoreFile' && n.data.fileName === fileName,
  );
  if (!node?.data) {
    return { metaModelId, metaModelSourceId, ecoreFileId, content };
  }

  metaModelId = metaModelId ?? numberFromNodeData(node.data.metaModelId);
  metaModelSourceId = metaModelSourceId ?? numberFromNodeData(node.data.metaModelSourceId);
  ecoreFileId = ecoreFileId ?? numberFromNodeData(node.data.ecoreFileId);
  if (!content?.trim() && typeof node.data.fileContent === 'string') {
    content = node.data.fileContent;
  }
  return { metaModelId, metaModelSourceId, ecoreFileId, content };
}

async function loadEcoreFileContent(
  fileName: string,
  content: string,
  ecoreFileId: number | undefined,
  updateEcoreFileData?: (fileName: string, content: string, ecoreFileId: number) => void,
): Promise<string | null> {
  if (content?.trim()) return content;
  if (ecoreFileId == null) return content;

  try {
    const loaded = await apiService.getFile(ecoreFileId);
    updateEcoreFileData?.(fileName, loaded, ecoreFileId);
    return loaded;
  } catch {
    return null;
  }
}

interface AvatarProps {
  initials: string;
  bg: string;
  size?: number;
  ring?: string;
  title?: string;
}

interface AvatarButtonProps extends AvatarProps {
  onClick: () => void;
  title: string;
}

function getAvatarStyle(bg: string, size: number, ring?: string): React.CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: '50%',
    background: bg,
    color: '#fff',
    fontSize: Math.round(size * 0.36),
    fontWeight: 700,
    letterSpacing: '0.01em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    userSelect: 'none',
    boxShadow: ring
      ? `0 0 0 2px #fff, 0 0 0 4.5px ${ring}`
      : '0 0 0 2px #fff',
  };
}

const UserAvatar: React.FC<AvatarProps> = ({ initials, bg, size = 30, ring, title }) => (
  <div title={title} style={{ ...getAvatarStyle(bg, size, ring), cursor: 'default' }}>
    {initials}
  </div>
);

const UserAvatarButton: React.FC<AvatarButtonProps> = ({
  initials,
  bg,
  size = 30,
  ring,
  title,
  onClick,
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    style={{
      ...getAvatarStyle(bg, size, ring),
      border: 'none',
      padding: 0,
      cursor: 'pointer',
    }}
  >
    {initials}
  </button>
);

interface CollaboratorStackButtonProps {
  members: Array<{ id: string; initials: string; color: string; ringColor?: string }>;
  stackLabel: string;
  open: boolean;
  onClick: () => void;
  title?: string;
}

const CollaboratorStackButton: React.FC<CollaboratorStackButtonProps> = ({
  members,
  stackLabel,
  open,
  onClick,
  title = 'People with access',
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    aria-expanded={open}
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      cursor: 'pointer',
      padding: '4px 10px 4px 6px',
      border: 'none',
      borderRadius: 8,
      background: open ? '#f1f5f9' : 'transparent',
      transition: 'background 0.15s',
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center' }}>
      {members.map((member, index) => (
        <span
          key={member.id}
          style={{ marginLeft: index === 0 ? 0 : -7, zIndex: members.length - index, display: 'inline-flex' }}
        >
          <UserAvatar
            initials={member.initials}
            bg={member.color}
            size={24}
            ring={member.ringColor}
          />
        </span>
      ))}
    </span>
    <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
      {stackLabel}
    </span>
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#64748b"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </button>
);

// ── RightPill ─────────────────────────────────────────────────────────────────

interface PeoplePanelMemberRowProps {
  member: VsumUserResponse;
  index: number;
  projectSharer: VsumUserResponse | null;
  isSharedAccess: boolean;
  isViewOnly: boolean;
  canShare: boolean;
  currentUserEmail?: string;
  removingMemberId: number | null;
  onRemoveMember?: (vsumUserId: number) => void | Promise<void>;
  onRequestRemove: (member: VsumUserResponse) => void;
}

const PeoplePanelMemberRow: React.FC<PeoplePanelMemberRowProps> = ({
  member,
  index,
  projectSharer,
  isSharedAccess,
  isViewOnly,
  canShare,
  currentUserEmail,
  removingMemberId,
  onRemoveMember,
  onRequestRemove,
}) => {
  const name = panelMemberName(member);
  const role = panelMemberRole(member);
  const pending = isPanelMemberPending(member);
  const isSelf = currentUserEmail
    ? member.email?.toLowerCase() === currentUserEmail.toLowerCase()
    : false;
  const isSharer = projectSharer?.id === member.id
    || projectSharer?.email?.toLowerCase() === member.email?.toLowerCase();
  const color = MEMBER_AVATAR_COLORS[index % MEMBER_AVATAR_COLORS.length];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 8px',
        borderRadius: 8,
        background: isSharer && isSharedAccess ? '#f8fafc' : 'transparent',
      }}
    >
      <UserAvatar
        initials={getUserInitials(name, member.email)}
        bg={color}
        size={36}
        title={name}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          title={name}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#0f172a',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {isSelf ? `${name} (you)` : name}
        </div>
        <div
          title={member.email}
          style={{
            fontSize: 11,
            color: '#64748b',
            marginTop: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {isSharer && isSharedAccess ? 'Project owner' : member.email}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 20,
          fontSize: 10,
          fontWeight: 700,
          ...panelRoleChipStyle(role),
        }}>
          {isSelf && isViewOnly ? 'Viewer' : role}
        </span>
        {pending && (
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#c2410c',
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: 20,
            padding: '1px 7px',
          }}>
            Pending
          </span>
        )}
        {canShare && onRemoveMember && role !== 'Owner' && !isSelf && (
          <button
            type="button"
            disabled={removingMemberId === member.id}
            onClick={() => onRequestRemove(member)}
            style={{
              padding: '2px 8px',
              borderRadius: 6,
              border: '1px solid #fecaca',
              background: '#fff5f5',
              color: '#dc2626',
              fontSize: 10,
              fontWeight: 700,
              cursor: removingMemberId === member.id ? 'wait' : 'pointer',
              opacity: removingMemberId === member.id ? 0.6 : 1,
            }}
          >
            {removingMemberId === member.id ? 'Removing…' : 'Remove access'}
          </button>
        )}
      </div>
    </div>
  );
};

interface PeopleAccessPanelProps {
  isSharedAccess: boolean;
  isViewOnly: boolean;
  canShare: boolean;
  membersLoading: boolean;
  memberCount: number;
  panelMembers: VsumUserResponse[];
  projectSharer: VsumUserResponse | null;
  currentUserEmail?: string;
  removingMemberId: number | null;
  onRemoveMember?: (vsumUserId: number) => void | Promise<void>;
  onRefreshMembers: () => void;
  onRequestRemove: (member: VsumUserResponse) => void;
  onShareClick: () => void;
  onClose: () => void;
}

const PeopleAccessPanel: React.FC<PeopleAccessPanelProps> = ({
  isSharedAccess,
  isViewOnly,
  canShare,
  membersLoading,
  memberCount,
  panelMembers,
  projectSharer,
  currentUserEmail,
  removingMemberId,
  onRemoveMember,
  onRefreshMembers,
  onRequestRemove,
  onShareClick,
  onClose,
}) => (
  <div style={{
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: 340,
    maxWidth: '92vw',
    background: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 12px 40px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    zIndex: 500,
  }}>
    <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
        {isSharedAccess ? 'Shared with you' : 'People with access'}
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 1.4 }}>
        {resolveMembersPanelSubtitle({
          isSharedAccess,
          projectSharer,
          membersLoading,
          isViewOnly,
          memberCount,
        })}
      </div>
    </div>

    {canShare && memberCount === 1 && !isSharedAccess && !membersLoading && (
      <div style={{
        padding: '10px 14px',
        background: '#f0fdfa',
        borderBottom: '1px solid #ccfbf1',
        fontSize: 12,
        color: '#047857',
        lineHeight: 1.45,
      }}>
        You are working alone. Share this project to invite viewers by email.
      </div>
    )}

    <div style={{
      padding: '6px 8px',
      maxHeight: 280,
      overflowY: 'auto',
      scrollbarWidth: 'thin',
    }}>
      {membersLoading && panelMembers.length === 0 && (
        <div style={{ padding: '12px 8px', fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>
          Loading…
        </div>
      )}
      {!membersLoading && panelMembers.map((member, index) => (
        <PeoplePanelMemberRow
          key={`${member.id}-${member.email}`}
          member={member}
          index={index}
          projectSharer={projectSharer}
          isSharedAccess={isSharedAccess}
          isViewOnly={isViewOnly}
          canShare={canShare}
          currentUserEmail={currentUserEmail}
          removingMemberId={removingMemberId}
          onRemoveMember={onRemoveMember}
          onRequestRemove={onRequestRemove}
        />
      ))}
      {!membersLoading && panelMembers.length === 0 && (
        <div style={{ padding: '12px 8px', display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            {isSharedAccess
              ? 'Member list is not available for viewers. You can still view this project.'
              : 'Could not load project members.'}
          </div>
          <button
            type="button"
            onClick={onRefreshMembers}
            style={{
              justifySelf: 'start',
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: '#fff',
              color: '#334155',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>

    {canShare && (
      <div style={{ padding: '10px 12px 12px', borderTop: '1px solid #f1f5f9' }}>
        <button
          type="button"
          onClick={() => { onClose(); onShareClick(); }}
          style={{
            width: '100%',
            padding: '9px 12px',
            border: 'none',
            borderRadius: 8,
            background: '#049484',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <ShareIcon />
          Invite viewer
        </button>
      </div>
    )}
  </div>
);

interface RightPillProps {
  projectMembers: VsumUserResponse[];
  projectSharer: VsumUserResponse | null;
  canShare: boolean;
  isViewOnly?: boolean;
  isSharedAccess?: boolean;
  membersLoading?: boolean;
  currentUserEmail?: string;
  currentUserName?: string;
  onRefreshMembers: () => void;
  onRemoveMember?: (vsumUserId: number) => void | Promise<void>;
  onShareClick: () => void;
}

const RightPill: React.FC<RightPillProps> = ({
  projectMembers,
  projectSharer,
  canShare,
  isViewOnly = false,
  isSharedAccess = false,
  membersLoading = false,
  currentUserEmail,
  currentUserName,
  onRefreshMembers,
  onRemoveMember,
  onShareClick,
}) => {
  const [showAccounts, setShowAccounts] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [removeConfirmMember, setRemoveConfirmMember] = useState<VsumUserResponse | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { user, refreshCurrentUser } = useAuth();


  // Derive display values from real user
  const displayName = user
    ? [user.givenName, user.familyName].filter(Boolean).join(' ') || user.username
    : 'Me';
  const initials = getUserInitials(displayName, user?.email);

  const myAccount = {
    id: 'me',
    initials,
    name: displayName,
    color: 'linear-gradient(135deg, #049484, #06b89e)',
    ringColor: '#049484',
  };

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

  // Project members for the people panel
  const panelMembers = buildPanelMembers(
    projectMembers,
    projectSharer,
    isSharedAccess,
    currentUserEmail,
    currentUserName,
  );
  const collaborators = membersToCollaborators(
    mergeSharerWithMembers(projectSharer, projectMembers),
  );
  const memberCount = panelMembers.length;
  const stackAvatars = resolveStackAvatars(isSharedAccess, projectSharer, collaborators, myAccount);
  const stackTitle = resolveCollaboratorStackTitle(isSharedAccess, projectSharer);
  const stackLabel = formatProjectMemberStackLabel(memberCount, {
    isSharedAccess,
    isSoloOwner: canShare && memberCount === 1,
  });

  const toggleMembersPanel = useCallback(() => {
    setShowAccounts(current => {
      const next = !current;
      if (next) onRefreshMembers();
      return next;
    });
    setShowProfileMenu(false);
  }, [onRefreshMembers]);

  const toggleProfileMenu = useCallback(() => {
    setShowProfileMenu(current => !current);
    setShowAccounts(false);
  }, []);

  return (
    <div ref={wrapRef} style={{ ...pillStyle('right'), padding: '0 10px', gap: 0, position: 'absolute' }}>

      {/* ── People with access ── */}
      <CollaboratorStackButton
        members={stackAvatars.map(member => ({
          id: member.id,
          initials: member.initials,
          color: member.color,
          ringColor: 'ringColor' in member ? (member as typeof myAccount).ringColor : undefined,
        }))}
        stackLabel={stackLabel}
        open={showAccounts}
        onClick={toggleMembersPanel}
        title={stackTitle}
      />

      <Divider />

      {/* ── My account avatar — click for profile menu ── */}
      <div style={{ position: 'relative', padding: '0 4px' }}>
        <UserAvatarButton
          initials={myAccount.initials}
          bg={myAccount.color}
          size={28}
          ring={myAccount.ringColor}
          title="My account"
          onClick={toggleProfileMenu}
        />

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
              <UserAvatar initials={myAccount.initials} bg={myAccount.color} size={36} ring={myAccount.ringColor} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                  {myAccount.name}
                </div>
                <div style={{ fontSize: 11, color: '#049484', fontWeight: 600, marginTop: 1 }}>Methodologist</div>
              </div>
            </div>

            {/* Menu items */}
            <ProfileMenuItem
              label={USER_PROFILE_LABEL}
              sublabel={USER_PROFILE_DESCRIPTION}
              icon={<UserProfileIcon />}
              onClick={() => { setShowProfileMenu(false); setShowProfileModal(true); }}
            />
            <ProfileMenuItem
              label="Log out"
              icon={<LogoutIcon />}
              danger
              onClick={() => { setShowProfileMenu(false); AuthService.signOut().then(() => { globalThis.location.href = '/login'; }); }}
            />
          </div>
        )}
      </div>

      <Divider />

      {canShare && <ShareBtn onClick={onShareClick} />}

      {/* ── People panel ── */}
      {showAccounts && (
        <PeopleAccessPanel
          isSharedAccess={isSharedAccess}
          isViewOnly={isViewOnly}
          canShare={canShare}
          membersLoading={membersLoading}
          memberCount={memberCount}
          panelMembers={panelMembers}
          projectSharer={projectSharer}
          currentUserEmail={currentUserEmail}
          removingMemberId={removingMemberId}
          onRemoveMember={onRemoveMember}
          onRefreshMembers={onRefreshMembers}
          onRequestRemove={setRemoveConfirmMember}
          onShareClick={onShareClick}
          onClose={() => setShowAccounts(false)}
        />
      )}

      {showProfileModal && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfileModal(false)}
          onNameSaved={refreshCurrentUser}
        />
      )}

      <ConfirmDialog
        isOpen={removeConfirmMember !== null}
        title="Remove access"
        message={removeConfirmMember
          ? `Remove access for ${panelMemberName(removeConfirmMember)}? They will no longer be able to open this project.`
          : 'Remove this person\'s access to the project?'}
        confirmText="Remove access"
        cancelText="Cancel"
        variant="danger"
        onConfirm={async () => {
          if (!removeConfirmMember || !onRemoveMember) return;
          const id = removeConfirmMember.id;
          setRemoveConfirmMember(null);
          setRemovingMemberId(id);
          try {
            await onRemoveMember(id);
          } finally {
            setRemovingMemberId(null);
          }
        }}
        onCancel={() => setRemoveConfirmMember(null)}
      />
    </div>
  );
};

function getProfileMenuItemBackground(hovered: boolean, danger?: boolean): string {
  if (!hovered) return 'transparent';
  if (danger) return '#fef2f2';
  return '#f8fafc';
}

const ProfileMenuItem: React.FC<{ label: string; sublabel?: string; icon: React.ReactNode; danger?: boolean; onClick?: () => void }> = ({ label, sublabel, icon, danger, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '8px 10px', border: 'none', borderRadius: 6,
        background: getProfileMenuItemBackground(hov, danger),
        color: danger ? '#dc2626' : '#0f172a',
        fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ display: 'flex', flexShrink: 0, color: danger ? 'inherit' : '#475569' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div>{label}</div>
        {sublabel && (
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 400, marginTop: 1 }}>{sublabel}</div>
        )}
      </div>
    </button>
  );
};

// ── ShareBtn ──────────────────────────────────────────────────────────────────

const ShareBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      title="Share project — invite viewers by email"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 30, padding: '0 12px', border: 'none', borderRadius: 6,
        background: hov ? '#038472' : '#049484',
        color: '#ffffff', fontSize: 12, fontWeight: 700,
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
  readOnly?: boolean;
  addReactionMode: boolean;
  onToggleReactionMode: () => void;
  onOpenReactionEditor?: () => void;
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
  readOnly = false,
  addReactionMode, onToggleReactionMode, onOpenReactionEditor, onToggleModelDrawer,
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
        <SidebarBtn
          label="Select"
          description="Move and select elements on the canvas"
          active={!addReactionMode}
          onClick={() => { if (addReactionMode) onToggleReactionMode(); }}
        >
          <PointerIcon />
        </SidebarBtn>

        <SidebarDivider />

        {/* Download ZIP */}
        <SidebarBtn
          label="Download"
          description="Export this project as a ZIP file"
          onClick={onDownloadArtifact}
          loading={downloadingArtifact}
          disabled={busy}
        >
          <DownloadIcon />
        </SidebarBtn>

        {/* Save Changes */}
        {!readOnly && (
          <SidebarBtn
            label="Save"
            description="Save changes to this project"
            onClick={onSaveChanges}
            loading={savingChanges}
            disabled={busy}
          >
            <SaveIcon />
          </SidebarBtn>
        )}

        {/* Check Build */}
        {!readOnly && (
          <SidebarBtn
            label="Check build"
            description="Verify the project compiles successfully"
            onClick={onCheckBuild}
            loading={checkingBuild}
            disabled={busy}
            color="#049484"
          >
            <CheckBuildIcon />
          </SidebarBtn>
        )}

        {!readOnly && <SidebarDivider />}

        {readOnly ? (
          <SidebarBtn
            label="View reaction"
            description="Select a connection line, then click to open the code"
            onClick={() => onOpenReactionEditor?.()}
          >
            <ReactionIcon />
          </SidebarBtn>
        ) : (
          <>
            {/* Add Reaction */}
            <SidebarBtn
              label={addReactionMode ? 'Cancel reaction' : 'Add reaction'}
              description={addReactionMode
                ? 'Click to exit connection mode'
                : 'Click two meta-models to connect them'}
              active={addReactionMode}
              onClick={onToggleReactionMode}
            >
              <ReactionIcon />
            </SidebarBtn>

            {/* Add Meta-models */}
            <SidebarBtn
              label="Add meta-models"
              description="Open the model library drawer"
              onClick={onToggleModelDrawer}
              filled
            >
              <PlusBoxIcon />
            </SidebarBtn>
          </>
        )}
      </div>

      {/* ── Undo / Redo — own card, just below the main one ── */}
      {!readOnly && (
      <div style={{ ...sidebarCard, position: 'relative', left: 'auto', top: 'auto', zIndex: 'auto' as any }}>
        <SidebarBtn
          label="Undo"
          description={canUndo ? 'Undo the last action' : 'Nothing to undo'}
          onClick={onUndo}
          disabled={!canUndo}
        >
          <UndoIcon />
        </SidebarBtn>
        <SidebarBtn
          label="Redo"
          description={canRedo ? 'Redo the last undone action' : 'Nothing to redo'}
          onClick={onRedo}
          disabled={!canRedo}
        >
          <RedoIcon />
        </SidebarBtn>
      </div>
      )}
    </div>
  );
};

interface SidebarBtnProps {
  label: string;
  description?: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  filled?: boolean;
  disabled?: boolean;
  loading?: boolean;
  color?: string;
}

function getSidebarBtnBackground(
  isFilled: boolean,
  activeColor: string,
  hovered: boolean,
  disabled?: boolean,
): string {
  if (isFilled) return activeColor;
  if (hovered && !disabled) return '#f1f5f9';
  return 'transparent';
}

function getSidebarBtnIconColor(disabled: boolean | undefined, isFilled: boolean, hovered: boolean): string {
  if (disabled) return '#c8d3dd';
  if (isFilled) return '#ffffff';
  if (hovered) return '#1e293b';
  return '#475569';
}

const SidebarBtn: React.FC<SidebarBtnProps> = ({
  label,
  description,
  onClick,
  children,
  active,
  filled,
  disabled,
  loading,
  color,
}) => {
  const [hov, setHov] = useState(false);
  const activeColor = color || '#049484';
  const isFilled = Boolean(filled || active);
  const bg = getSidebarBtnBackground(isFilled, activeColor, hov, disabled);
  const iconColor = getSidebarBtnIconColor(disabled, isFilled, hov);
  const ariaLabel = description ? `${label}. ${description}` : label;

  return (
    <HoverTooltip label={label} description={description}>
      <button
        type="button"
        aria-label={ariaLabel}
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
    </HoverTooltip>
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
  height: 44,
  padding: '0 6px',
  gap: 2,
});

const Divider = () => (
  <div style={{ width: 1, height: 22, background: '#e2e8f0', margin: '0 5px', flexShrink: 0 }} />
);

interface PillBtnProps {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
  spinning?: boolean;
}

function getPillBtnBackground(active: boolean | undefined, hovered: boolean): string {
  if (active) return '#049484';
  if (hovered) return '#f1f5f9';
  return 'transparent';
}

function getPillBtnColor(active: boolean | undefined, hovered: boolean): string {
  if (active) return '#ffffff';
  if (hovered) return '#1e293b';
  return '#475569';
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
        position: 'relative', width: 34, height: 34, border: 'none', borderRadius: 6,
        background: getPillBtnBackground(active, hov),
        color: getPillBtnColor(active, hov),
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
const UserProfileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
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

