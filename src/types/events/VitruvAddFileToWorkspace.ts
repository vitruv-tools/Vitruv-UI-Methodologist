import { VsumMetaModelRef } from "../vsum";

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
