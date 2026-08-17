/**
 * Low Code reaction store persistence utilities.
 *
 * These helpers write Low Code form data into the VsumDetails store
 * immediately (frontend-only save). Backend persistence happens when
 * the user saves the VSUM / workspace snapshot.
 */

import type { FlowEcoreEdge } from '../types/flow';
import { ActiveVsumDetails } from '../store/ActiveVsumDetails';
import { toWireLowCodeReactionRequestBase } from './lowCodeReactionPayload';

/**
 * Check whether a fine-granular reaction edge already has Low Code
 * form configuration stored.
 */
export function hasLowCodeReactionConfig(edge: FlowEcoreEdge): boolean {
  if (!edge.data?.ecore) return false;

  try {
    const active = new ActiveVsumDetails();
    const { eObjectSourceId, eObjectTargetId, fromModel, toModel } = edge.data.ecore;

    const sourceBackendId = active.getBackendMetaModelId(fromModel);
    const targetBackendId = active.getBackendMetaModelId(toModel);
    if (sourceBackendId === undefined || targetBackendId === undefined) return false;

    const fine = active.getFineGranularMetaModelRelation(
      sourceBackendId,
      targetBackendId,
      eObjectSourceId,
      eObjectTargetId,
    );

    return (
      fine !== undefined &&
      fine.lowCodeReactionRequestBase !== undefined &&
      Object.keys(fine.lowCodeReactionRequestBase).length > 0
    );
  } catch {
    return false;
  }
}

/**
 * Save Low Code form field values into the VsumDetails store for
 * the given fine-granular reaction edge.
 *
 * Creates the parent coarse relation if it doesn't exist yet.
 * Calls `saveToStore()` to commit the change.
 */
export function temporarilySaveLowCodeReactionConfig(
  fieldValues: Record<string, unknown>,
  edge: FlowEcoreEdge,
): void {
  if (!edge.data?.ecore) return;

  const active = new ActiveVsumDetails();
  const { eObjectSourceId, eObjectTargetId, fromModel, toModel } = edge.data.ecore;

  const sourceBackendId = active.getBackendMetaModelId(fromModel);
  const targetBackendId = active.getBackendMetaModelId(toModel);
  if (sourceBackendId === undefined || targetBackendId === undefined) {
    console.warn(
      '[LowCodeReactionUtils] Cannot save — missing backend id mapping for',
      fromModel,
      toModel,
    );
    return;
  }

  const fine = active.getFineGranularMetaModelRelation(
    sourceBackendId,
    targetBackendId,
    eObjectSourceId,
    eObjectTargetId,
  );

  const payload = toWireLowCodeReactionRequestBase(fieldValues) ?? { ...fieldValues };

  if (fine) {
    fine.lowCodeReactionRequestBase = payload;
  } else {
    active.addFineGranularMetaModelRelation(sourceBackendId, targetBackendId, {
      id: null,
      sourceId: eObjectSourceId,
      targetId: eObjectTargetId,
      lowCodeReactionRequestBase: payload,
    });
  }

  active.saveToStore();
}

/**
 * Retrieve the stored Low Code form values for a fine-granular edge.
 * Returns `undefined` if no config has been saved yet.
 */
export function getLowCodeReactionConfig(
  edge: FlowEcoreEdge,
): Record<string, unknown> | undefined {
  if (!edge.data?.ecore) return undefined;

  try {
    const active = new ActiveVsumDetails();
    const { eObjectSourceId, eObjectTargetId, fromModel, toModel } = edge.data.ecore;

    const sourceBackendId = active.getBackendMetaModelId(fromModel);
    const targetBackendId = active.getBackendMetaModelId(toModel);
    if (sourceBackendId === undefined || targetBackendId === undefined) return undefined;

    const fine = active.getFineGranularMetaModelRelation(
      sourceBackendId,
      targetBackendId,
      eObjectSourceId,
      eObjectTargetId,
    );

    return fine?.lowCodeReactionRequestBase as Record<string, unknown> | undefined;
  } catch {
    return undefined;
  }
}
