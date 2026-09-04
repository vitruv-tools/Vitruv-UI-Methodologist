import { useProjectStore } from './Project';
import {
  VsumDetailsHelper,
  getVsumDetailsStore,
  hasVsumDetailsStore,
} from './VsumDetails';
import { NoActiveVsumError } from './NoActiveVsumError';

/**
 * Convenience wrapper that binds VsumDetailsHelper to the currently
 * active VSUM from useProjectStore.
 *
 * Usage:
 *   const active = new ActiveVsumDetails();
 *   const rel = active.getMetaModelRelation({ sourceId, targetId });
 *   active.addFineGranularMetaModelRelation(src, tgt, fine);
 *   active.saveToStore();
 */
export class ActiveVsumDetails extends VsumDetailsHelper {
  readonly vsumId: number;

  constructor() {
    const activeId = useProjectStore.getState().activeId;
    if (activeId === null) throw new NoActiveVsumError();
    super(activeId);
    this.vsumId = activeId;
  }
}

/**
 * Returns the Zustand store for the currently active VSUM.
 * Throws if no active VSUM or no store exists.
 */
export function getActiveVsumDetailsStore() {
  const activeId = useProjectStore.getState().activeId;
  if (activeId === null) throw new NoActiveVsumError();
  return getVsumDetailsStore(activeId);
}

/**
 * Returns true if a VsumDetails store exists for the currently active VSUM.
 */
export function hasActiveVsumDetailsStore(): boolean {
  const activeId = useProjectStore.getState().activeId;
  if (activeId === null) return false;
  return hasVsumDetailsStore(activeId);
}
