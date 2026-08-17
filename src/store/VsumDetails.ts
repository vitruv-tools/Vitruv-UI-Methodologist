import { createStore, type StoreApi } from 'zustand';
import type {
  EditableVsumDetails,
  EditableVsumMetaModelRelation,
} from '../types/EditableVsumDetails';
import type { EditableFineGranularMetaModelRelation } from '../types/FineGranularMetaModelRelation';
import type { WorkspaceSnapshot } from '../types/workspace';
import { toWireReactionFileId } from '../utils/workspaceSnapshotUtils';
import { deepClone, deepCloneArray } from '../utils/DeepClone';
import { NoVsumDetailsStoreError } from './NoVsumDetailsStoreError';

// ---------------------------------------------------------------------------
// Store state shape
// ---------------------------------------------------------------------------

export interface VsumDetailsState extends EditableVsumDetails {
  /** Map: nsURI / identifier string → backend meta-model sourceId */
  identifiersToBackendMetaModelId: Map<string, number>;
}

// ---------------------------------------------------------------------------
// Per-VSUM store registry
// ---------------------------------------------------------------------------

const storeMap = new Map<number, StoreApi<VsumDetailsState>>();

export function createVsumDetailsStore(
  vsumId: number,
  initial: EditableVsumDetails,
): StoreApi<VsumDetailsState> {
  const store = createStore<VsumDetailsState>(() => ({
    ...initial,
    identifiersToBackendMetaModelId: new Map(),
  }));
  storeMap.set(vsumId, store);
  return store;
}

export function getVsumDetailsStore(vsumId: number): StoreApi<VsumDetailsState> {
  const store = storeMap.get(vsumId);
  if (!store) throw new NoVsumDetailsStoreError(vsumId);
  return store;
}

export function hasVsumDetailsStore(vsumId: number): boolean {
  return storeMap.has(vsumId);
}

export function deleteVsumDetailsStore(vsumId: number): void {
  storeMap.delete(vsumId);
}

// ---------------------------------------------------------------------------
// VsumDetailsHelper — CRUD on a working copy, then saveToStore()
// ---------------------------------------------------------------------------

export class VsumDetailsHelper {
  private state: VsumDetailsState;
  private readonly store: StoreApi<VsumDetailsState>;

  constructor(vsumId: number) {
    this.store = getVsumDetailsStore(vsumId);
    this.state = deepClone(this.store.getState());
  }

  /** Deep-cloned snapshot of the current working copy. */
  get(): VsumDetailsState {
    return deepClone(this.state);
  }

  // ── Meta-model relation CRUD ──────────────────────────────────────────

  getMetaModelRelation(query: {
    sourceId: number;
    targetId: number;
  }): EditableVsumMetaModelRelation | undefined {
    return this.state.metaModelsRelation.find(
      (r) => r.sourceId === query.sourceId && r.targetId === query.targetId,
    );
  }

  addMetaModelRelation(
    relation: EditableVsumMetaModelRelation,
  ): void {
    const exists = this.getMetaModelRelation({
      sourceId: relation.sourceId,
      targetId: relation.targetId,
    });
    if (!exists) {
      this.state.metaModelsRelation.push(relation);
    }
  }

  removeMetaModelRelation(sourceId: number, targetId: number): void {
    this.state.metaModelsRelation = this.state.metaModelsRelation.filter(
      (r) => !(r.sourceId === sourceId && r.targetId === targetId),
    );
  }

  // ── Fine-granular relation CRUD ───────────────────────────────────────

  getFineGranularMetaModelRelation(
    coarseSourceId: number,
    coarseTargetId: number,
    fineSourceId: string,
    fineTargetId: string,
  ): EditableFineGranularMetaModelRelation | undefined {
    const relation = this.getMetaModelRelation({
      sourceId: coarseSourceId,
      targetId: coarseTargetId,
    });
    return relation?.fineGranularMetaModelRelationSet.find(
      (fg) => fg.sourceId === fineSourceId && fg.targetId === fineTargetId,
    );
  }

  addFineGranularMetaModelRelation(
    coarseSourceId: number,
    coarseTargetId: number,
    fine: EditableFineGranularMetaModelRelation,
  ): void {
    let relation = this.getMetaModelRelation({
      sourceId: coarseSourceId,
      targetId: coarseTargetId,
    });
    if (!relation) {
      relation = {
        id: 0,
        sourceId: coarseSourceId,
        targetId: coarseTargetId,
        reactionFileId: null,
        reactionFileStorageId: null,
        fineGranularMetaModelRelationSet: [],
      };
      this.state.metaModelsRelation.push(relation);
    }
    const exists = relation.fineGranularMetaModelRelationSet.find(
      (fg) => fg.sourceId === fine.sourceId && fg.targetId === fine.targetId,
    );
    if (!exists) {
      relation.fineGranularMetaModelRelationSet.push(fine);
    }
  }

  removeFineGranularMetaModelRelation(
    coarseSourceId: number,
    coarseTargetId: number,
    fineSourceId: string,
    fineTargetId: string,
  ): void {
    const relation = this.getMetaModelRelation({
      sourceId: coarseSourceId,
      targetId: coarseTargetId,
    });
    if (!relation) return;
    relation.fineGranularMetaModelRelationSet =
      relation.fineGranularMetaModelRelationSet.filter(
        (fg) => !(fg.sourceId === fineSourceId && fg.targetId === fineTargetId),
      );
  }

  getAllFineGranularMetaModelRelations(): EditableFineGranularMetaModelRelation[] {
    return this.state.metaModelsRelation.flatMap(
      (r) => deepCloneArray(r.fineGranularMetaModelRelationSet),
    );
  }

  // ── Identifier map ────────────────────────────────────────────────────

  setIdentifiersToBackendMetaModelId(map: Map<string, number>): void {
    this.state.identifiersToBackendMetaModelId = new Map(map);
  }

  getBackendMetaModelId(identifier: string): number | undefined {
    return this.state.identifiersToBackendMetaModelId.get(identifier);
  }

  // ── Workspace snapshot ────────────────────────────────────────────────

  getAsWorkspaceSnapshot(): WorkspaceSnapshot {
    const metaModelIds = this.state.metaModels.map((mm) => mm.sourceId);
    const metaModelRelationRequests = this.state.metaModelsRelation.map((r) => ({
      sourceId: r.sourceId,
      targetId: r.targetId,
      reactionFileId: toWireReactionFileId(
        r.reactionFileId ?? r.reactionFileStorageId,
      ),
      ...(r.fineGranularMetaModelRelationSet.length
        ? {
            fineGranularMetaModelRelationSet: deepCloneArray(
              r.fineGranularMetaModelRelationSet,
            ),
          }
        : {}),
    }));
    return { metaModelIds, metaModelRelationRequests };
  }

  // ── Persist ───────────────────────────────────────────────────────────

  saveToStore(): void {
    this.store.setState(deepClone(this.state));
  }
}
