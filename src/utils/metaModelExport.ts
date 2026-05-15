import { downloadTextAsFile } from './downloadTextAsFile';

export type MetaModelExportKind = 'ecore' | 'genmodel';

export interface MetaModelWithFileIds {
  name: string;
  ecoreFileId?: number;
  genModelFileId?: number;
  domain?: string;
  createdAt?: string;
}

const KIND_CONFIG = {
  ecore: { fileIdKey: 'ecoreFileId' as const, ext: '.ecore', label: '.ecore' },
  genmodel: { fileIdKey: 'genModelFileId' as const, ext: '.genmodel', label: '.genmodel' },
} as const;

const UNSAFE_FILE_NAME_CHARS = new Set('<>:"/\\|?*');

function isUnsafeFileNameChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return code < 32 || UNSAFE_FILE_NAME_CHARS.has(char);
}

export function sanitizeFileBaseName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'metamodel';
  return Array.from(trimmed)
    .map((char) => (isUnsafeFileNameChar(char) ? '_' : char))
    .join('');
}

export function buildMetaModelDownloadFileName(
  modelName: string,
  kind: MetaModelExportKind,
): string {
  return `${sanitizeFileBaseName(modelName)}${KIND_CONFIG[kind].ext}`;
}

export function getMetaModelFileId(
  model: MetaModelWithFileIds,
  kind: MetaModelExportKind,
): number | undefined {
  const key = KIND_CONFIG[kind].fileIdKey;
  const id = model[key];
  return id && id > 0 ? id : undefined;
}

export function hasMetaModelFile(
  model: MetaModelWithFileIds,
  kind: MetaModelExportKind,
): boolean {
  return getMetaModelFileId(model, kind) !== undefined;
}

export async function downloadMetaModelFile(
  model: MetaModelWithFileIds,
  kind: MetaModelExportKind,
  getFile: (id: number | string) => Promise<string>,
): Promise<void> {
  const fileId = getMetaModelFileId(model, kind);
  if (!fileId) {
    throw new Error(`No ${KIND_CONFIG[kind].label} file is available for this meta model.`);
  }
  const content = await getFile(fileId);
  downloadTextAsFile(content, buildMetaModelDownloadFileName(model.name, kind));
}

export function getMetaModelExportLabel(kind: MetaModelExportKind): string {
  return `Download ${KIND_CONFIG[kind].label}`;
}
