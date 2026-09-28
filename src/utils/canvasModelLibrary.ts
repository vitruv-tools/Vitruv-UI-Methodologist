import type { DrawerModel } from '../components/canvas/ModelDrawer';
import { apiService } from '../services/api';
import type { VsumMetaModelRef } from '../types/vsum';

interface CanvasModelLibraryCollections {
  myModels: DrawerModel[];
  publicModels: DrawerModel[];
}

export function metaModelToDrawerModel(
  metaModel: VsumMetaModelRef,
  inProject: boolean,
): DrawerModel {
  return {
    id: metaModel.id,
    name: metaModel.name,
    sourceId: metaModel.sourceId ?? metaModel.id,
    domain: metaModel.domain,
    ecoreFileId: metaModel.ecoreFileId,
    genModelFileId: metaModel.genModelFileId,
    inProject,
    description: metaModel.description,
    keyword: metaModel.keyword,
    createdAt: metaModel.createdAt,
  };
}

export async function fetchLibraryDrawerModels(): Promise<CanvasModelLibraryCollections> {
  const toDrawerModel = (metaModel: VsumMetaModelRef) =>
    metaModelToDrawerModel(metaModel, false);
  const [myModelsResult, publicModelsResult] = await Promise.allSettled([
    apiService.findMetaModels({ ownedByUser: true }),
    apiService.findMetaModels({ ownedByUser: false }),
  ]);

  return {
    myModels: myModelsResult.status === 'fulfilled'
      ? (myModelsResult.value.data || []).map(toDrawerModel)
      : [],
    publicModels: publicModelsResult.status === 'fulfilled'
      ? (publicModelsResult.value.data || []).map(toDrawerModel)
      : [],
  };
}

export const fetchEcoreFileById = (fileId: number): Promise<string> =>
  apiService.getFile(fileId);
