import { NoActiveVsumError } from "./NoActiveVsumError";
import { useProjectStore } from "./Project";
import { VsumDetailsHelper } from "./VsumDetails";

/**
 * Helper bound to the currently active VSUM from the project store.
 */
export class ActiveVsumDetails extends VsumDetailsHelper {
  /**
   * Creates a helper for the active VSUM and fails when no active VSUM is selected.
   */
  constructor() {
    const activeVsumId = useProjectStore.getState().activeId; // Ensure we have the latest activeInstanceId for any side effects
    if (!activeVsumId) {
      throw new NoActiveVsumError("No active VSUM ID found");
    }
    super(activeVsumId);
  }
}
