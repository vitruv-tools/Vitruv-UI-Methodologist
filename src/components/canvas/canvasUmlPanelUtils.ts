import type { Node } from 'reactflow';
import type { EcoreFileExpandMeta } from '../../types/canvasTab';

const MODE_TOGGLE_TOP = 14;
const MODE_TOGGLE_HEIGHT = 44;
const PROJECT_TABS_HEIGHT = 38;
const CENTER_STACK_BOTTOM = MODE_TOGGLE_TOP + MODE_TOGGLE_HEIGHT + 4 + PROJECT_TABS_HEIGHT;

export interface ResolvedEcoreMeta {
  metaModelId?: number;
  metaModelSourceId?: number;
  ecoreFileId?: number;
  content: string;
}

export type FetchEcoreFile = (fileId: number) => Promise<string>;

export function computeUmlPanelLayout(openTabCount: number): { top: number; height: number } {
  const top = openTabCount > 0 ? CENTER_STACK_BOTTOM + 8 : MODE_TOGGLE_TOP + MODE_TOGGLE_HEIGHT + 8;
  const bottomUsed = 228;
  return {
    top,
    height: Math.max(200, document.documentElement.clientHeight - top - bottomUsed),
  };
}

export function numberFromNodeData(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

export function enrichEcoreMetaFromCanvas(
  fileName: string,
  fileContent: string,
  meta: EcoreFileExpandMeta | undefined,
  getNodes: () => Node[],
): ResolvedEcoreMeta {
  let metaModelId = meta?.metaModelId;
  let metaModelSourceId = meta?.metaModelSourceId;
  let ecoreFileId = meta?.ecoreFileId;
  let content = fileContent;

  if (ecoreFileId != null && metaModelId != null) {
    return { metaModelId, metaModelSourceId, ecoreFileId, content };
  }

  const node = getNodes().find(
    (canvasNode: Node) => canvasNode.type === 'ecoreFile' && canvasNode.data.fileName === fileName,
  );
  if (!node?.data) {
    return { metaModelId, metaModelSourceId, ecoreFileId, content };
  }

  metaModelId = metaModelId ?? numberFromNodeData(node.data.metaModelId);
  metaModelSourceId = metaModelSourceId ?? numberFromNodeData(node.data.metaModelSourceId);
  ecoreFileId = ecoreFileId ?? numberFromNodeData(node.data.ecoreFileId);
  if (!content?.trim() && typeof node.data.fileContent === 'string') {
    content = node.data.fileContent;
  }
  return { metaModelId, metaModelSourceId, ecoreFileId, content };
}

export async function loadEcoreFileContent(
  fileName: string,
  content: string,
  ecoreFileId: number | undefined,
  fetchEcoreFile: FetchEcoreFile,
  updateEcoreFileData?: (fileName: string, content: string, ecoreFileId: number) => void,
): Promise<string | null> {
  if (content?.trim()) return content;
  if (ecoreFileId == null) return content;

  try {
    const loaded = await fetchEcoreFile(ecoreFileId);
    updateEcoreFileData?.(fileName, loaded, ecoreFileId);
    return loaded;
  } catch {
    return null;
  }
}
