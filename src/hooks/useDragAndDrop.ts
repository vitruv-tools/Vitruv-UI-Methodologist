import { useCallback } from 'react';
import { ReactFlowInstance, Node, Edge } from 'reactflow';

interface UseDragAndDropProps {
  reactFlowInstance: ReactFlowInstance | null;
  reactFlowWrapper: React.RefObject<HTMLDivElement | null>;
  addNode: (node: Omit<Node, 'id'>) => string;
  addEdge?: (edge: Omit<Edge, 'id'>) => string;
}

interface ToolData {
  type: string;
  name: string;
  diagramType: string;
}

export function useDragAndDrop({
  reactFlowInstance,
  reactFlowWrapper,
  addNode
}: UseDragAndDropProps) {
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      console.log('Drop event triggered');

      // Check for tool data first
      const toolDataString = event.dataTransfer.getData('application/tool');
      console.log('Tool data string:', toolDataString);

      if (toolDataString) {
        try {
          const toolData: ToolData = JSON.parse(toolDataString);
          console.log('Parsed tool data:', toolData);

          if (!reactFlowInstance) {
            console.log('No ReactFlow instance');
            return;
          }

          const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
          if (!reactFlowBounds) {
            console.log('No ReactFlow bounds');
            return;
          }

          const position = reactFlowInstance.project({
            x: event.clientX - reactFlowBounds.left,
            y: event.clientY - reactFlowBounds.top,
          });
          console.log('Calculated position:', position);

          let label = '';
          let nodeType = 'editable'; // All nodes use the 'editable' type for now

          // Handle different tool types
          switch (toolData.type) {
            case 'element':
              switch (toolData.name) {
                case 'class':
                  label = 'Class';
                  break;
                case 'abstract-class':
                  label = 'AbstractClass';
                  break;
                case 'interface':
                  label = 'Interface';
                  break;
                case 'enumeration':
                  label = 'Enumeration';
                  break;
                case 'package':
                  label = 'Package';
                  break;
                default:
                  label = toolData.name;
              }
              break;
            case 'member':
              switch (toolData.name) {
                case 'attribute':
                  label = '+ attribute: Type';
                  break;
                case 'method':
                  label = '+ method(): ReturnType';
                  break;
                default:
                  label = toolData.name;
              }
              break;
            case 'relationship':
              switch (toolData.name) {
                case 'association':
                  label = 'Association';
                  break;
                case 'aggregation':
                  label = 'Aggregation';
                  break;
                case 'composition':
                  label = 'Composition';
                  break;
                case 'inheritance':
                  label = 'Inheritance';
                  break;
                case 'realization':
                  label = 'Realization';
                  break;
                case 'dependency':
                  label = 'Dependency';
                  break;
                default:
                  label = toolData.name;
              }
              break;
            case 'multiplicity':
              switch (toolData.name) {
                case 'one':
                  label = '1';
                  break;
                case 'many':
                  label = '*';
                  break;
                case 'optional':
                  label = '0..1';
                  break;
                case 'range':
                  label = '1..*';
                  break;
                default:
                  label = toolData.name;
              }
              break;
            default:
              label = toolData.name;
          }

          console.log('Created label:', label);

          const newNode: Omit<Node, 'id'> = {
            type: nodeType,
            position,
            data: {
              label,
              toolType: toolData.type,
              toolName: toolData.name,
              diagramType: toolData.diagramType
            }
          };

          console.log('Adding new node:', newNode);
          const nodeId = addNode(newNode);
          console.log('Node added with ID:', nodeId);
          return;
        } catch (error) {
          console.error('Error parsing tool data:', error);
        }
      }

      // Fallback to existing reactflow data handling
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

    // Check if it's a tool drop
    const toolDataString = event.dataTransfer.getData('application/tool');
    if (toolDataString) {
      event.dataTransfer.dropEffect = 'copy';
      console.log('Tool drag over detected');
    } else {
      event.dataTransfer.dropEffect = 'move';
    }
  }, []);

  return {
    onDrop,
    onDragOver,
  };
} 