import { renderHook, act } from '@testing-library/react';
import { useViewTypes, ViewType } from '../../hooks/useViewTypes';

// ── crypto mock (jsdom does not implement crypto.randomUUID) ──────────────────

Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => `${Math.random().toString(36).slice(2)}-${Date.now()}` },
    writable: true,
});

// ── localStorage mock ─────────────────────────────────────────────────────────

let store: Record<string, string> = {};

const localStorageMock = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
};

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const VSUMID = 'vsum-1';
const STORAGE_KEY = `vitruv_view_types_v1_${VSUMID}`;

const makeViewType = (overrides?: Partial<Omit<ViewType, 'id'>>): Omit<ViewType, 'id'> => ({
    label: 'VT1',
    scope: 'single',
    angle: 0,
    linkedNodeIds: ['node-1'],
    editable: false,
    ...overrides,
});

const makeStoredViewType = (overrides?: Partial<ViewType>): ViewType => ({
    id: 'vt-existing',
    label: 'VT1',
    scope: 'single',
    angle: 0,
    linkedNodeIds: [],
    editable: false,
    ...overrides,
});

const getStored = (): ViewType[] =>
    JSON.parse(store[STORAGE_KEY] ?? '[]');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useViewTypes', () => {
    beforeEach(() => {
        store = {};
    });

    afterEach(() => {
        store = {};
    });

    // Initial state

    it('returns empty viewTypes when vsumId is undefined', () => {
        const { result } = renderHook(() => useViewTypes(undefined));
        expect(result.current.viewTypes).toEqual([]);
    });

    it('returns empty viewTypes when nothing is stored', () => {
        const { result } = renderHook(() => useViewTypes(VSUMID));
        expect(result.current.viewTypes).toEqual([]);
    });

    it('loads persisted viewTypes on mount', () => {
        const stored = [makeStoredViewType()];
        store[STORAGE_KEY] = JSON.stringify(stored);
        const { result } = renderHook(() => useViewTypes(VSUMID));
        expect(result.current.viewTypes).toEqual(stored);
    });

    it('returns empty viewTypes when stored JSON is invalid', () => {
        store[STORAGE_KEY] = 'not-valid-json';
        const { result } = renderHook(() => useViewTypes(VSUMID));
        expect(result.current.viewTypes).toEqual([]);
    });

    it('resets viewTypes when vsumId changes to undefined', () => {
        const stored = [makeStoredViewType()];
        store[STORAGE_KEY] = JSON.stringify(stored);

        const { result, rerender } = renderHook(
            ({ id }: { id: string | undefined }) => useViewTypes(id),
            { initialProps: { id: VSUMID as string | undefined } }
        );
        expect(result.current.viewTypes).toHaveLength(1);

        rerender({ id: undefined });
        expect(result.current.viewTypes).toEqual([]);
    });

    it('loads correct viewTypes when vsumId changes', () => {
        const stored1 = [makeStoredViewType({ id: 'vt-a', label: 'A' })];
        const stored2 = [makeStoredViewType({ id: 'vt-b', label: 'B', scope: 'multi', editable: true })];
        store['vitruv_view_types_v1_vsum-1'] = JSON.stringify(stored1);
        store['vitruv_view_types_v1_vsum-2'] = JSON.stringify(stored2);

        const { result, rerender } = renderHook(
            ({ id }: { id: string }) => useViewTypes(id),
            { initialProps: { id: 'vsum-1' } }
        );
        expect(result.current.viewTypes[0].label).toBe('A');

        rerender({ id: 'vsum-2' });
        expect(result.current.viewTypes[0].label).toBe('B');
    });

    // addViewType

    it('addViewType adds a new view type with generated id', () => {
        const { result } = renderHook(() => useViewTypes(VSUMID));
        act(() => { result.current.addViewType(makeViewType()); });
        expect(result.current.viewTypes).toHaveLength(1);
        expect(result.current.viewTypes[0].id).toMatch(/^vt-/);
    });

    it('addViewType preserves all provided fields', () => {
        const { result } = renderHook(() => useViewTypes(VSUMID));
        act(() => {
            result.current.addViewType(makeViewType({
                label: 'MyVT',
                scope: 'multi',
                angle: 1.5,
                linkedNodeIds: ['n1', 'n2'],
                editable: true,
            }));
        });
        const vt = result.current.viewTypes[0];
        expect(vt.label).toBe('MyVT');
        expect(vt.scope).toBe('multi');
        expect(vt.angle).toBeCloseTo(1.5);
        expect(vt.linkedNodeIds).toEqual(['n1', 'n2']);
        expect(vt.editable).toBe(true);
    });

    it('addViewType generates unique ids for multiple view types', () => {
        const { result } = renderHook(() => useViewTypes(VSUMID));
        act(() => {
            result.current.addViewType(makeViewType({ label: 'VT1' }));
            result.current.addViewType(makeViewType({ label: 'VT2' }));
        });
        const ids = result.current.viewTypes.map(vt => vt.id);
        expect(new Set(ids).size).toBe(2);
    });

    // deleteViewType

    it('deleteViewType removes the correct view type', () => {
        const { result } = renderHook(() => useViewTypes(VSUMID));
        act(() => {
            result.current.addViewType(makeViewType({ label: 'VT1' }));
            result.current.addViewType(makeViewType({ label: 'VT2' }));
        });
        const idToDelete = result.current.viewTypes[0].id;
        act(() => { result.current.deleteViewType(idToDelete); });
        expect(result.current.viewTypes).toHaveLength(1);
        expect(result.current.viewTypes[0].label).toBe('VT2');
    });

    it('deleteViewType does nothing for unknown id', () => {
        const { result } = renderHook(() => useViewTypes(VSUMID));
        act(() => { result.current.addViewType(makeViewType()); });
        act(() => { result.current.deleteViewType('non-existent'); });
        expect(result.current.viewTypes).toHaveLength(1);
    });

    it('deleteViewType on empty list does nothing', () => {
        const { result } = renderHook(() => useViewTypes(VSUMID));
        act(() => { result.current.deleteViewType('vt-x'); });
        expect(result.current.viewTypes).toEqual([]);
    });

    // updateAngle

    it('updateAngle updates the angle of the correct view type', () => {
        const { result } = renderHook(() => useViewTypes(VSUMID));
        act(() => { result.current.addViewType(makeViewType({ angle: 0 })); });
        const id = result.current.viewTypes[0].id;
        act(() => { result.current.updateAngle(id, Math.PI); });
        expect(result.current.viewTypes[0].angle).toBeCloseTo(Math.PI);
    });

    it('updateAngle does not affect other view types', () => {
        const { result } = renderHook(() => useViewTypes(VSUMID));
        act(() => {
            result.current.addViewType(makeViewType({ label: 'VT1', angle: 0 }));
            result.current.addViewType(makeViewType({ label: 'VT2', angle: 0 }));
        });
        const id = result.current.viewTypes[0].id;
        act(() => { result.current.updateAngle(id, 2.5); });
        expect(result.current.viewTypes[1].angle).toBe(0);
    });

    it('updateAngle does nothing for unknown id', () => {
        const { result } = renderHook(() => useViewTypes(VSUMID));
        act(() => { result.current.addViewType(makeViewType({ angle: 1 })); });
        act(() => { result.current.updateAngle('non-existent', 99); });
        expect(result.current.viewTypes[0].angle).toBe(1);
    });

    // unlinkNode

    it('unlinkNode removes the correct nodeId from linkedNodeIds', () => {
        const { result } = renderHook(() => useViewTypes(VSUMID));
        act(() => { result.current.addViewType(makeViewType({ linkedNodeIds: ['n1', 'n2'] })); });
        const id = result.current.viewTypes[0].id;
        act(() => { result.current.unlinkNode(id, 'n1'); });
        expect(result.current.viewTypes[0].linkedNodeIds).toEqual(['n2']);
    });

    it('unlinkNode does nothing when nodeId is not in linkedNodeIds', () => {
        const { result } = renderHook(() => useViewTypes(VSUMID));
        act(() => { result.current.addViewType(makeViewType({ linkedNodeIds: ['n1'] })); });
        const id = result.current.viewTypes[0].id;
        act(() => { result.current.unlinkNode(id, 'n-missing'); });
        expect(result.current.viewTypes[0].linkedNodeIds).toEqual(['n1']);
    });

    it('unlinkNode does not affect other view types', () => {
        const { result } = renderHook(() => useViewTypes(VSUMID));
        act(() => {
            result.current.addViewType(makeViewType({ linkedNodeIds: ['n1'] }));
            result.current.addViewType(makeViewType({ linkedNodeIds: ['n1'] }));
        });
        const id = result.current.viewTypes[0].id;
        act(() => { result.current.unlinkNode(id, 'n1'); });
        expect(result.current.viewTypes[1].linkedNodeIds).toEqual(['n1']);
    });

    // Persistence

    it('persists viewTypes to localStorage after addViewType', () => {
        const { result } = renderHook(() => useViewTypes(VSUMID));
        act(() => { result.current.addViewType(makeViewType({ label: 'VT1' })); });
        expect(getStored()).toHaveLength(1);
        expect(getStored()[0].label).toBe('VT1');
    });

    it('persists viewTypes to localStorage after deleteViewType', () => {
        const { result } = renderHook(() => useViewTypes(VSUMID));
        act(() => { result.current.addViewType(makeViewType()); });
        const id = result.current.viewTypes[0].id;
        act(() => { result.current.deleteViewType(id); });
        expect(getStored()).toHaveLength(0);
    });

    it('persists viewTypes to localStorage after updateAngle', () => {
        const { result } = renderHook(() => useViewTypes(VSUMID));
        act(() => { result.current.addViewType(makeViewType({ angle: 0 })); });
        const id = result.current.viewTypes[0].id;
        act(() => { result.current.updateAngle(id, 3.14); });
        expect(getStored()[0].angle).toBeCloseTo(3.14);
    });

    it('does not overwrite existing storage on mount', () => {
        const stored = [makeStoredViewType({ id: 'vt-saved', label: 'Saved' })];
        store[STORAGE_KEY] = JSON.stringify(stored);
        renderHook(() => useViewTypes(VSUMID));
        expect(getStored()).toHaveLength(1);
        expect(getStored()[0].id).toBe('vt-saved');
    });

    it('does not persist when vsumId is undefined', () => {
        const setItemSpy = jest.spyOn(localStorageMock, 'setItem');
        const { result } = renderHook(() => useViewTypes(undefined));
        act(() => { result.current.addViewType(makeViewType()); });
        expect(setItemSpy).not.toHaveBeenCalled();
        setItemSpy.mockRestore();
    });

    it('uses separate storage keys per vsumId', () => {
        const { result: r1 } = renderHook(() => useViewTypes('vsum-A'));
        const { result: r2 } = renderHook(() => useViewTypes('vsum-B'));

        act(() => { r1.current.addViewType(makeViewType({ label: 'ForA' })); });
        act(() => { r2.current.addViewType(makeViewType({ label: 'ForB' })); });

        const storedA: ViewType[] = JSON.parse(store['vitruv_view_types_v1_vsum-A'] ?? '[]');
        const storedB: ViewType[] = JSON.parse(store['vitruv_view_types_v1_vsum-B'] ?? '[]');

        expect(storedA[0].label).toBe('ForA');
        expect(storedB[0].label).toBe('ForB');
    });
});