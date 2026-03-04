import { EObject } from "ecore-ts";
import { create, UseBoundStore, StoreApi } from "zustand";
import { EditableVsumDetails, EditableVsumMetaModelRelation } from "../types/EditableVsumDetails";
import { projectStore } from "./Project";

const storeMap = new Map<number | string, UseBoundStore<StoreApi<EditableVsumDetails>> | undefined>();

export function createVsumDetailsStore(id: number | string, vsumDetails: EditableVsumDetails) {
  if (!storeMap.has(id)) {
    const newStore = create<EditableVsumDetails>((_) => (vsumDetails));
    storeMap.set(id, newStore);
  }
}

export class NoActiveVsum extends Error {}

export class NoVsumDetailsStore extends Error {}

export class ActiveVsumDetails {
  private vsumDetails: EditableVsumDetails;
  private vsumDetailsStore: UseBoundStore<StoreApi<EditableVsumDetails>>;

  constructor() {
    const vsumDetailsStore = this.getActiveVsumDetailsStore();
    this.vsumDetailsStore = vsumDetailsStore;
    this.vsumDetails = vsumDetailsStore.getState();
  }

  private getActiveVsumDetailsStore() {
    const activeVsumId = projectStore.getState().activeId; // Ensure we have the latest activeInstanceId for any side effects
    if (!activeVsumId) {
      throw new NoActiveVsum("No active VSUM ID found");
    }

    const vsumDetailsStore = this.getVsumDetailsStore(activeVsumId);
    if (!vsumDetailsStore) {
      throw new NoVsumDetailsStore(
        `No VsumDetails store found for active VSUM ID: ${activeVsumId}`,
      );
    }

    return vsumDetailsStore;
  }

  private getVsumDetailsStore(id: number | string) {
    return storeMap.get(id);
  }

  addMetaModelRelation(editableMetaModelRelation: EditableVsumMetaModelRelation) {
    this.vsumDetails.metaModelsRelation ??= [];
    this.vsumDetails.metaModelsRelation.push(editableMetaModelRelation);
    return editableMetaModelRelation;
  }

  getMetaModelRelation(identifiers: Pick<EditableVsumMetaModelRelation, 'sourceId' | 'targetId'>) {
    return this.vsumDetails.metaModelsRelation?.find(
      (relation) =>
        relation.sourceId === identifiers.sourceId && relation.targetId === identifiers.targetId,
    );
  }

  getIdentifiersToEObjectMap() {
    if (!this.vsumDetails.identifiersToEObject) {
      throw new Error("IdentifiersToEObject map is not defined, has UML generation been performed yet?");
    }
    return this.vsumDetails.identifiersToEObject;
  }

  setIdentifiersToEObjectMap(map: Map<string, EObject>, overwrite: boolean = false) {
    if (overwrite || !this.vsumDetails.identifiersToEObject) {
      this.vsumDetails.identifiersToEObject = map;
    }
    else {
      // Merge with existing map
      const existingMap = this.vsumDetails.identifiersToEObject;
      existingMap.forEach((value, key) => {
        map.set(key, value);
      });
      this.vsumDetails.identifiersToEObject = map;
    }
  }

  getIdentifiersToBackendMetaModelIdMap() {
    if (!this.vsumDetails.identifiersToBackendMetaModelId) {
      throw new Error("IdentifiersToBackendMetaModelId map is not defined, has UML generation been performed yet?");
    }
    return this.vsumDetails.identifiersToBackendMetaModelId;
  }

  addIdentifierToBackendMetaModelIdMap(eObjectIdentifier: string, backendMetaModelId: number) {
    if (!this.vsumDetails.identifiersToBackendMetaModelId) {
      this.vsumDetails.identifiersToBackendMetaModelId = new Map<string, number>();
    }
    this.vsumDetails.identifiersToBackendMetaModelId.set(eObjectIdentifier, backendMetaModelId);
  }

  save() {
    this.vsumDetailsStore.setState(this.vsumDetails);
  }
}