import type { Node } from 'reactflow';
import {
  computeUmlPanelLayout,
  enrichEcoreMetaFromCanvas,
  loadEcoreFileContent,
} from '../../../components/canvas/canvasUmlPanelUtils';

const clientHeightDescriptor = Object.getOwnPropertyDescriptor(
  document.documentElement,
  'clientHeight',
);

beforeAll(() => {
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: 1000,
  });
});

afterAll(() => {
  if (clientHeightDescriptor) {
    Object.defineProperty(document.documentElement, 'clientHeight', clientHeightDescriptor);
  } else {
    Reflect.deleteProperty(document.documentElement, 'clientHeight');
  }
});

describe('canvasUmlPanelUtils', () => {
  it('calculates UML panel layout with and without open tabs', () => {
    expect(computeUmlPanelLayout(0)).toEqual({
      top: 66,
      height: 706,
    });
    expect(computeUmlPanelLayout(2)).toEqual({
      top: 108,
      height: 664,
    });
  });

  it('preserves metadata already supplied by the expand event', () => {
    const getNodes = jest.fn((): Node[] => []);

    expect(enrichEcoreMetaFromCanvas(
      'library.ecore',
      '<ecore />',
      {
        metaModelId: 10,
        metaModelSourceId: 20,
        ecoreFileId: 30,
      },
      getNodes,
    )).toEqual({
      metaModelId: 10,
      metaModelSourceId: 20,
      ecoreFileId: 30,
      content: '<ecore />',
    });
    expect(getNodes).not.toHaveBeenCalled();
  });

  it('falls back to metadata and content from a matching Ecore canvas node', () => {
    const canvasNode: Node = {
      id: 'node-1',
      type: 'ecoreFile',
      position: { x: 0, y: 0 },
      data: {
        fileName: 'library.ecore',
        fileContent: '<canvas-content />',
        metaModelId: 11,
        metaModelSourceId: 21,
        ecoreFileId: 31,
      },
    };

    expect(enrichEcoreMetaFromCanvas(
      'library.ecore',
      '',
      undefined,
      () => [canvasNode],
    )).toEqual({
      metaModelId: 11,
      metaModelSourceId: 21,
      ecoreFileId: 31,
      content: '<canvas-content />',
    });
  });

  it('fetches empty Ecore content and synchronizes it back to the canvas', async () => {
    const fetchEcoreFile = jest.fn().mockResolvedValue('<fetched-content />');
    const updateEcoreFileData = jest.fn();

    await expect(loadEcoreFileContent(
      'library.ecore',
      '',
      31,
      fetchEcoreFile,
      updateEcoreFileData,
    )).resolves.toBe('<fetched-content />');
    expect(fetchEcoreFile).toHaveBeenCalledWith(31);
    expect(updateEcoreFileData).toHaveBeenCalledWith(
      'library.ecore',
      '<fetched-content />',
      31,
    );
  });

  it('returns null when Ecore content loading fails', async () => {
    const fetchEcoreFile = jest.fn().mockRejectedValue(new Error('Network error'));

    await expect(loadEcoreFileContent(
      'library.ecore',
      '',
      31,
      fetchEcoreFile,
    )).resolves.toBeNull();
  });

  it('preserves current content when no Ecore file ID is available', async () => {
    const fetchEcoreFile = jest.fn();
    const updateEcoreFileData = jest.fn();

    await expect(loadEcoreFileContent(
      'library.ecore',
      '   ',
      undefined,
      fetchEcoreFile,
      updateEcoreFileData,
    )).resolves.toBe('   ');
    expect(fetchEcoreFile).not.toHaveBeenCalled();
    expect(updateEcoreFileData).not.toHaveBeenCalled();
  });
});
