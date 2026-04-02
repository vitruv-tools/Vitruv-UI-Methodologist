import { useState, useCallback, useEffect } from 'react';

export type ViewTypeScope = 'single' | 'multi';

export interface ViewType {
    id: string;
    label: string;
    scope: ViewTypeScope;
    angle: number;
    linkedNodeIds: string[];
    editable: boolean;
}

const STORAGE_KEY = 'vitruv_view_types_v1';

function storageKey(vsumId: string) {
    return `${STORAGE_KEY}_${vsumId}`;
}

function generateId() {
    return `vt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useViewTypes(vsumId: string | undefined) {
    const [viewTypes, setViewTypes] = useState<ViewType[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load on mount / vsumId change
    useEffect(() => {
        if (!vsumId) {
            setViewTypes([]);
            setIsLoaded(false);
            return;
        }
        try {
            const raw = localStorage.getItem(storageKey(vsumId));
            setViewTypes(raw ? JSON.parse(raw) : []);
        } catch {
            setViewTypes([]);
        }
        setIsLoaded(true);
    }, [vsumId]);

    // Persist — only after initial load to avoid overwriting with []
    useEffect(() => {
        if (!vsumId || !isLoaded) return;
        try {
            localStorage.setItem(storageKey(vsumId), JSON.stringify(viewTypes));
        } catch {
            console.error('Failed to persist viewTypes');
        }
    }, [viewTypes, vsumId, isLoaded]);

    const addViewType = useCallback((params: Omit<ViewType, 'id'>) => {
        setViewTypes(prev => [...prev, { ...params, id: generateId() }]);
    }, []);

    const deleteViewType = useCallback((id: string) => {
        setViewTypes(prev => prev.filter(vt => vt.id !== id));
    }, []);

    const updateAngle = useCallback((id: string, angle: number) => {
        setViewTypes(prev => prev.map(vt => vt.id === id ? { ...vt, angle } : vt));
    }, []);

    const unlinkNode = useCallback((viewTypeId: string, nodeId: string) => {
        setViewTypes(prev => prev.map(vt =>
            vt.id === viewTypeId
                ? { ...vt, linkedNodeIds: vt.linkedNodeIds.filter(n => n !== nodeId) }
                : vt
        ));
    }, []);

    return { viewTypes, addViewType, deleteViewType, updateAngle, unlinkNode };
}