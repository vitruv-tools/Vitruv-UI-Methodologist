import { NoActiveVsumError } from "./NoActiveVsumError";
import { projectStore } from "./Project";
import { VsumDetailsHelper } from "./VsumDetails";

export class ActiveVsumDetails extends VsumDetailsHelper {
  constructor() {
    const activeVsumId = projectStore.getState().activeId; // Ensure we have the latest activeInstanceId for any side effects
    if (!activeVsumId) {
      throw new NoActiveVsumError("No active VSUM ID found");
    }
    super(activeVsumId);
  }
}
