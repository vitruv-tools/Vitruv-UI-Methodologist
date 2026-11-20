import { apiService } from '../services/api';
import type { VsumMetaModelRef } from '../types/vsum';

/**
 * Finds a metamodel of a project by its library ID in what the backend has saved of the project.
 *
 * Used for a metamodel another user just added: it may be private to them, so it isn't in the
 * library of this user, and the backend can't look up a single metamodel. The collaboration
 * server saves the change a few seconds after it is made, so this asks until it shows up.
 * Resolves `null` if that doesn't happen in time.
 */
export async function findProjectMetaModel(
  projectId: number,
  sourceId: number,
  { timeoutMs = 20_000, intervalMs = 500 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<VsumMetaModelRef | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await apiService.getVsumDetails(projectId);
      const found = (response?.data?.metaModels ?? []).find(
        (model: VsumMetaModelRef) => (model.sourceId ?? model.id) === sourceId,
      );
      if (found) return found;
    } catch {
      // The backend may be busy; ask again until the time is up.
    }
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => globalThis.setTimeout(resolve, intervalMs));
  }
}
