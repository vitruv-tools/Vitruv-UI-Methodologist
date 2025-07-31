import { useCallback } from 'react';
import { ReactFlowInstance, Node } from 'reactflow';

interface UseDragAndDropProps {
  reactFlowInstance: ReactFlowInstance | null;
  reactFlowWrapper: React.RefObject<HTMLDivElement | null>;
  addNode: (node: Omit<Node, 'id'>) => string;
}

export function useDragAndDrop({ 
  reactFlowInstance, 
  reactFlowWrapper, 
  addNode 
}: UseDragAndDropProps) {
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstance) return;

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      let label = '';
      if (type === 'sequence') label = 'Sequence Table';
      if (type === 'object') label = 'Object Table';

      const newNode: Omit<Node, 'id'> = {
        type: 'editable',
        position,
        data: { label }
      };

      addNode(newNode);
    },
    [reactFlowInstance, reactFlowWrapper, addNode]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return {
    onDrop,
    onDragOver,
  };
} 