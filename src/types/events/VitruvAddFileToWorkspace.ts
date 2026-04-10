import { VsumMetaModelRef } from "../vsum";

/**
 * Event payload for adding a file and its metadata to the current workspace.
 */
export type VitruvAddFileToWorkspaceEvent = {
  fileContent: string;
  fileName: string;
  description: string;
  keywords: string;
  domain: string;
  metaModelId: number;
  metaModelSourceId: number;
  createdAt: string;
  model: VsumMetaModelRef;
};
