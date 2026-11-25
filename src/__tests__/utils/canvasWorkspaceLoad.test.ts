import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchWorkspaceMetaModels } from '../../utils/canvasWorkspaceLoad';
import type { VsumMetaModelRef } from '../../types';

const { mockGetFile } = vi.hoisted(() => ({ mockGetFile: vi.fn() }));

vi.mock('../../services/api', () => ({
  apiService: { getFile: mockGetFile },
}));

function metaModel(id: number, ecoreFileId?: number): VsumMetaModelRef {
  return { id, sourceId: id, name: `mm${id}`, ecoreFileId } as unknown as VsumMetaModelRef;
}

describe('dispatchWorkspaceMetaModels', () => {
  const added: Array<Record<string, unknown>> = [];
  const listener = (event: Event) => added.push((event as CustomEvent).detail);

  beforeEach(() => {
    added.length = 0;
    mockGetFile.mockReset();
    globalThis.addEventListener('vitruv.addFileToWorkspace', listener);
  });

  afterEach(() => {
    globalThis.removeEventListener('vitruv.addFileToWorkspace', listener);
  });

  it('adds a box for each metamodel with an ecore file, in the given order', async () => {
    mockGetFile.mockImplementation(async (id: number) => `<ecore ${id}/>`);

    await dispatchWorkspaceMetaModels([metaModel(1, 11), metaModel(2), metaModel(3, 33)]);

    expect(added.map(detail => [detail.metaModelId, detail.fileContent])).toEqual([
      [1, '<ecore 11/>'],
      [3, '<ecore 33/>'],
    ]);
    expect(added[0]).toMatchObject({ fileName: 'mm1.ecore', ecoreFileId: 11, fromServerLoad: true });
  });

  it('skips a metamodel whose ecore file cannot be read', async () => {
    mockGetFile.mockImplementation(async (id: number) => {
      if (id === 11) throw new Error('Not found');
      return `<ecore ${id}/>`;
    });

    await dispatchWorkspaceMetaModels([metaModel(1, 11), metaModel(3, 33)]);

    expect(added.map(detail => detail.metaModelId)).toEqual([3]);
  });

  it('reads all ecore files at once instead of one after another', async () => {
    const pending: Array<(content: string) => void> = [];
    mockGetFile.mockImplementation(() => new Promise<string>(resolve => pending.push(resolve)));

    const done = dispatchWorkspaceMetaModels([metaModel(1, 11), metaModel(3, 33)]);
    await Promise.resolve();

    expect(mockGetFile).toHaveBeenCalledTimes(2);
    pending.forEach(resolve => resolve('<ecore/>'));
    await done;
    expect(added).toHaveLength(2);
  });
});
