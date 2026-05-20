import { Node } from 'reactflow';
import { ViewType, ViewTypeScope } from '../hooks/useViewTypes';
import { VsumView } from '../types/vsum';

export const computeBestAngle = (existingAngles: number[]): number => {
    if (existingAngles.length === 0) return -Math.PI / 2;

    const normalized = existingAngles
        .map(a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI))
        .sort((a, b) => a - b);

    let maxGap = 0;
    let bestAngle = 0;

    for (let i = 0; i < normalized.length; i++) {
        const current = normalized[i];
        const next = i === normalized.length - 1
            ? normalized[0] + 2 * Math.PI
            : normalized[i + 1];
        const gap = next - current;
        if (gap > maxGap) {
            maxGap = gap;
            bestAngle = current + gap / 2;
        }
    }

    if (bestAngle > Math.PI) bestAngle -= 2 * Math.PI;
    return bestAngle;
};

const distributeAngles = (count: number): number[] => {
    const angles: number[] = [];
    let existing: number[] = [];
    for (let i = 0; i < count; i++) {
        const angle = computeBestAngle(existing);
        angles.push(angle);
        existing = [...existing, angle];
    }
    return angles;
};

const getNodeMetaModelSourceId = (node: Node): number | undefined => {
    const value = node.data?.metaModelSourceId ?? node.data?.metaModelId;
    return typeof value === 'number' ? value : undefined;
};

const findNodeIdForSourceId = (nodes: Node[], sourceId: number): string | undefined => {
    const match = nodes.find(
        node => node.type === 'ecoreFile' && getNodeMetaModelSourceId(node) === sourceId
    );
    return match?.id;
};

export const mapBackendViewsToViewTypes = (views: VsumView[], nodes: Node[]): ViewType[] => {
    const angles = distributeAngles(views.length);

    return views.map((view, index) => {
        const assignedModels = view.assignedModels ?? [];
        const linkedNodeIds = Array.from(
            new Set(
                assignedModels
                    .map(model => findNodeIdForSourceId(nodes, model.sourceId))
                    .filter((nodeId): nodeId is string => typeof nodeId === 'string')
            )
        );

        const scope: ViewTypeScope = linkedNodeIds.length <= 1 ? 'single' : 'multi';

        return {
            id: `view-${view.id}`,
            label: `View ${view.id}`,
            scope,
            angle: angles[index] ?? -Math.PI / 2,
            linkedNodeIds,
            editable: true,
            backendId: view.id,
            fileStorageId: view.fileStorageId,
        };
    });
};
