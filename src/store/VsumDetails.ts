import { EObject } from "ecore-ts";
import { create, StoreApi, UseBoundStore } from "zustand";
import {
  EditableVsumDetails, EditableVsumMetaModelRef,
  EditableVsumMetaModelRelation
} from "../types/EditableVsumDetails";
import { WorkspaceSnapshot } from "../types/workspace";
import { deepClone } from "../utils/DeepClone";
import { NoVsumDetailsStoreError } from "./NoVsumDetailsStoreError";

/**
 * We intentionally do not expose the store directly, 
 * but instead provide helper methods to manipulate the VSUM details.
 * This allows us to encapsulate the logic for how the details are stored 
 * and updated, and to ensure that any necessary side effects 
 * (like updating the structure) are handled correctly.
 */
const storeMap = new Map<
  number | string,
  UseBoundStore<StoreApi<EditableVsumDetails | null>> | undefined
>();

export function createVsumDetailsStore(
  id: number | string,
  vsumDetails: EditableVsumDetails,
) {
  if (!storeMap.has(id)) {
    const newStore = create<EditableVsumDetails>((_) => vsumDetails);
    storeMap.set(id, newStore);
  }
}

export function getVsumDetailsStore(id: number | string) {
  if (!storeMap.has(id)) {
    const newStore = create<EditableVsumDetails | null>((_) => null);
    storeMap.set(id, newStore);
  }
  return storeMap.get(id)!;
}

export class VsumDetailsHelper {
  protected vsumDetails: EditableVsumDetails | null;
  protected vsumDetailsStore: UseBoundStore<StoreApi<EditableVsumDetails | null>>;

  constructor(id: number) {
    const vsumDetailsStore = this.getVsumDetailsStoreOrThrow(id);
    this.vsumDetailsStore = vsumDetailsStore;
    this.vsumDetails = vsumDetailsStore.getState();
  }

  private getVsumDetailsStoreOrThrow(id: number) {
    const vsumDetailsStore = this.getVsumDetailsStore(id);
    if (!vsumDetailsStore) {
      throw new NoVsumDetailsStoreError(
        `No VsumDetails store found for VSUM ID: ${id}`
      );
    }

    return vsumDetailsStore;
  }

  private getVsumDetailsStore(id: number | string) {
    return storeMap.get(id);
  }

  findMetaModels(filters?: Partial<EditableVsumMetaModelRef>) {
    //TODO(Reinbold): Local filtering is not implemented
    return this.vsumDetails?.metaModels ?? [];
  }

  addMetaModel(editableVsumMetaModelRef: EditableVsumMetaModelRef) {
    this.vsumDetails!.metaModels.push(editableVsumMetaModelRef);
    return editableVsumMetaModelRef;
  }

  getMetaModel(identifier: Pick<EditableVsumMetaModelRef, "id">) {
    return this.vsumDetails?.metaModels?.find(
      (metaModel) => metaModel.id === identifier.id
    );
  }

  removeMetaModel(identifier: Pick<EditableVsumMetaModelRef, "id">) {
    const removed = (this.vsumDetails!.metaModels =
      this.vsumDetails!.metaModels.filter(
        (metaModel) => metaModel.id == identifier.id
      ));
    this.vsumDetails!.metaModels = this.vsumDetails!.metaModels.filter(
      (metaModel) => metaModel.id !== identifier.id
    );
    return removed[0];
  }

  addMetaModelRelation(
    editableMetaModelRelation: EditableVsumMetaModelRelation
  ) {
    this.vsumDetails!.metaModelsRelation ??= [];
    this.vsumDetails!.metaModelsRelation.push(editableMetaModelRelation);
    return editableMetaModelRelation;
  }

  getMetaModelRelation(
    identifiers: Pick<EditableVsumMetaModelRelation, "sourceId" | "targetId">
  ) {
    return this.vsumDetails?.metaModelsRelation?.find(
      (relation) => relation.sourceId === identifiers.sourceId &&
        relation.targetId === identifiers.targetId
    );
  }

  removeMetaModelRelation(
    identifiers: Pick<EditableVsumMetaModelRelation, "sourceId" | "targetId">
  ) {
    const index = this.vsumDetails!.metaModelsRelation?.findIndex(
      (relation) => relation.sourceId === identifiers.sourceId &&
        relation.targetId === identifiers.targetId
    );
    if (index !== undefined && index !== -1) {
      return this.vsumDetails!.metaModelsRelation?.splice(index, 1)[0];
    }
  }

  getIdentifiersToEObjectMap() {
    if (!this.vsumDetails?.identifiersToEObject) {
      throw new Error(
        "IdentifiersToEObject map is not defined, has UML generation been performed yet?"
      );
    }
    return this.vsumDetails.identifiersToEObject;
  }

  setIdentifiersToEObjectMap(
    map: Map<string, EObject>,
    overwrite: boolean = false
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

  getIdentifiersToBackendMetaModelIdMap() {
    if (!this.vsumDetails?.identifiersToBackendMetaModelId) {
      throw new Error(
        "IdentifiersToBackendMetaModelId map is not defined, has UML generation been performed yet?"
      );
    }
    return this.vsumDetails.identifiersToBackendMetaModelId;
  }

  addIdentifierToBackendMetaModelIdMap(
    eObjectIdentifier: string,
    backendMetaModelId: number
  ) {
    if (!this.vsumDetails!.identifiersToBackendMetaModelId) {
      this.vsumDetails!.identifiersToBackendMetaModelId = new Map<
        string,
        number
      >();
    }
    this.vsumDetails!.identifiersToBackendMetaModelId.set(
      eObjectIdentifier,
      backendMetaModelId
    );
  }

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

  getAsWorkspaceSnapshot() {
    const map = this.getMetaModelIdToMetaModelSourceIdMap();
    const workspaceSnapshot: WorkspaceSnapshot = {
      //TODO(Reinbold): maybe we also need to do:
      //metaModelIds: this.vsumDetails?.metaModels.map((metaModel) => map.get(metaModel.id)!) ?? [],
      metaModelIds: this.vsumDetails?.metaModels.map((metaModel) => metaModel.id) ?? [],
      metaModelRelationRequests: this.vsumDetails?.metaModelsRelation?.map(
        (relation) => ({
          sourceId: map.get(relation.sourceId)!,
          targetId: map.get(relation.targetId)!,
          reactionFileId: relation.reactionFileStorageId ?? 0,
          fineGranularMetaModelRelationSet: relation.fineGranularMetaModelRelationSet
        })
      ) ?? [],
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

  saveToStore() {
    this.vsumDetailsStore.setState(this.vsumDetails);
  }
}
