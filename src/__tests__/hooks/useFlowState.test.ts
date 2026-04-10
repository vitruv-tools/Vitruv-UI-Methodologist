import { renderHook, act } from '@testing-library/react';
import { useFlowState } from '../../hooks/useFlowState';
import { useProjectStore } from '../../store/Project';

jest.mock('../../utils/UMLFromEcoreTS', () => ({
    __esModule: true,
    getNodeNameFromEcoreIdentifier: jest.fn((value: string) => value),
    findClassNameFromEcoreIdentifier: jest.fn((value: string) => value),
    findPackageNameFromEcoreIdentifier: jest.fn((value: string) => value),
    getHandleIdForEcoreElement: jest.fn((_: string, direction: string, type: string) => `${direction}-${type}`),
    buildAttributeSignature: jest.fn(() => '+ attr: EString'),
    buildMethodSignature: jest.fn(() => '+ op(): void'),
}));

describe('useFlowState', () => {
    beforeEach(() => {
        act(() => {
            useProjectStore.getState().setActiveId(1);
        });
    });

    afterEach(() => {
        act(() => {
            useProjectStore.getState().setActiveId(null);
        });
    });

    describe('initial state', () => {
        it('should start with empty nodes and edges', () => {
            const { result } = renderHook(() => useFlowState());
            expect(result.current.nodes).toEqual([]);
            expect(result.current.edges).toEqual([]);
        });

        it('should start with canUndo and canRedo as false', () => {
            const { result } = renderHook(() => useFlowState());
            expect(result.current.canUndo).toBe(false);
            expect(result.current.canRedo).toBe(false);
        });
    });

    describe('addNode', () => {
        it('should add a node and return its id', () => {
            const { result } = renderHook(() => useFlowState());

            let nodeId: string = '';
            act(() => {
                nodeId = result.current.addNode({
                    position: { x: 0, y: 0 },
                    data: { label: 'Test Node' },
                });
            });

            expect(result.current.nodes).toHaveLength(1);
            expect(result.current.nodes[0].data.label).toBe('Test Node');
            expect(nodeId).toBeDefined();
        });

        it('should assign unique ids to each node', () => {
            const { result } = renderHook(() => useFlowState());

            act(() => {
                result.current.addNode({ position: { x: 0, y: 0 }, data: { label: 'Node 1' } });
                result.current.addNode({ position: { x: 100, y: 0 }, data: { label: 'Node 2' } });
            });

            expect(result.current.nodes).toHaveLength(2);
            const labels = result.current.nodes.map((n: any) => n.data.label);
            expect(labels).toContain('Node 1');
            expect(labels).toContain('Node 2');
        });
    });

    describe('removeNode', () => {
        it('should remove a node by id', () => {
            const { result } = renderHook(() => useFlowState());

            let nodeId: string = '';
            act(() => {
                nodeId = result.current.addNode({ position: { x: 0, y: 0 }, data: { label: 'Node' } });
            });

            act(() => {
                result.current.removeNode(nodeId);
            });

            expect(result.current.nodes).toHaveLength(0);
        });

        it('should also remove edges connected to the removed node', () => {
            const { result } = renderHook(() => useFlowState());

            let id1: string = '';
            let id2: string = '';
            act(() => {
                id1 = result.current.addNode({ position: { x: 0, y: 0 }, data: { label: 'Node 1' } });
                id2 = result.current.addNode({ position: { x: 100, y: 0 }, data: { label: 'Node 2' } });
            });

            act(() => {
                result.current.addEdge({ source: id1, target: id2, data: {} });
            });

            act(() => {
                result.current.removeNode(id1);
            });

            expect(result.current.edges).toHaveLength(0);
        });
    });

    describe('updateNodeLabel', () => {
        it('should update the label of a node', () => {
            const { result } = renderHook(() => useFlowState());

            let nodeId: string = '';
            act(() => {
                nodeId = result.current.addNode({ position: { x: 0, y: 0 }, data: { label: 'Old Label' } });
            });

            act(() => {
                result.current.updateNodeLabel(nodeId, 'New Label');
            });

            const node = result.current.nodes.find((n: any) => n.id === nodeId);
            expect(node?.data.label).toBe('New Label');
        });
    });

    describe('addEdge', () => {
        it('should add an edge between two nodes', () => {
            const { result } = renderHook(() => useFlowState());

            let id1: string = '';
            let id2: string = '';
            act(() => {
                id1 = result.current.addNode({ position: { x: 0, y: 0 }, data: { label: 'Node 1' } });
                id2 = result.current.addNode({ position: { x: 200, y: 0 }, data: { label: 'Node 2' } });
            });

            act(() => {
                result.current.addEdge({ source: id1, target: id2, data: {} });
            });

            expect(result.current.edges).toHaveLength(1);
            expect(result.current.edges[0].source).toBe(id1);
            expect(result.current.edges[0].target).toBe(id2);
        });

        it('should apply parallel metadata when multiple edges connect same nodes', () => {
            const { result } = renderHook(() => useFlowState());

            let id1: string = '';
            let id2: string = '';
            act(() => {
                id1 = result.current.addNode({ position: { x: 0, y: 0 }, data: { label: 'Node 1' } });
                id2 = result.current.addNode({ position: { x: 200, y: 0 }, data: { label: 'Node 2' } });
            });

            act(() => {
                result.current.addEdge({ source: id1, target: id2, data: {} });
                result.current.addEdge({ source: id1, target: id2, data: {} });
            });

            expect(result.current.edges).toHaveLength(2);
            expect(result.current.edges[0].data.parallelCount).toBe(2);
            expect(result.current.edges[1].data.parallelCount).toBe(2);
        });
    });

    describe('removeEdge', () => {
        it('should remove an edge by id', () => {
            const { result } = renderHook(() => useFlowState());

            let id1: string = '';
            let id2: string = '';
            act(() => {
                id1 = result.current.addNode({ position: { x: 0, y: 0 }, data: { label: 'Node 1' } });
                id2 = result.current.addNode({ position: { x: 200, y: 0 }, data: { label: 'Node 2' } });
            });

            let edgeId: string = '';
            act(() => {
                edgeId = result.current.addEdge({ source: id1, target: id2, data: {} });
            });

            act(() => {
                result.current.removeEdge(edgeId);
            });

            expect(result.current.edges).toHaveLength(0);
        });
    });

    describe('updateEdgeCode', () => {
        it('should update the code of an edge', () => {
            const { result } = renderHook(() => useFlowState());

            let id1: string = '';
            let id2: string = '';
            act(() => {
                id1 = result.current.addNode({ position: { x: 0, y: 0 }, data: { label: 'Node 1' } });
                id2 = result.current.addNode({ position: { x: 200, y: 0 }, data: { label: 'Node 2' } });
            });

            let edgeId: string = '';
            act(() => {
                edgeId = result.current.addEdge({ source: id1, target: id2, data: {} });
            });

            act(() => {
                result.current.updateEdgeCode(edgeId, 'reaction MyReaction {}');
            });

            const edge = result.current.edges.find((e: any) => e.id === edgeId);
            expect(edge?.data.code).toBe('reaction MyReaction {}');
        });
    });

    describe('clearFlow', () => {
        it('should remove all nodes and edges', () => {
            const { result } = renderHook(() => useFlowState());

            let id1: string = '';
            let id2: string = '';
            act(() => {
                id1 = result.current.addNode({ position: { x: 0, y: 0 }, data: { label: 'Node 1' } });
                id2 = result.current.addNode({ position: { x: 200, y: 0 }, data: { label: 'Node 2' } });
                result.current.addEdge({ source: id1, target: id2, data: {} });
            });

            act(() => {
                result.current.clearFlow();
            });

            expect(result.current.nodes).toHaveLength(0);
            expect(result.current.edges).toHaveLength(0);
        });
    });

    describe('userId/projectId reset', () => {
        it('should reset state when userId changes', () => {
            const { result, rerender } = renderHook(
                ({ userId }) => useFlowState({ userId }),
                { initialProps: { userId: 'user-1' } }
            );

            act(() => {
                result.current.addNode({ position: { x: 0, y: 0 }, data: { label: 'Node' } });
            });

            rerender({ userId: 'user-2' });

            expect(result.current.nodes).toHaveLength(0);
        });
    });

});