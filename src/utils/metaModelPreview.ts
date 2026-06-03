import { apiService } from '../services/api';
import { downloadTextAsFile } from './downloadFile';
import { hasSavedUmlLayout } from './umlLayoutStorage';

/** localStorage scope for UML box positions in metamodel preview modals */
export const METAMODEL_PREVIEW_LAYOUT_SCOPE = 'metamodel-preview';

/** Stable layout key per metamodel (preview modals, library, tools panel, drawer). */
export function metaModelPreviewLayoutFileName(
  modelId: number | string,
  modelName?: string,
): string {
  const id = String(modelId);
  const safe =
    (modelName || 'model').trim().replace(/[^a-zA-Z0-9._-]/g, '_') || 'model';
  return `metamodel-${id}-${safe}`;
}

export function shouldFitMetaModelPreview(
  modelId: number | string,
  modelName?: string,
): boolean {
  return !hasSavedUmlLayout(
    METAMODEL_PREVIEW_LAYOUT_SCOPE,
    metaModelPreviewLayoutFileName(modelId, modelName),
  );
}

export async function downloadMetaModelArtifact(
  kind: 'ecore' | 'genmodel',
  fileId: number | undefined,
  modelName: string,
): Promise<void> {
  if (!fileId) return;
  const base = modelName.replace(/\.ecore$/i, '').trim() || 'model';
  const ext = kind === 'ecore' ? '.ecore' : '.genmodel';
  const content = await apiService.getFile(fileId);
  downloadTextAsFile(content, `${base}${ext}`);
}
