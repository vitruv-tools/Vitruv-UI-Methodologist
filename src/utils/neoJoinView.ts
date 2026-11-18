import type { Node } from 'reactflow';
import { apiService, type ViewRequest } from '../services/api';
import type { ViewType } from '../hooks/useViewTypes';
import type { BuildProblem } from '../types/vsumBuild';
import { isViewsProblem } from './buildProblems';
import { resolveReactionFileId } from './reactionFile';

const NEO_JOIN_EXTENSION = '.nj';

/** Removes leading and trailing underscores; a loop instead of a regex, which would backtrack. */
function trimUnderscores(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && text[start] === '_') start++;
  while (end > start && text[end - 1] === '_') end--;
  return text.slice(start, end);
}

/** Matches the backend: a NeoJoin file name must start with a letter and may not contain spaces. */
function toIdentifier(label: string): string {
  const cleaned = trimUnderscores(label.replaceAll(/\W+/g, '_'));
  if (!cleaned) return 'View';
  return /^[A-Za-z]/.test(cleaned) ? cleaned : `View_${cleaned}`;
}

/** Name of the export of a view type: its label as an identifier, unique among the view types. */
export function neoJoinExportName(viewType: ViewType, viewTypes: readonly ViewType[]): string {
  const base = toIdentifier(viewType.label);
  const index = viewTypes.findIndex(vt => vt.id === viewType.id);
  const taken = viewTypes.slice(0, Math.max(index, 0)).filter(vt => toIdentifier(vt.label) === base).length;
  return taken === 0 ? base : `${base}_${taken + 1}`;
}

export function neoJoinFileName(exportName: string): string {
  return `${exportName}${NEO_JOIN_EXTENSION}`;
}

/** Name of the first class in an ecore file; each tag is checked on its own to keep the regexes linear. */
function firstClassName(ecore: string): string | null {
  for (const [tag] of ecore.matchAll(/<eClassifiers\b[^>]*>/g)) {
    if (!tag.includes('ecore:EClass')) continue;
    const name = /\sname="([A-Za-z_]\w*)"/.exec(tag);
    if (name) return name[1];
  }
  return null;
}

/** The metamodels (canvas boxes) a view type is linked to. */
export function linkedMetaModelNodes(viewType: ViewType, nodes: readonly Node[]): Node[] {
  return viewType.linkedNodeIds
    .map(id => nodes.find(n => n.id === id && n.type === 'ecoreFile'))
    .filter((n): n is Node => n !== undefined);
}

/** A starting point for a new view definition: it imports the linked metamodels and selects a class. */
export function buildInitialNeoJoinCode(
  viewType: ViewType,
  viewTypes: readonly ViewType[],
  nodes: readonly Node[],
): string {
  const name = neoJoinExportName(viewType, viewTypes);
  const linked = linkedMetaModelNodes(viewType, nodes);
  const lines = [`export ${name} to "http://methodologist.vitruv/views/${name}"`, ''];
  for (const node of linked) {
    const nsUri = node.data?.nsUri;
    if (typeof nsUri === 'string' && nsUri) lines.push(`import "${nsUri}"`);
  }
  const className = linked
    .map(node => firstClassName(String(node.data?.fileContent ?? '')))
    .find((c): c is string => c !== null);
  if (className) {
    lines.push('', `from ${className} c`, `create ${name}View`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Stores the NeoJoin definition of a view type: a new file for the first save, otherwise the
 * existing file is overwritten and keeps its id.
 */
export async function persistNeoJoinCode(
  code: string,
  fileName: string,
  fileStorageId: number | null | undefined,
): Promise<number> {
  const file = new File([code], fileName, { type: 'text/plain;charset=utf-8' });
  if (fileStorageId == null) {
    const uploadResult = await apiService.uploadFile(file, 'NEO_JOIN');
    const newId = resolveReactionFileId(uploadResult?.data);
    if (newId == null) {
      throw new Error('NeoJoin file upload succeeded but did not return a file ID.');
    }
    return newId;
  }
  await apiService.updateNeoJoinFile(fileStorageId, file);
  return fileStorageId;
}

/** Reads the stored definition of a view type, or the generated starting point if it has none yet. */
export async function fetchNeoJoinCode(
  viewType: ViewType,
  buildDefault: () => string,
): Promise<string> {
  if (viewType.fileStorageId != null) {
    try {
      const stored = await apiService.getFile(viewType.fileStorageId);
      if (stored.trim()) return stored;
    } catch (error) {
      console.error('Failed to fetch NeoJoin file', error);
    }
  }
  return buildDefault();
}

/**
 * Number of views stored in the project, which is what a build turns into view types; undefined if
 * the project details cannot be read, so a message can leave the number out.
 */
export async function fetchStoredViewCount(vsumId: number): Promise<number | undefined> {
  try {
    const details = await apiService.getVsumDetails(vsumId);
    const views = details?.data?.views;
    return Array.isArray(views) ? views.length : undefined;
  } catch {
    return undefined;
  }
}

/** The views for `sync-changes`: every view type that already has a stored NeoJoin file. */
export function buildViewRequests(
  viewTypes: readonly ViewType[],
  nodes: readonly Node[],
): ViewRequest[] {
  return viewTypes.flatMap(viewType => {
    if (viewType.fileStorageId == null) return [];
    const metaModelIds = Array.from(new Set(
      linkedMetaModelNodes(viewType, nodes)
        .map(n => n.data?.metaModelSourceId ?? n.data?.metaModelId)
        .filter((id): id is number => typeof id === 'number'),
    ));
    if (metaModelIds.length === 0) return [];
    return [{
      // The file name is fixed at the first save, so the view keeps its name when others are deleted.
      name: viewType.fileName?.replace(/\.nj$/, '') ?? neoJoinExportName(viewType, viewTypes),
      metaModelIds,
      fileStorageId: viewType.fileStorageId,
    }];
  });
}

/** Whether a VIEWS problem belongs to the NeoJoin file of this view type. */
function problemBelongsTo(problem: BuildProblem, viewType: ViewType): boolean {
  if (problem.fileId != null && viewType.fileStorageId != null) {
    return problem.fileId === viewType.fileStorageId;
  }
  return Boolean(problem.file && viewType.fileName && problem.file === viewType.fileName);
}

/** Number of build problems per view type id, for the markers on the bubbles. */
export function countViewProblems(
  problems: readonly BuildProblem[],
  viewTypes: readonly ViewType[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const problem of problems) {
    if (!isViewsProblem(problem)) continue;
    const owner = viewTypes.find(vt => problemBelongsTo(problem, vt));
    if (owner) counts[owner.id] = (counts[owner.id] ?? 0) + 1;
  }
  return counts;
}
