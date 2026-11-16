import { useCallback, useEffect, useRef, useState } from 'react';
import type { MetaModelRelationRequest } from '../services/api';
import { apiService } from '../services/api';
import type { VsumView } from '../types/vsum';
import { buildNeoJoinSkeleton, createNeoJoinFile } from '../utils/neoJoinFile';
import { syncVsumWorkspaceChanges } from '../utils/vsumSyncSave';
import {
  defaultViewAngle,
  legacyViewsToCreate,
  readLegacyViewTypes,
  readViewTypeAngles,
  toViewRequests,
  viewTypesFromRemote,
  writeLegacyViewTypes,
  writeViewTypeAngles,
  type ViewType,
  type ViewTypeMetamodelRef,
  type ViewTypeScope,
} from '../utils/viewTypeSync';

export type { ViewType, ViewTypeScope };

export interface ViewSyncBase {
  metaModelIds: number[];
  metaModelRelationRequests: MetaModelRelationRequest[] | null;
}

export interface AddViewTypeInput {
  label: string;
  scope: ViewTypeScope;
  angle: number;
  linkedNodeIds: string[];
  editable: boolean;
  metamodels: ViewTypeMetamodelRef[];
}

const emptySyncBase = (): ViewSyncBase => ({ metaModelIds: [], metaModelRelationRequests: null });

function generateId() {
  return `vt-${crypto.randomUUID()}`;
}

function updateAngleUpdater(id: string, angle: number) {
  return (prev: ViewType[]): ViewType[] => prev.map(vt => vt.id === id ? { ...vt, angle } : vt);
}

function unlinkNodeUpdater(viewTypeId: string, nodeId: string) {
  return (prev: ViewType[]): ViewType[] => prev.map(vt =>
    vt.id === viewTypeId
      ? { ...vt, linkedNodeIds: vt.linkedNodeIds.filter(n => n !== nodeId) }
      : vt
  );
}

function updateQueryUpdater(id: string, query: string, fileId?: number | null) {
  return (prev: ViewType[]): ViewType[] => prev.map(vt => {
    if (vt.id !== id) return vt;
    return typeof fileId === 'number' ? { ...vt, query, fileId } : { ...vt, query };
  });
}

/** Reads view types left in localStorage by older builds. Metrics still falls back to this. */
export function readStoredViewTypes(vsumId: string): ViewType[] {
  return readLegacyViewTypes(vsumId);
}

function rememberAngles(vsumId: string, viewTypes: ViewType[]): void {
  writeViewTypeAngles(vsumId, viewTypes);
}

export function useViewTypes(
  vsumId: string | undefined,
  getSyncBase: () => ViewSyncBase = emptySyncBase,
) {
  const [viewTypes, setViewTypes] = useState<ViewType[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const viewTypesRef = useRef<ViewType[]>([]);
  viewTypesRef.current = viewTypes;
  const getSyncBaseRef = useRef(getSyncBase);
  getSyncBaseRef.current = getSyncBase;
  const migrationInFlight = useRef(false);

  const applyRemote = useCallback((views: VsumView[], previous: ViewType[]) => {
    if (!vsumId) return [] as ViewType[];
    const next = viewTypesFromRemote(views, readViewTypeAngles(vsumId), previous);
    rememberAngles(vsumId, next);
    return next;
  }, [vsumId]);

  const reloadFromDetails = useCallback(async (previous: ViewType[]) => {
    if (!vsumId) return previous;
    const response = await apiService.getVsumDetails(vsumId);
    if (!Array.isArray(response.data.views)) return previous;
    const next = applyRemote(response.data.views, previous);
    setViewTypes(next);
    return next;
  }, [applyRemote, vsumId]);

  const syncViewList = useCallback(async (next: ViewType[]) => {
    if (!vsumId) return;
    const base = getSyncBaseRef.current();
    await syncVsumWorkspaceChanges(Number(vsumId), {
      metaModelIds: base.metaModelIds,
      metaModelRelationRequests: base.metaModelRelationRequests,
      viewRequests: toViewRequests(next),
    });
    await reloadFromDetails(next);
  }, [reloadFromDetails, vsumId]);

  useEffect(() => {
    if (!vsumId) {
      setViewTypes([]);
      setIsLoaded(false);
      return;
    }
    let cancelled = false;
    setIsLoaded(false);
    Promise.resolve(apiService.getVsumDetails(vsumId))
      .then(response => {
        if (cancelled || !response?.data) return;
        if (!Array.isArray(response.data.views)) {
          setViewTypes([]);
          setIsLoaded(false);
          return;
        }
        setViewTypes(applyRemote(response.data.views, []));
        setIsLoaded(true);
      })
      .catch(error => {
        console.error('Failed to load view types', error);
        if (!cancelled) {
          setViewTypes([]);
          setIsLoaded(false);
        }
      });
    return () => { cancelled = true; };
  }, [applyRemote, vsumId]);

  const addViewType = useCallback(async (input: AddViewTypeInput) => {
    if (!vsumId) return;
    if (!isLoaded) throw new Error('View types are still loading');
    const metamodels = input.metamodels.filter(model => input.linkedNodeIds.includes(model.nodeId));
    if (metamodels.length === 0) {
      throw new Error('A view type needs at least one metamodel from this project');
    }
    const importUris = metamodels.map(model => model.nsUri).filter((uri): uri is string => Boolean(uri));
    const query = buildNeoJoinSkeleton(input.label, importUris);
    const fileId = await createNeoJoinFile(query, input.label);
    const created: ViewType = {
      id: generateId(),
      label: input.label,
      scope: metamodels.length > 1 ? 'multi' : 'single',
      angle: input.angle,
      linkedNodeIds: input.linkedNodeIds,
      metaModelSourceIds: metamodels.map(model => model.sourceId),
      editable: input.editable,
      query,
      fileId,
    };
    const next = [...viewTypesRef.current, created];
    setViewTypes(next);
    if (vsumId) rememberAngles(vsumId, next);
    try {
      await syncViewList(next);
    } catch (error) {
      setViewTypes(viewTypesRef.current.filter(vt => vt.id !== created.id));
      throw error;
    }
  }, [isLoaded, syncViewList, vsumId]);

  const deleteViewType = useCallback(async (id: string) => {
    const next = viewTypesRef.current.filter(vt => vt.id !== id);
    setViewTypes(next);
    if (vsumId) rememberAngles(vsumId, next);
    if (!isLoaded || !vsumId) return;
    await syncViewList(next);
  }, [isLoaded, syncViewList, vsumId]);

  const updateAngle = useCallback((id: string, angle: number) => {
    setViewTypes(prev => {
      const next = updateAngleUpdater(id, angle)(prev);
      if (vsumId) rememberAngles(vsumId, next);
      return next;
    });
  }, [vsumId]);

  const unlinkNode = useCallback((viewTypeId: string, nodeId: string) => {
    setViewTypes(unlinkNodeUpdater(viewTypeId, nodeId));
  }, []);

  const updateViewTypeQuery = useCallback((id: string, query: string, fileId?: number | null) => {
    setViewTypes(updateQueryUpdater(id, query, fileId));
  }, []);

  const migrateLegacyViewTypes = useCallback(async (metamodels: ViewTypeMetamodelRef[]) => {
    if (!vsumId || !isLoaded || migrationInFlight.current) return;
    const legacy = readLegacyViewTypes(vsumId);
    if (legacy.length === 0) return;
    const remoteNames = new Set(viewTypesRef.current.map(vt => vt.label));
    const plans = legacyViewsToCreate(legacy, remoteNames, metamodels);
    const stillWaiting = legacy.filter(view =>
      !remoteNames.has(view.label) && !plans.some(plan => plan.legacy.id === view.id));
    if (plans.length === 0) {
      writeLegacyViewTypes(vsumId, stillWaiting);
      return;
    }
    migrationInFlight.current = true;
    try {
      let next = viewTypesRef.current;
      for (const plan of plans) {
        const query = plan.legacy.query?.trim()
          ? plan.legacy.query
          : buildNeoJoinSkeleton(plan.legacy.label, plan.importUris);
        const fileId = typeof plan.legacy.fileId === 'number'
          ? plan.legacy.fileId
          : await createNeoJoinFile(query, plan.legacy.label);
        const created: ViewType = {
          id: plan.legacy.id || generateId(),
          label: plan.legacy.label,
          scope: plan.sourceIds.length > 1 ? 'multi' : 'single',
          angle: plan.legacy.angle ?? defaultViewAngle(next.length),
          linkedNodeIds: plan.legacy.linkedNodeIds ?? [],
          metaModelSourceIds: plan.sourceIds,
          editable: plan.legacy.editable ?? false,
          query,
          fileId,
        };
        next = [...next, created];
      }
      setViewTypes(next);
      rememberAngles(vsumId, next);
      await syncViewList(next);
      writeLegacyViewTypes(vsumId, stillWaiting);
    } finally {
      migrationInFlight.current = false;
    }
  }, [isLoaded, syncViewList, vsumId]);

  return {
    viewTypes,
    isLoaded,
    addViewType,
    deleteViewType,
    updateAngle,
    unlinkNode,
    updateViewTypeQuery,
    migrateLegacyViewTypes,
  };
}
