import { apiService } from '../services/api';
import type { VsumDetails, VsumMetaModelRef } from '../types';
import { appendMetaModelVersion } from './metaModelVersion';
import { mapRelationsForCanvasLoad } from './workspaceSnapshotUtils';

/** Time the canvas gets to place one box before the next one is added. */
const BOX_DELAY_MS = 50;

const delay = (ms: number) => new Promise<void>(resolve => {
  setTimeout(resolve, ms);
});

function dispatchMetaModelBox(model: VsumMetaModelRef, fileContent: string): void {
  globalThis.dispatchEvent(new CustomEvent('vitruv.addFileToWorkspace', {
    detail: {
      fileContent,
      fileName: `${appendMetaModelVersion(model.name, model.version)}.ecore`,
      displayName: model.name,
      version: model.version,
      description: model.description,
      keywords: model.keyword?.join(', '),
      domain: model.domain,
      createdAt: model.createdAt,
      metaModelId: model.id,
      metaModelSourceId: model.sourceId ?? model.id,
      ecoreFileId: model.ecoreFileId,
      genModelFileId: model.genModelFileId,
      fromServerLoad: true,
    },
  }));
}

/**
 * Puts a box on the canvas for each metamodel with an ecore file, by announcing it with
 * `vitruv.addFileToWorkspace` (marked `fromServerLoad`). The files are read at once; a metamodel
 * whose file cannot be read gets no box. The boxes are added in the given order, one every
 * {@link BOX_DELAY_MS}, so the canvas places each before the next arrives.
 */
export async function dispatchWorkspaceMetaModels(metaModels: VsumMetaModelRef[]): Promise<void> {
  const withFile = metaModels.filter(model => model.ecoreFileId);
  const contents = await Promise.all(
    withFile.map(model => apiService.getFile(model.ecoreFileId as number).catch(() => null)),
  );
  const boxes = withFile.flatMap((model, index) => {
    const fileContent = contents[index];
    return fileContent == null ? [] : [{ model, fileContent }];
  });
  await Promise.all(boxes.map(({ model, fileContent }, index) =>
    delay(index * BOX_DELAY_MS).then(() => dispatchMetaModelBox(model, fileContent))));
  if (boxes.length > 0) await delay(BOX_DELAY_MS);
}

/** Shows the relations between the metamodel boxes (`vitruv.loadMetaModelRelations`). */
export async function dispatchMetaModelRelations(
  relations: VsumDetails['metaModelsRelation'],
): Promise<void> {
  if (!relations?.length) return;
  globalThis.dispatchEvent(new CustomEvent('vitruv.loadMetaModelRelations', {
    detail: {
      relations: mapRelationsForCanvasLoad(relations),
      preserveExisting: false,
    },
  }));
  await new Promise(r => setTimeout(r, 150));
}
