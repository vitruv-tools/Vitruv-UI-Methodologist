import type { Node } from 'reactflow';
import { collectMetamodelInputs, metamodelDedupeKey } from '../methodologistMetrics';
import { EcoreReadError, readMetamodelGraph } from './ecore/readMetamodelGraph';
import type { ProjectMetamodel } from './overviewTypes';
import { sha256Hex } from './sha256';

export const NO_CLASSES_MESSAGE = 'The metamodel contains no classes.';

const numberOrZero = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const displayName = (fileName: string) => fileName.replace(/\.ecore$/i, '');

/** Sorts by name, then key, so pairs, matrix and exports have a stable order. */
export const compareMetamodels = (a: { name: string; key: string }, b: { name: string; key: string }) =>
  a.name.localeCompare(b.name) || a.key.localeCompare(b.key);

/**
 * The distinct metamodels on a project's canvas, as they are now (unsaved edits included),
 * de-duplicated like the Metrics mode and parsed for the overlap analysis. A file that cannot be
 * read keeps `graph: null` and the reason in `error`.
 */
export async function projectMetamodels(nodes: Node[]): Promise<ProjectMetamodel[]> {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const metamodels = await Promise.all(collectMetamodelInputs(nodes).map(async input => {
    const node = byId.get(input.id)!;
    const name = displayName(input.fileName);
    const ref = {
      libraryId: numberOrZero(node.data?.metaModelId),
      name,
      ecoreFileId: numberOrZero(node.data?.ecoreFileId),
      contentHash: await sha256Hex(input.fileContent),
    };
    const metamodel: ProjectMetamodel = { key: metamodelDedupeKey(node), name, ref, graph: null, error: null };
    try {
      const graph = readMetamodelGraph(input.fileContent, ref);
      if (graph.classes.length === 0) metamodel.error = NO_CLASSES_MESSAGE;
      else metamodel.graph = graph;
    } catch (error) {
      if (!(error instanceof EcoreReadError)) throw error;
      metamodel.error = error.message;
    }
    return metamodel;
  }));
  return metamodels.sort(compareMetamodels);
}
