import { renderHook, act } from '@testing-library/react';
import { useFlowState } from '../../hooks/useFlowState';

describe('useFlowState', () => {

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

        it('should use a caller-provided id instead of overwriting it, when one is given', () => {
            // Mirrors FlowCanvas.addEcoreFile, which builds a semantic id (e.g. "ecore-42")
            // up front and relies on it being the id actually stored in state.
            const { result } = renderHook(() => useFlowState());

            let nodeId: string = '';
            act(() => {
                nodeId = result.current.addNode({
                    id: 'ecore-42',
                    position: { x: 0, y: 0 },
                    data: { label: 'Metamodel' },
                } as any);
            });

            expect(nodeId).toBe('ecore-42');
            expect(result.current.nodes).toHaveLength(1);
            expect(result.current.nodes[0].id).toBe('ecore-42');
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

    describe('undo integration', () => {
        it('removes a newly added node when undo is called', () => {
            const { result } = renderHook(() => useFlowState());

            act(() => {
                result.current.addNode({ position: { x: 0, y: 0 }, data: { label: 'Node 1' } });
            });
            expect(result.current.nodes).toHaveLength(1);
            expect(result.current.canUndo).toBe(true);

            act(() => {
                result.current.undo();
            });
            expect(result.current.nodes).toHaveLength(0);
        });

        it('a single undo fully removes an added node even after ReactFlow re-measures it (width/height/selected/dragging)', () => {
            // Reproduces the real bug: ReactFlow measures a node's DOM size after it first
            // renders and writes width/height back via setNodes — a React-Flow-internal
            // bookkeeping update, not a user edit. Before the fix, that measurement was
            // treated as a real "Node modified" history entry, so a single Undo only
            // stripped the measurement back off and left the node itself in place.
            const { result } = renderHook(() => useFlowState());

            act(() => {
                result.current.addNode({ position: { x: 0, y: 0 }, data: { label: 'New Metamodel' } });
            });
            expect(result.current.nodes).toHaveLength(1);

            act(() => {
                result.current.setNodes(nds => nds.map(n => ({
                    ...n,
                    width: 118,
                    height: 126,
                    positionAbsolute: n.position,
                    selected: false,
                    dragging: false,
                })));
            });
            expect(result.current.nodes[0]).toMatchObject({ width: 118, height: 126 });

            act(() => {
                result.current.undo();
            });
            expect(result.current.nodes).toHaveLength(0);
        });

        it('establishBaseline resets canUndo to false and undo no longer reverts prior nodes', () => {
            // Mirrors hydrateCanvasWorkspace loading a project's existing metamodels
            // (several addNode calls), after which establishBaseline() marks that
            // loaded state as the undo floor — so it is not itself undoable.
            const { result } = renderHook(() => useFlowState());

            act(() => {
                result.current.addNode({ position: { x: 0, y: 0 }, data: { label: 'Existing Metamodel' } });
            });
            act(() => {
                result.current.establishBaseline();
            });
            expect(result.current.canUndo).toBe(false);
            expect(result.current.nodes).toHaveLength(1);

            act(() => {
                result.current.addNode({ position: { x: 100, y: 0 }, data: { label: 'New Metamodel' } });
            });
            expect(result.current.nodes).toHaveLength(2);
            expect(result.current.canUndo).toBe(true);

            act(() => {
                result.current.undo();
            });
            expect(result.current.nodes).toHaveLength(1);
            expect(result.current.nodes[0].data.label).toBe('Existing Metamodel');
            expect(result.current.canUndo).toBe(false);
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