import { useState, useCallback, useEffect } from 'react';

export type ViewTypeScope = 'single' | 'multi';

export interface ViewType {
    id: string;
    label: string;
    scope: ViewTypeScope;
    angle: number;
    linkedNodeIds: string[];
    editable: boolean;
    backendId?: number;
    fileStorageId?: number;
}

const STORAGE_KEY = 'vitruv_view_types_v1';

function storageKey(vsumId: string) {
    return `${STORAGE_KEY}_${vsumId}`;
}

function generateId() {
    return `vt-${crypto.randomUUID()}`;
}

// ── Pure state updaters ───────────────────────────────────────────────────────

function addViewTypeUpdater(params: Omit<ViewType, 'id'>) {
    return (prev: ViewType[]): ViewType[] => [...prev, { ...params, id: generateId() }];
}

function deleteViewTypeUpdater(id: string) {
    return (prev: ViewType[]): ViewType[] => prev.filter(vt => vt.id !== id);
}

function updateAngleUpdater(id: string, angle: number) {
    return (prev: ViewType[]): ViewType[] => prev.map(vt => vt.id === id ? { ...vt, angle } : vt);
}

function unlinkNodeUpdater(viewTypeId: string, nodeId: string) {
    return (prev: ViewType[]): ViewType[] => prev.map(vt =>
        vt.id === viewTypeId
            ? { ...vt, linkedNodeIds: vt.linkedNodeIds.filter(n => n !== nodeId) }
            : vt
    );
}

function loadViewTypes(vsumId: string): ViewType[] {
    try {
        const raw = localStorage.getItem(storageKey(vsumId));
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function persistViewTypes(vsumId: string, viewTypes: ViewType[]): void {
    try {
        localStorage.setItem(storageKey(vsumId), JSON.stringify(viewTypes));
    } catch {
        console.error('Failed to persist viewTypes');
    }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useViewTypes(vsumId: string | undefined) {
    const [viewTypes, setViewTypes] = useState<ViewType[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (!vsumId) {
            setViewTypes([]);
            setIsLoaded(false);
            return;
        }
        setViewTypes(loadViewTypes(vsumId));
        setIsLoaded(true);
    }, [vsumId]);

    useEffect(() => {
        if (!vsumId || !isLoaded) return;
        persistViewTypes(vsumId, viewTypes);
    }, [viewTypes, vsumId, isLoaded]);

    const addViewType = useCallback(
        (params: Omit<ViewType, 'id'>) => setViewTypes(addViewTypeUpdater(params)),
        []
    );

    const deleteViewType = useCallback(
        (id: string) => setViewTypes(deleteViewTypeUpdater(id)),
        []
    );

    const updateAngle = useCallback(
        (id: string, angle: number) => setViewTypes(updateAngleUpdater(id, angle)),
        []
    );

    const unlinkNode = useCallback(
        (viewTypeId: string, nodeId: string) => setViewTypes(unlinkNodeUpdater(viewTypeId, nodeId)),
        []
    );

    const replaceViewTypes = useCallback((next: ViewType[]) => {
        setViewTypes(next);
    }, []);

    return { viewTypes, addViewType, deleteViewType, updateAngle, unlinkNode, replaceViewTypes };
}