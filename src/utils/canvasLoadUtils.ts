import { Node } from 'reactflow';
import { VsumMetaModelRef } from '../types/vsum';

/**
 * Waits until each metamodel with an ecore file has a matching box on the canvas.
 * Avoids dispatching relation load before nodes exist (connections would be skipped).
 */
export async function waitForMetaModelsOnCanvas(
  getNodes: () => Node[],
  metaModels: VsumMetaModelRef[],
  options?: { maxWaitMs?: number; pollMs?: number },
): Promise<void> {
  const withEcore = metaModels.filter(m => m.ecoreFileId);
  if (withEcore.length === 0) return;

  const maxWaitMs = options?.maxWaitMs ?? 8000;
  const pollMs = options?.pollMs ?? 100;
  const deadline = Date.now() + maxWaitMs;

  const isReady = () => {
    const ecoreNodes = getNodes().filter(n => n.type === 'ecoreFile');
    return withEcore.every(m => {
      const sourceId = m.sourceId ?? m.id;
      return ecoreNodes.some(
        n =>
          n.data?.metaModelId === m.id ||
          n.data?.metaModelSourceId === sourceId ||
          n.data?.metaModelSourceId === m.id,
      );
    });
  };

  while (Date.now() < deadline) {
    if (isReady()) return;
    await new Promise(r => setTimeout(r, pollMs));
  }

  console.warn('Timed out waiting for metamodel boxes on canvas before loading relations');
}
