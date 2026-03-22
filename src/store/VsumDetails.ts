import { EObject } from "ecore-ts";
import { create, StoreApi, UseBoundStore } from "zustand";
import {
  EditableFineGranularMetaModelRelation,
  EditableVsumDetails,
  EditableVsumMetaModelRef,
  EditableVsumMetaModelRelation,
} from "../types/EditableVsumDetails";
import { WorkspaceSnapshot } from "../types/workspace";
import { deepClone } from "../utils/DeepClone";
import { NoVsumDetailsStoreError } from "./NoVsumDetailsStoreError";

const storeMap = new Map<
  number | string,
  UseBoundStore<StoreApi<EditableVsumDetails | null>> | undefined
>();

/**
 * Creates or updates a VSUM details store for a given VSUM id.
 * @param {number | string} id - VSUM identifier.
 * @param {EditableVsumDetails} vsumDetails - Initial or replacement VSUM details.
 * @returns {void}
 */
export function createVsumDetailsStore(
  id: number | string,
  vsumDetails: EditableVsumDetails,
) {
  if (!storeMap.has(id)) {
    const newStore = create<EditableVsumDetails>((_) => vsumDetails);
    storeMap.set(id, newStore);
  } else {
    const existingStore = storeMap.get(id)!;
    existingStore.setState(vsumDetails);
  }
}

/**
 * Gets the VSUM details store for a given VSUM id and creates an empty store if needed.
 * @param {number | string} id - VSUM identifier.
 * @returns {UseBoundStore<StoreApi<EditableVsumDetails | null>>} The Zustand store instance.
 */
export function getVsumDetailsStore(id: number | string) {
  if (!storeMap.has(id)) {
    const newStore = create<EditableVsumDetails | null>((_) => null);
    storeMap.set(id, newStore);
  }
  return storeMap.get(id)!;
}

/**
 * Helper wrapper around VSUM details with utility methods for graph and mapping updates.
 */
export class VsumDetailsHelper {
  protected vsumDetails: EditableVsumDetails | null;
  protected vsumDetailsStore: UseBoundStore<
    StoreApi<EditableVsumDetails | null>
  >;

  /**
   * Creates a helper bound to a VSUM details store.
   * @param {number} id - VSUM identifier.
   */
  constructor(id: number) {
    const vsumDetailsStore = this.getVsumDetailsStoreOrThrow(id);
    this.vsumDetailsStore = vsumDetailsStore;
    this.vsumDetails = vsumDetailsStore.getState();
  }

  private getVsumDetailsStoreOrThrow(id: number) {
    const vsumDetailsStore = this.getVsumDetailsStore(id);
    if (!vsumDetailsStore) {
      throw new NoVsumDetailsStoreError(
        `No VsumDetails store found for VSUM ID: ${id}`,
      );
    }

    return vsumDetailsStore;
  }

  private getVsumDetailsStore(id: number | string) {
    return storeMap.get(id);
  }

  /**
   * Returns meta models currently present in VSUM details.
   * @param {Partial<EditableVsumMetaModelRef>} filters - Optional filters (currently not applied).
   * @returns {EditableVsumMetaModelRef[]} Matching meta models.
   */
  findMetaModels(filters?: Partial<EditableVsumMetaModelRef>) {
    //TODO(Reinbold): Local filtering is not implemented
    return this.vsumDetails?.metaModels ?? [];
  }

  /**
   * Adds a meta model reference to VSUM details.
   * @param {EditableVsumMetaModelRef} editableVsumMetaModelRef - Meta model to add.
   * @returns {EditableVsumMetaModelRef} The added meta model.
   */
  addMetaModel(editableVsumMetaModelRef: EditableVsumMetaModelRef) {
    this.vsumDetails!.metaModels.push(editableVsumMetaModelRef);
    return editableVsumMetaModelRef;
  }

  /**
   * Finds a meta model by id.
   * @param {Pick<EditableVsumMetaModelRef, "id">} identifier - Meta model identifier.
   * @returns {EditableVsumMetaModelRef | undefined} Matching meta model or undefined.
   */
  getMetaModel(identifier: Pick<EditableVsumMetaModelRef, "id">) {
    return this.vsumDetails?.metaModels?.find(
      (metaModel) => metaModel.id === identifier.id,
    );
  }

  /**
   * Removes a meta model by id.
   * @param {Pick<EditableVsumMetaModelRef, "id">} identifier - Meta model identifier.
   * @returns {EditableVsumMetaModelRef | undefined} Removed meta model.
   */
  removeMetaModel(identifier: Pick<EditableVsumMetaModelRef, "id">) {
    const removed = (this.vsumDetails!.metaModels =
      this.vsumDetails!.metaModels.filter(
        (metaModel) => metaModel.id == identifier.id,
      ));
    this.vsumDetails!.metaModels = this.vsumDetails!.metaModels.filter(
      (metaModel) => metaModel.id !== identifier.id,
    );
    return removed[0];
  }

  /**
   * Retrieves relations between provided meta models and an optional target filter.
   * @param {Pick<EditableVsumMetaModelRef, "id">[]} metaModels - Meta model ids to match.
   * @param {Pick<EditableVsumMetaModelRef, "id">} target - Optional target id filter.
   * @returns {EditableVsumMetaModelRelation[]} Matching relations.
   */
  getMetaModelRelations(
    metaModels: Pick<EditableVsumMetaModelRef, "id">[],
    target?: Pick<EditableVsumMetaModelRef, "id">,
  ) {
    const result =
      this.vsumDetails?.metaModelsRelation?.filter(
        (mmr) =>
          metaModels.some((mm) => mm.id === mmr.sourceId) &&
          metaModels.some((mm) => mm.id === mmr.targetId),
      ) ?? [];
    if (target != null) {
      return result.filter(
        (mmr) => mmr.sourceId === target.id || mmr.targetId === target.id,
      );
    }
    return result;
  }

  /**
   * Adds a meta model relation to VSUM details.
   * @param {EditableVsumMetaModelRelation} editableMetaModelRelation - Relation to add.
   * @returns {EditableVsumMetaModelRelation} The added relation.
   */
  addMetaModelRelation(
    editableMetaModelRelation: EditableVsumMetaModelRelation,
  ) {
    this.vsumDetails!.metaModelsRelation ??= [];
    this.vsumDetails!.metaModelsRelation.push(editableMetaModelRelation);
    return editableMetaModelRelation;
  }

  /**
   * Finds a meta model relation by source and target ids.
   * @param {Pick<EditableVsumMetaModelRelation, "sourceId" | "targetId">} identifiers - Relation identifiers.
   * @returns {EditableVsumMetaModelRelation | undefined} Matching relation.
   */
  getMetaModelRelation(
    identifiers: Pick<EditableVsumMetaModelRelation, "sourceId" | "targetId">,
  ) {
    return this.vsumDetails?.metaModelsRelation?.find(
      (relation) =>
        relation.sourceId === identifiers.sourceId &&
        relation.targetId === identifiers.targetId,
    );
  }

  /**
   * Finds a relation using fully qualified model names.
   * @param {string} fromModel - Source model identifier.
   * @param {string} toModel - Target model identifier.
   * @returns {EditableVsumMetaModelRelation | undefined} Matching relation.
   */
  getMetaModelRelationByFullyQualifiedName(fromModel: string, toModel: string) {
    const sourceId =
      this.getIdentifiersToBackendMetaModelIdMap()?.get(fromModel);
    const targetId = this.getIdentifiersToBackendMetaModelIdMap()?.get(toModel);
    if (sourceId == null || targetId == null) {
      return undefined;
    }
    return this.vsumDetails?.metaModelsRelation?.find(
      (relation) =>
        relation.sourceId === sourceId && relation.targetId === targetId,
    );
  }

  /**
   * Removes a meta model relation by source and target ids.
   * @param {Pick<EditableVsumMetaModelRelation, "sourceId" | "targetId">} identifiers - Relation identifiers.
   * @returns {EditableVsumMetaModelRelation | undefined} Removed relation.
   */
  removeMetaModelRelation(
    identifiers: Pick<EditableVsumMetaModelRelation, "sourceId" | "targetId">,
  ) {
    const index = this.vsumDetails!.metaModelsRelation?.findIndex(
      (relation) =>
        relation.sourceId === identifiers.sourceId &&
        relation.targetId === identifiers.targetId,
    );
    if (index !== undefined && index !== -1) {
      return this.vsumDetails!.metaModelsRelation?.splice(index, 1)[0];
    }
  }

  /**
   * Finds a fine-granular relation by source and target EObject ids.
   * @param {Pick<EditableFineGranularMetaModelRelation, "sourceId" | "targetId">} identifiers - Fine-granular relation identifiers.
   * @returns {EditableFineGranularMetaModelRelation | undefined} Matching fine-granular relation.
   */
  getFineGranularMetaModelRelation(
    identifiers: Pick<
      EditableFineGranularMetaModelRelation,
      "sourceId" | "targetId"
    >,
  ) {
    return this.vsumDetails?.metaModelsRelation
      ?.map((r) => r.fineGranularMetaModelRelationSet)
      ?.flat()
      .find(
        (relation) =>
          relation.sourceId === identifiers.sourceId &&
          relation.targetId === identifiers.targetId,
      );
  }

  /**
   * Removes a fine-granular relation and cleans obsolete parent relations.
   * @param {Pick<EditableFineGranularMetaModelRelation, "sourceId" | "targetId">} identifiers - Fine-granular relation identifiers.
   * @returns {EditableFineGranularMetaModelRelation | undefined} Removed fine-granular relation.
   */
  removeFineGranularMetaModelRelation(
    identifiers: Pick<
      EditableFineGranularMetaModelRelation,
      "sourceId" | "targetId"
    >,
  ) {
    for (const metaModelRelation of this.vsumDetails?.metaModelsRelation ??
      []) {
      for (
        let i = 0;
        i < metaModelRelation.fineGranularMetaModelRelationSet.length;
        i++
      ) {
        const relation = metaModelRelation.fineGranularMetaModelRelationSet[i];
        if (
          relation.sourceId === identifiers.sourceId &&
          relation.targetId === identifiers.targetId
        ) {
          const toReturn =
            metaModelRelation.fineGranularMetaModelRelationSet.splice(i, 1)[0];
          // Remove obsolete metamodel relation
          if (
            metaModelRelation.fineGranularMetaModelRelationSet.length === 0 &&
            metaModelRelation.reactionFileStorageId == null
          ) {
            this.removeMetaModelRelation(metaModelRelation);
          }
          return toReturn;
        }
      }
    }
  }

  /**
   * Returns the EObject identifier map.
   * @returns {Map<string, EObject>} Identifier to EObject map.
   */
  getIdentifiersToEObjectMap() {
    if (!this.vsumDetails?.identifiersToEObject) {
      throw new Error(
        "IdentifiersToEObject map is not defined, has UML generation been performed yet?",
      );
    }
    return this.vsumDetails.identifiersToEObject;
  }

  /**
   * Sets or merges the EObject identifier map.
   * @param {Map<string, EObject>} map - New identifier map.
   * @param {boolean} overwrite - Whether to overwrite existing values.
   * @returns {void}
   */
  setIdentifiersToEObjectMap(
    map: Map<string, EObject>,
    overwrite: boolean = false,
  ) {
    if (overwrite || !this.vsumDetails!.identifiersToEObject) {
      this.vsumDetails!.identifiersToEObject = map;
    } else {
      // Merge with existing map
      const existingMap = this.vsumDetails!.identifiersToEObject;
      existingMap.forEach((value, key) => {
        map.set(key, value);
      });
      this.vsumDetails!.identifiersToEObject = map;
    }
  }

  /**
   * Returns the identifier-to-backend-meta-model-id map.
   * @returns {Map<string, number>} Identifier to backend meta model id map.
   */
  getIdentifiersToBackendMetaModelIdMap() {
    if (!this.vsumDetails?.identifiersToBackendMetaModelId) {
      throw new Error(
        "IdentifiersToBackendMetaModelId map is not defined, has UML generation been performed yet?",
      );
    }
    return this.vsumDetails.identifiersToBackendMetaModelId;
  }

  /**
   * Adds a mapping from EObject identifier to backend meta model id.
   * @param {string} eObjectIdentifier - EObject identifier.
   * @param {number} backendMetaModelId - Backend meta model id.
   * @returns {void}
   */
  addIdentifierToBackendMetaModelIdMap(
    eObjectIdentifier: string,
    backendMetaModelId: number,
  ) {
    if (!this.vsumDetails!.identifiersToBackendMetaModelId) {
      this.vsumDetails!.identifiersToBackendMetaModelId = new Map<
        string,
        number
      >();
    }
    this.vsumDetails!.identifiersToBackendMetaModelId.set(
      eObjectIdentifier,
      backendMetaModelId,
    );
  }

  /**
   * Returns a deep-cloned snapshot of current VSUM details.
   * @returns {EditableVsumDetails | null} Cloned VSUM details.
   */
  get() {
    // We dont return the reference to encourage people to actually use the helper methods rather than just manipulating the details object directly, which would bypass important logic in the helper methods (e.g. for keeping the structure in sync)
    return deepClone(this.vsumDetails);
  }

  private getMetaModelIdToMetaModelSourceIdMap() {
    const map = new Map<number, number>();
    this.vsumDetails?.metaModels.forEach((metaModel) => {
      map.set(metaModel.id, metaModel.sourceId ?? metaModel.id);
    });
    return map;
  }

  /**
   * Converts current VSUM details into a workspace snapshot payload.
   * @returns {WorkspaceSnapshot} Workspace snapshot.
   */
  getAsWorkspaceSnapshot() {
    const map = this.getMetaModelIdToMetaModelSourceIdMap();
    const workspaceSnapshot: WorkspaceSnapshot = {
      metaModelIds:
        this.vsumDetails?.metaModels.map(
          (metaModel) => map.get(metaModel.id)!,
        ) ?? [],
      metaModelRelationRequests:
        this.vsumDetails?.metaModelsRelation?.map((relation) => ({
          id: relation.id ?? null,
          sourceId: map.get(relation.sourceId)!,
          targetId: map.get(relation.targetId)!,
          reactionFileId: relation.reactionFileStorageId ?? null,
          fineGranularMetaModelRelationSet:
            relation.fineGranularMetaModelRelationSet,
        })) ?? [],
    };
    return workspaceSnapshot;
  }

  /**
   * Overwrites the current vsum details with the new details.
   * This is useful for cases where we want to replace the entire details object, e.g. when loading a saved VSUM.
   * NOTE: Do not abuse this method to just update properties.
   * @param newDetails The new vsum details
   */
  overwrite(newDetails: EditableVsumDetails) {
    this.vsumDetails = newDetails;
  }

  /**
   * Persists the current helper state back to the underlying Zustand store.
   * @returns {void}
   */
  saveToStore() {
    this.vsumDetailsStore.setState(this.vsumDetails);
  }
}
