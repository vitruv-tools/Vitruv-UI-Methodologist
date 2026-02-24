import { renderHook, act } from '@testing-library/react';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { ReactFlowInstance } from 'reactflow';
import { createRef } from 'react';

// Mock ReactFlowInstance
const mockProject = jest.fn();
const mockReactFlowInstance = {
    project: mockProject,
} as unknown as ReactFlowInstance;

// Mock wrapper ref with getBoundingClientRect
const mockBounds: DOMRect = {
    left: 100,
    top: 50,
    right: 900,
    bottom: 750,
    width: 800,
    height: 700,
    x: 100,
    y: 50,
    toJSON: () => { },
};

function createMockWrapper(): React.RefObject<HTMLDivElement> {
    return {
        current: { getBoundingClientRect: () => mockBounds } as HTMLDivElement,
    };
}

// Helper to create a mock DragEvent
function createMockDragEvent(toolData?: object, reactFlowType?: string): React.DragEvent {
    const dataMap: Record<string, string> = {};
    if (toolData) dataMap['application/tool'] = JSON.stringify(toolData);
    if (reactFlowType) dataMap['application/reactflow'] = reactFlowType;

    return {
        preventDefault: jest.fn(),
        clientX: 300,
        clientY: 200,
        dataTransfer: {
            getData: (key: string) => dataMap[key] ?? '',
            dropEffect: '',
        },
    } as unknown as React.DragEvent;
}

describe('useDragAndDrop', () => {
    let mockAddNode: jest.Mock;
    let mockWrapper: React.RefObject<HTMLDivElement>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockAddNode = jest.fn().mockReturnValue('new-node-id');
        mockWrapper = createMockWrapper();
        mockProject.mockReturnValue({ x: 200, y: 150 });
    });

    describe('onDrop', () => {
        describe('with tool data', () => {
            it('should call addNode when valid tool data is dropped', () => {
                const { result } = renderHook(() =>
                    useDragAndDrop({
                        reactFlowInstance: mockReactFlowInstance,
                        reactFlowWrapper: mockWrapper,
                        addNode: mockAddNode,
                    })
                );

                const event = createMockDragEvent({
                    type: 'element',
                    name: 'class',
                    diagramType: 'uml',
                });

                act(() => { result.current.onDrop(event); });

                expect(mockAddNode).toHaveBeenCalledTimes(1);
            });

            it('should map element tool names to correct labels', () => {
                const { result } = renderHook(() =>
                    useDragAndDrop({
                        reactFlowInstance: mockReactFlowInstance,
                        reactFlowWrapper: mockWrapper,
                        addNode: mockAddNode,
                    })
                );

                const event = createMockDragEvent({
                    type: 'element',
                    name: 'class',
                    diagramType: 'uml',
                });

                act(() => { result.current.onDrop(event); });

                expect(mockAddNode).toHaveBeenCalledWith(
                    expect.objectContaining({
                        data: expect.objectContaining({ label: 'Class' }),
                    })
                );
            });

            it('should map abstract-class to correct label', () => {
                const { result } = renderHook(() =>
                    useDragAndDrop({
                        reactFlowInstance: mockReactFlowInstance,
                        reactFlowWrapper: mockWrapper,
                        addNode: mockAddNode,
                    })
                );

                act(() => {
                    result.current.onDrop(createMockDragEvent({
                        type: 'element', name: 'abstract-class', diagramType: 'uml',
                    }));
                });

                expect(mockAddNode).toHaveBeenCalledWith(
                    expect.objectContaining({ data: expect.objectContaining({ label: 'AbstractClass' }) })
                );
            });

            it('should map relationship tool names to correct labels', () => {
                const { result } = renderHook(() =>
                    useDragAndDrop({
                        reactFlowInstance: mockReactFlowInstance,
                        reactFlowWrapper: mockWrapper,
                        addNode: mockAddNode,
                    })
                );

                act(() => {
                    result.current.onDrop(createMockDragEvent({
                        type: 'relationship', name: 'inheritance', diagramType: 'uml',
                    }));
                });

                expect(mockAddNode).toHaveBeenCalledWith(
                    expect.objectContaining({ data: expect.objectContaining({ label: 'Inheritance' }) })
                );
            });

            it('should fall back to tool name if no label mapping exists', () => {
                const { result } = renderHook(() =>
                    useDragAndDrop({
                        reactFlowInstance: mockReactFlowInstance,
                        reactFlowWrapper: mockWrapper,
                        addNode: mockAddNode,
                    })
                );

                act(() => {
                    result.current.onDrop(createMockDragEvent({
                        type: 'unknown', name: 'custom-tool', diagramType: 'uml',
                    }));
                });

                expect(mockAddNode).toHaveBeenCalledWith(
                    expect.objectContaining({ data: expect.objectContaining({ label: 'custom-tool' }) })
                );
            });

            it('should set node type to editable', () => {
                const { result } = renderHook(() =>
                    useDragAndDrop({
                        reactFlowInstance: mockReactFlowInstance,
                        reactFlowWrapper: mockWrapper,
                        addNode: mockAddNode,
                    })
                );

                act(() => {
                    result.current.onDrop(createMockDragEvent({
                        type: 'element', name: 'class', diagramType: 'uml',
                    }));
                });

                expect(mockAddNode).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'editable' })
                );
            });

            it('should use projected position from ReactFlowInstance', () => {
                mockProject.mockReturnValue({ x: 42, y: 99 });

                const { result } = renderHook(() =>
                    useDragAndDrop({
                        reactFlowInstance: mockReactFlowInstance,
                        reactFlowWrapper: mockWrapper,
                        addNode: mockAddNode,
                    })
                );

                act(() => {
                    result.current.onDrop(createMockDragEvent({
                        type: 'element', name: 'class', diagramType: 'uml',
                    }));
                });

                expect(mockAddNode).toHaveBeenCalledWith(
                    expect.objectContaining({ position: { x: 42, y: 99 } })
                );
            });

            it('should not throw on invalid JSON tool data', () => {
                const { result } = renderHook(() =>
                    useDragAndDrop({
                        reactFlowInstance: mockReactFlowInstance,
                        reactFlowWrapper: mockWrapper,
                        addNode: mockAddNode,
                    })
                );

                const event = {
                    preventDefault: jest.fn(),
                    clientX: 300,
                    clientY: 200,
                    dataTransfer: {
                        getData: (key: string) => key === 'application/tool' ? 'INVALID_JSON' : '',
                        dropEffect: '',
                    },
                } as unknown as React.DragEvent;

                expect(() => {
                    act(() => { result.current.onDrop(event); });
                }).not.toThrow();

                expect(mockAddNode).not.toHaveBeenCalled();
            });
        });

        describe('with reactflow data', () => {
            it('should add node with correct label for sequence type', () => {
                const { result } = renderHook(() =>
                    useDragAndDrop({
                        reactFlowInstance: mockReactFlowInstance,
                        reactFlowWrapper: mockWrapper,
                        addNode: mockAddNode,
                    })
                );

                act(() => {
                    result.current.onDrop(createMockDragEvent(undefined, 'sequence'));
                });

                expect(mockAddNode).toHaveBeenCalledWith(
                    expect.objectContaining({ data: expect.objectContaining({ label: 'Sequence Table' }) })
                );
            });

            it('should add node with correct label for object type', () => {
                const { result } = renderHook(() =>
                    useDragAndDrop({
                        reactFlowInstance: mockReactFlowInstance,
                        reactFlowWrapper: mockWrapper,
                        addNode: mockAddNode,
                    })
                );

                act(() => {
                    result.current.onDrop(createMockDragEvent(undefined, 'object'));
                });

                expect(mockAddNode).toHaveBeenCalledWith(
                    expect.objectContaining({ data: expect.objectContaining({ label: 'Object Table' }) })
                );
            });

            it('should use empty label for unknown reactflow type', () => {
                const { result } = renderHook(() =>
                    useDragAndDrop({
                        reactFlowInstance: mockReactFlowInstance,
                        reactFlowWrapper: mockWrapper,
                        addNode: mockAddNode,
                    })
                );

                act(() => {
                    result.current.onDrop(createMockDragEvent(undefined, 'unknown-type'));
                });

                expect(mockAddNode).toHaveBeenCalledWith(
                    expect.objectContaining({ data: expect.objectContaining({ label: '' }) })
                );
            });
        });

        describe('early returns', () => {
            it('should do nothing if reactFlowInstance is null', () => {
                const { result } = renderHook(() =>
                    useDragAndDrop({
                        reactFlowInstance: null,
                        reactFlowWrapper: mockWrapper,
                        addNode: mockAddNode,
                    })
                );

                act(() => {
                    result.current.onDrop(createMockDragEvent({ type: 'element', name: 'class', diagramType: 'uml' }));
                });

                expect(mockAddNode).not.toHaveBeenCalled();
            });

            it('should do nothing if wrapper ref has no current element', () => {
                const emptyRef = createRef<HTMLDivElement>();

                const { result } = renderHook(() =>
                    useDragAndDrop({
                        reactFlowInstance: mockReactFlowInstance,
                        reactFlowWrapper: emptyRef,
                        addNode: mockAddNode,
                    })
                );

                act(() => {
                    result.current.onDrop(createMockDragEvent({ type: 'element', name: 'class', diagramType: 'uml' }));
                });

                expect(mockAddNode).not.toHaveBeenCalled();
            });

            it('should do nothing if no data is present in the drop event', () => {
                const { result } = renderHook(() =>
                    useDragAndDrop({
                        reactFlowInstance: mockReactFlowInstance,
                        reactFlowWrapper: mockWrapper,
                        addNode: mockAddNode,
                    })
                );

                act(() => {
                    result.current.onDrop(createMockDragEvent()); // no tool or reactflow data
                });

                expect(mockAddNode).not.toHaveBeenCalled();
            });
        });
    });

    describe('onDragOver', () => {
        it('should call preventDefault', () => {
            const { result } = renderHook(() =>
                useDragAndDrop({
                    reactFlowInstance: mockReactFlowInstance,
                    reactFlowWrapper: mockWrapper,
                    addNode: mockAddNode,
                })
            );

            const event = createMockDragEvent({ type: 'element', name: 'class', diagramType: 'uml' });

            act(() => { result.current.onDragOver(event); });

            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should set dropEffect to copy for tool data', () => {
            const { result } = renderHook(() =>
                useDragAndDrop({
                    reactFlowInstance: mockReactFlowInstance,
                    reactFlowWrapper: mockWrapper,
                    addNode: mockAddNode,
                })
            );

            const event = createMockDragEvent({ type: 'element', name: 'class', diagramType: 'uml' });

            act(() => { result.current.onDragOver(event); });

            expect(event.dataTransfer.dropEffect).toBe('copy');
        });

        it('should set dropEffect to none for unknown data', () => {
            const { result } = renderHook(() =>
                useDragAndDrop({
                    reactFlowInstance: mockReactFlowInstance,
                    reactFlowWrapper: mockWrapper,
                    addNode: mockAddNode,
                })
            );

            const event = createMockDragEvent(); // no tool data

            act(() => { result.current.onDragOver(event); });

            expect(event.dataTransfer.dropEffect).toBe('none');
        });
    });
});