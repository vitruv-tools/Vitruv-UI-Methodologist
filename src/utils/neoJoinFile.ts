import { apiService } from '../services/api';
import { resolveReactionFileId } from './reactionFile';

/** Xtext ID derived from a view-type label, used as the NeoJoin package name. */
export function neoJoinPackageName(label: string): string {
  const cleaned = label.trim().replace(/[^\w]+/g, '');
  if (!cleaned || !/^[A-Za-z_]/.test(cleaned)) {
    return cleaned ? `View${cleaned}` : 'View';
  }
  return cleaned;
}

/** File name the backend accepts for a NeoJoin upload or update. */
export function neoJoinFileName(label: string): string {
  return `${neoJoinPackageName(label)}.nj`;
}

/**
 * Empty query a view type opens with. `importUris` are the nsURIs of the linked metamodels.
 */
export function buildNeoJoinSkeleton(label: string, importUris: readonly string[] = []): string {
  const name = neoJoinPackageName(label);
  const imports = importUris
    .map(uri => uri.trim())
    .filter(Boolean)
    .map(uri => `import "${uri}"`);
  const importBlock = imports.length > 0 ? `${imports.join('\n')}\n\n` : '';
  return `export ${name} to "http://vitruv.tools/views/${name}"\n\n${importBlock}create root ${name} {\n}\n`;
}

/** Uploads a new `.nj` file and returns its storage id. */
export async function createNeoJoinFile(code: string, label: string): Promise<number> {
  const file = new File([code], neoJoinFileName(label), { type: 'text/plain;charset=utf-8' });
  const uploadResult = await apiService.uploadFile(file, 'NEO_JOIN');
  const fileId = resolveReactionFileId(uploadResult?.data);
  if (fileId == null) {
    throw new Error('NeoJoin file upload succeeded but did not return a file ID.');
  }
  return fileId;
}

/**
 * Overwrites an existing NeoJoin file. A view type that has no file yet keeps its query
 * locally; creating the file is `createNeoJoinFile`.
 */
export async function persistNeoJoinCode(
  code: string,
  fileId: number | null | undefined,
  label: string,
): Promise<number | null> {
  if (fileId == null) return null;
  const file = new File([code], neoJoinFileName(label), { type: 'text/plain;charset=utf-8' });
  await apiService.updateNeoJoinFile(fileId, file);
  return fileId;
}
