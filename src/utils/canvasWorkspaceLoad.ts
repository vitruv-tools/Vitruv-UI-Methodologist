import { apiService } from '../services/api';
import type { VsumDetails, VsumMetaModelRef } from '../types';
import { appendMetaModelVersion } from './metaModelVersion';
import { mapRelationsForCanvasLoad } from './workspaceSnapshotUtils';

/**
 * Puts a box on the canvas for each metamodel with an ecore file, by reading the file and
 * announcing it with `vitruv.addFileToWorkspace` (marked `fromServerLoad`). A file that cannot be
 * read is skipped.
 */
export async function dispatchWorkspaceMetaModels(metaModels: VsumMetaModelRef[]): Promise<void> {
  for (const model of metaModels) {
    if (!model.ecoreFileId) continue;
    try {
      const fileContent = await apiService.getFile(model.ecoreFileId);
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
      await new Promise(r => setTimeout(r, 50));
    } catch {
      // model without readable ecore file – skip canvas box
    }
  }
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
