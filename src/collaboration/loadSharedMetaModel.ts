import type { DrawerModel } from '../components/canvas/ModelDrawer';
import { apiService } from '../services/api';
import { appendMetaModelVersion } from '../utils/metaModelVersion';
import type { ResolvedMetaModel } from './canvasPort';
import type { ModelState } from './projectState';

/**
 * Loads a metamodel another user added to the project, to put it on the canvas.
 *
 * The ecore file is the one of the project's copy (`model.copy`), which every member of the project
 * may read; the library's file may only be read by its owner. Version, domain and description are
 * taken from the library entry of the metamodel, if this user knows it (`knownModels`), as the
 * shared document doesn't have them. Resolves `null` for a metamodel without copy.
 *
 * @throws Error if the file can't be loaded
 */
export async function loadSharedMetaModel(model: ModelState, knownModels: DrawerModel[]): Promise<ResolvedMetaModel | null> {
  const { copy } = model;
  if (copy === undefined) {
    return null;
  }
  const known = knownModels.find((candidate) => (candidate.sourceId ?? candidate.id) === model.sourceId);
  const fileContent = await apiService.getFile(copy.ecoreFileId);
  return {
    fileName: `${appendMetaModelVersion(model.name, known?.version)}.ecore`,
    fileContent,
    meta: {
      version: known?.version,
      domain: known?.domain,
      description: known?.description,
      // Like a project loaded from the backend: the copy's ID, and the library ID the shared
      // project and sync-changes use.
      metaModelId: copy.projectMetaModelId ?? model.sourceId,
      metaModelSourceId: model.sourceId,
      ecoreFileId: copy.ecoreFileId,
      genModelFileId: copy.genModelFileId ?? undefined,
    },
  };
}
