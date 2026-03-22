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

export function getVsumDetailsStore(id: number | string) {
  if (!storeMap.has(id)) {
    const newStore = create<EditableVsumDetails | null>((_) => null);
    storeMap.set(id, newStore);
  }
  return storeMap.get(id)!;
}

export class VsumDetailsHelper {
  protected vsumDetails: EditableVsumDetails | null;
  protected vsumDetailsStore: UseBoundStore<
    StoreApi<EditableVsumDetails | null>
  >;

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
      (metaModel) => metaModel.id === identifier.id,
    );
  }

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

  addMetaModelRelation(
    editableMetaModelRelation: EditableVsumMetaModelRelation,
  ) {
    this.vsumDetails!.metaModelsRelation ??= [];
    this.vsumDetails!.metaModelsRelation.push(editableMetaModelRelation);
    return editableMetaModelRelation;
  }

  getMetaModelRelation(
    identifiers: Pick<EditableVsumMetaModelRelation, "sourceId" | "targetId">,
  ) {
    return this.vsumDetails?.metaModelsRelation?.find(
      (relation) =>
        relation.sourceId === identifiers.sourceId &&
        relation.targetId === identifiers.targetId,
    );
  }

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

  getIdentifiersToEObjectMap() {
    if (!this.vsumDetails?.identifiersToEObject) {
      throw new Error(
        "IdentifiersToEObject map is not defined, has UML generation been performed yet?",
      );
    }
    return this.vsumDetails.identifiersToEObject;
  }

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

  getIdentifiersToBackendMetaModelIdMap() {
    if (!this.vsumDetails?.identifiersToBackendMetaModelId) {
      throw new Error(
        "IdentifiersToBackendMetaModelId map is not defined, has UML generation been performed yet?",
      );
    }
    return this.vsumDetails.identifiersToBackendMetaModelId;
  }

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

  saveToStore() {
    this.vsumDetailsStore.setState(this.vsumDetails);
  }
}
