import type { Node } from 'reactflow';
import type { ViewRequest } from '../services/api';
import type { VsumView } from '../types/vsum';
import { extractNsUriFromEcore } from './ecoreParser';

const LEGACY_KEY = 'vitruv_view_types_v1';
const ANGLE_KEY = 'vitruv_view_type_angles_v1';

export type ViewTypeScope = 'single' | 'multi';

export interface ViewType {
  id: string;
  /** Backend view id, once `/details` has returned it. */
  backendId?: number | null;
  label: string;
  scope: ViewTypeScope;
  angle: number;
  linkedNodeIds: string[];
  /** Source ids sent as `ViewRequest.metaModelIds`. */
  metaModelSourceIds?: number[];
  editable: boolean;
  /** NeoJoin source. Absent until the query has been opened or created. */
  query?: string;
  /** Stored NeoJoin file. */
  fileId?: number | null;
  /** Stored `.nj` file name, used to match a build problem when the file id is absent. */
  fileName?: string;
}

export function legacyViewTypesKey(vsumId: string): string {
  return `${LEGACY_KEY}_${vsumId}`;
}

export function viewTypeAnglesKey(vsumId: string): string {
  return `${ANGLE_KEY}_${vsumId}`;
}

export function defaultViewAngle(index: number): number {
  return -Math.PI / 2 + index * (Math.PI / 5);
}

export interface ViewTypeMetamodelRef {
  nodeId: string;
  sourceId: number;
  nsUri: string | null;
}

export function metamodelRefFromNode(node: Node): ViewTypeMetamodelRef | null {
  const raw = node.data?.metaModelSourceId ?? node.data?.metaModelId;
  const sourceId = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(sourceId) || sourceId <= 0) return null;
  const content = typeof node.data?.fileContent === 'string' ? node.data.fileContent : '';
  return {
    nodeId: node.id,
    sourceId,
    nsUri: content ? extractNsUriFromEcore(content) : null,
  };
}

export function readLegacyViewTypes(vsumId: string): ViewType[] {
  try {
    const raw = localStorage.getItem(legacyViewTypesKey(vsumId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as ViewType[] : [];
  } catch {
    return [];
  }
}

export function clearLegacyViewTypes(vsumId: string): void {
  localStorage.removeItem(legacyViewTypesKey(vsumId));
}

export function writeLegacyViewTypes(vsumId: string, viewTypes: ViewType[]): void {
  if (viewTypes.length === 0) {
    clearLegacyViewTypes(vsumId);
    return;
  }
  localStorage.setItem(legacyViewTypesKey(vsumId), JSON.stringify(viewTypes));
}

export function readViewTypeAngles(vsumId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(viewTypeAnglesKey(vsumId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};
    const angles: Record<string, number> = {};
    for (const [id, angle] of Object.entries(parsed)) {
      if (typeof angle === 'number' && Number.isFinite(angle)) angles[id] = angle;
    }
    return angles;
  } catch {
    return {};
  }
}

export function writeViewTypeAngles(vsumId: string, viewTypes: Array<{ id: string; angle: number }>): void {
  const angles: Record<string, number> = {};
  for (const viewType of viewTypes) angles[viewType.id] = viewType.angle;
  localStorage.setItem(viewTypeAnglesKey(vsumId), JSON.stringify(angles));
}

export function sourceIdsOfView(view: VsumView): number[] {
  const ids = (view.assignedModels ?? [])
    .map(model => model.sourceId ?? model.id)
    .filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0);
  return [...new Set(ids)];
}

export function scopeForSourceIds(sourceIds: number[], fallback: ViewTypeScope = 'single'): ViewTypeScope {
  if (sourceIds.length > 1) return 'multi';
  if (sourceIds.length === 1) return 'single';
  return fallback;
}

export function viewTypeFromRemote(
  view: VsumView,
  angle: number,
  previous?: ViewType,
): ViewType {
  const metaModelSourceIds = sourceIdsOfView(view);
  return {
    id: String(view.id),
    backendId: view.id,
    label: view.name?.trim() || previous?.label || `View ${view.id}`,
    scope: scopeForSourceIds(metaModelSourceIds, previous?.scope),
    angle,
    linkedNodeIds: previous?.linkedNodeIds ?? [],
    metaModelSourceIds,
    editable: previous?.editable ?? false,
    query: previous?.query,
    fileId: view.fileStorageId,
  };
}

export function viewTypesFromRemote(views: VsumView[], angles: Record<string, number>, previous: ViewType[] = []): ViewType[] {
  return views.map((view, index) => {
    const match = previous.find(vt =>
      vt.backendId === view.id
      || vt.fileId === view.fileStorageId
      || (view.name != null && vt.label === view.name));
    const angle = angles[String(view.id)]
      ?? (match ? angles[match.id] : undefined)
      ?? match?.angle
      ?? defaultViewAngle(index);
    return viewTypeFromRemote(view, angle, match);
  });
}

/** The full list sent with sync-changes. Views without a file or metamodel are omitted. */
export function toViewRequests(viewTypes: ViewType[]): ViewRequest[] {
  const requests: ViewRequest[] = [];
  for (const viewType of viewTypes) {
    if (typeof viewType.fileId !== 'number') continue;
    const metaModelIds = (viewType.metaModelSourceIds ?? []).filter(id => Number.isFinite(id) && id > 0);
    if (metaModelIds.length === 0) continue;
    requests.push({
      ...(typeof viewType.backendId === 'number' ? { id: viewType.backendId } : {}),
      name: viewType.label,
      metaModelIds,
      fileStorageId: viewType.fileId,
    });
  }
  return requests;
}

export interface LegacyViewPlan {
  legacy: ViewType;
  sourceIds: number[];
  importUris: string[];
}

/**
 * Legacy canvas views whose metamodels are on the canvas and which the backend does not
 * already have under the same name.
 */
export function legacyViewsToCreate(
  legacy: ViewType[],
  remoteNames: Set<string>,
  metamodels: ViewTypeMetamodelRef[],
): LegacyViewPlan[] {
  const plans: LegacyViewPlan[] = [];
  for (const view of legacy) {
    if (remoteNames.has(view.label)) continue;
    const linked = view.linkedNodeIds
      .map(nodeId => metamodels.find(model => model.nodeId === nodeId))
      .filter((model): model is ViewTypeMetamodelRef => model != null);
    if (linked.length === 0 || linked.length !== view.linkedNodeIds.length) continue;
    plans.push({
      legacy: view,
      sourceIds: linked.map(model => model.sourceId),
      importUris: linked.map(model => model.nsUri).filter((uri): uri is string => Boolean(uri)),
    });
  }
  return plans;
}

/** Fills canvas node ids from metamodel source ids so arrows and metrics keep working. */
export function linkViewTypesToNodes(viewTypes: ViewType[], metamodels: ViewTypeMetamodelRef[]): ViewType[] {
  return viewTypes.map(viewType => {
    const sourceIds = viewType.metaModelSourceIds ?? [];
    const linkedNodeIds = sourceIds
      .map(sourceId => metamodels.find(model => model.sourceId === sourceId)?.nodeId)
      .filter((id): id is string => Boolean(id));
    return {
      ...viewType,
      linkedNodeIds: linkedNodeIds.length > 0 ? linkedNodeIds : viewType.linkedNodeIds,
      scope: scopeForSourceIds(sourceIds, viewType.scope),
    };
  });
}
