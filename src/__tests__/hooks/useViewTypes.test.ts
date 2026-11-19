import { renderHook, act, waitFor } from '@testing-library/react';
import type { Mock } from 'vitest';
import { useViewTypes, type ViewType } from '../../hooks/useViewTypes';
import { apiService } from '../../services/api';
import { legacyViewTypesKey, viewTypeAnglesKey } from '../../utils/viewTypeSync';

vi.mock('../../services/api', () => ({
  apiService: {
    getVsumDetails: vi.fn(),
    uploadFile: vi.fn(),
    syncVsumChanges: vi.fn(),
    updateNeoJoinFile: vi.fn(),
  },
}));

Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => 'fixed-id' },
  writable: true,
});

let store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { store = {}; },
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

const VSUM = '9';

function details(views: unknown[]) {
  return { data: { views }, message: 'ok' };
}

const brake = {
  id: 3,
  name: 'Brake',
  fileStorageId: 15,
  assignedModels: [{ id: 1, sourceId: 7, name: 'BrakeMM' }],
};

describe('useViewTypes', () => {
  beforeEach(() => {
    store = {};
    vi.clearAllMocks();
    (apiService.syncVsumChanges as Mock).mockResolvedValue({ message: 'saved' });
    (apiService.uploadFile as Mock).mockResolvedValue({ data: 55, message: 'uploaded' });
  });

  it('loads view types from details and keeps only the angle locally', async () => {
    store[viewTypeAnglesKey(VSUM)] = JSON.stringify({ 3: 1.25 });
    (apiService.getVsumDetails as Mock).mockResolvedValueOnce(details([brake]));

    const { result } = renderHook(() => useViewTypes(VSUM));
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(result.current.viewTypes).toEqual([
      expect.objectContaining({
        id: '3',
        backendId: 3,
        label: 'Brake',
        fileId: 15,
        metaModelSourceIds: [7],
        scope: 'single',
        angle: 1.25,
      }),
    ]);
    expect(store[legacyViewTypesKey(VSUM)]).toBeUndefined();
    expect(JSON.parse(store[viewTypeAnglesKey(VSUM)])['3']).toBeCloseTo(1.25);
  });

  it('does not load a project until details include a views array', async () => {
    (apiService.getVsumDetails as Mock).mockResolvedValueOnce({ data: {}, message: 'ok' });

    const { result } = renderHook(() => useViewTypes(VSUM));
    await waitFor(() => expect(apiService.getVsumDetails).toHaveBeenCalled());
    expect(result.current.isLoaded).toBe(false);
  });

  it('creates a .nj file and sends the full view list', async () => {
    (apiService.getVsumDetails as Mock)
      .mockResolvedValueOnce(details([brake]))
      .mockResolvedValueOnce(details([
        brake,
        { id: 4, name: 'Wheel', fileStorageId: 55, assignedModels: [{ sourceId: 8 }] },
      ]));

    const { result } = renderHook(() => useViewTypes(VSUM, () => ({
      metaModelIds: [7, 8],
      metaModelRelationRequests: [{ sourceId: 7, targetId: 8, reactionFileId: null }],
    })));
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await act(async () => {
      await result.current.addViewType({
        label: 'Wheel',
        scope: 'single',
        angle: 0.4,
        linkedNodeIds: ['ecore-8'],
        editable: true,
        metamodels: [{ nodeId: 'ecore-8', sourceId: 8, nsUri: 'http://mm/wheel' }],
      });
    });

    expect(apiService.uploadFile).toHaveBeenCalledTimes(1);
    const [file, type] = (apiService.uploadFile as Mock).mock.calls[0];
    expect(type).toBe('NEO_JOIN');
    expect((file as File).name).toBe('Wheel.nj');
    expect(await (file as File).text()).toContain('import "http://mm/wheel"');
    expect(await (file as File).text()).toContain('export Wheel to "http://vitruv.tools/views/Wheel"');

    const body = (apiService.syncVsumChanges as Mock).mock.calls[0][1];
    expect(body.metaModelIds).toEqual([7, 8]);
    expect(body.viewRequests).toEqual([
      { id: 3, name: 'Brake', metaModelIds: [7], fileStorageId: 15 },
      { name: 'Wheel', metaModelIds: [8], fileStorageId: 55 },
    ]);
    expect(result.current.viewTypes.map(vt => vt.label)).toEqual(['Brake', 'Wheel']);
  });

  it('sends the remaining views when one is deleted', async () => {
    (apiService.getVsumDetails as Mock)
      .mockResolvedValueOnce(details([
        brake,
        { id: 4, name: 'Wheel', fileStorageId: 55, assignedModels: [{ sourceId: 8 }] },
      ]))
      .mockResolvedValueOnce(details([brake]));

    const { result } = renderHook(() => useViewTypes(VSUM));
    await waitFor(() => expect(result.current.viewTypes).toHaveLength(2));

    await act(async () => {
      await result.current.deleteViewType('4');
    });

    const body = (apiService.syncVsumChanges as Mock).mock.calls.at(-1)?.[1];
    expect(body.viewRequests).toEqual([
      { id: 3, name: 'Brake', metaModelIds: [7], fileStorageId: 15 },
    ]);
  });

  it('stores a dragged angle without saving the project', async () => {
    (apiService.getVsumDetails as Mock).mockResolvedValueOnce(details([brake]));
    const { result } = renderHook(() => useViewTypes(VSUM));
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => { result.current.updateAngle('3', 2.5); });

    expect(result.current.viewTypes[0].angle).toBeCloseTo(2.5);
    expect(JSON.parse(store[viewTypeAnglesKey(VSUM)])['3']).toBeCloseTo(2.5);
    expect(apiService.syncVsumChanges).not.toHaveBeenCalled();
  });

  it('migrates a localStorage view type once and then drops the old record', async () => {
    const legacy: ViewType = {
      id: 'vt-old',
      label: 'Legacy',
      scope: 'single',
      angle: 0.8,
      linkedNodeIds: ['ecore-8'],
      editable: false,
    };
    store[legacyViewTypesKey(VSUM)] = JSON.stringify([legacy]);
    (apiService.getVsumDetails as Mock)
      .mockResolvedValueOnce(details([]))
      .mockResolvedValueOnce(details([
        { id: 9, name: 'Legacy', fileStorageId: 55, assignedModels: [{ sourceId: 8 }] },
      ]));

    const { result } = renderHook(() => useViewTypes(VSUM));
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await act(async () => {
      await result.current.migrateLegacyViewTypes([
        { nodeId: 'ecore-8', sourceId: 8, nsUri: 'http://mm/legacy' },
      ]);
    });

    expect(apiService.uploadFile).toHaveBeenCalledTimes(1);
    expect(store[legacyViewTypesKey(VSUM)]).toBeUndefined();
    expect(result.current.viewTypes[0]).toEqual(expect.objectContaining({
      id: '9',
      label: 'Legacy',
      fileId: 55,
      angle: 0.8,
    }));
  });

  it('waits to migrate a view until every linked metamodel is on the canvas', async () => {
    const legacy: ViewType = {
      id: 'vt-old',
      label: 'Legacy',
      scope: 'multi',
      angle: 0.2,
      linkedNodeIds: ['ecore-8', 'ecore-9'],
      editable: false,
    };
    store[legacyViewTypesKey(VSUM)] = JSON.stringify([legacy]);
    (apiService.getVsumDetails as Mock)
      .mockResolvedValueOnce(details([]))
      .mockResolvedValueOnce(details([
        {
          id: 9,
          name: 'Legacy',
          fileStorageId: 55,
          assignedModels: [{ sourceId: 8 }, { sourceId: 9 }],
        },
      ]));

    const { result } = renderHook(() => useViewTypes(VSUM));
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await act(async () => {
      await result.current.migrateLegacyViewTypes([
        { nodeId: 'ecore-8', sourceId: 8, nsUri: 'http://mm/a' },
      ]);
    });
    expect(apiService.uploadFile).not.toHaveBeenCalled();
    expect(store[legacyViewTypesKey(VSUM)]).toBeDefined();

    await act(async () => {
      await result.current.migrateLegacyViewTypes([
        { nodeId: 'ecore-8', sourceId: 8, nsUri: 'http://mm/a' },
        { nodeId: 'ecore-9', sourceId: 9, nsUri: 'http://mm/b' },
      ]);
    });
    expect(apiService.uploadFile).toHaveBeenCalledTimes(1);
    expect(store[legacyViewTypesKey(VSUM)]).toBeUndefined();
  });
});
