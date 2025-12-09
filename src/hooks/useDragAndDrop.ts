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

// Label mappings by tool type and name
const LABEL_MAPS: Record<string, Record<string, string>> = {
  element: {
    'class': 'Class',
    'abstract-class': 'AbstractClass',
    'interface': 'Interface',
    'enumeration': 'Enumeration',
    'package': 'Package',
  },
  member: {
    'attribute': '+ attribute: Type',
    'method': '+ method(): ReturnType',
  },
  relationship: {
    'association': 'Association',
    'aggregation': 'Aggregation',
    'composition': 'Composition',
    'inheritance': 'Inheritance',
    'realization': 'Realization',
    'dependency': 'Dependency',
  },
  multiplicity: {
    'one': '1',
    'many': '*',
    'optional': '0..1',
    'range': '1..*',
  },
};

const REACTFLOW_LABELS: Record<string, string> = {
  'sequence': 'Sequence Table',
  'object': 'Object Table',
};

function getToolLabel(toolData: ToolData): string {
  const typeMap = LABEL_MAPS[toolData.type];
  return typeMap?.[toolData.name] ?? toolData.name;
}

function calculateDropPosition(
  event: React.DragEvent,
  reactFlowInstance: ReactFlowInstance,
  bounds: DOMRect
) {
  return reactFlowInstance.project({
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  });
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

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!reactFlowInstance || !reactFlowBounds) {
        console.log('No ReactFlow instance or bounds');
        return;
      }

      const toolDataString = event.dataTransfer.getData('application/tool');
      console.log('Tool data string:', toolDataString);

      if (toolDataString) {
        handleToolDrop(event, toolDataString, reactFlowInstance, reactFlowBounds, addNode);
        return;
      }

      handleReactFlowDrop(event, reactFlowInstance, reactFlowBounds, addNode);
    },
    [reactFlowInstance, reactFlowWrapper, addNode]
  );

  function handleToolDrop(
    event: React.DragEvent,
    toolDataString: string,
    instance: ReactFlowInstance,
    bounds: DOMRect,
    addNodeFn: (node: Omit<Node, 'id'>) => string
  ) {
    try {
      const toolData: ToolData = JSON.parse(toolDataString);
      console.log('Parsed tool data:', toolData);

      const position = calculateDropPosition(event, instance, bounds);
      console.log('Calculated position:', position);

      const label = getToolLabel(toolData);
      console.log('Created label:', label);

      const newNode: Omit<Node, 'id'> = {
        type: 'editable',
        position,
        data: {
          label,
          toolType: toolData.type,
          toolName: toolData.name,
          diagramType: toolData.diagramType
        }
      };

      console.log('Adding new node:', newNode);
      const nodeId = addNodeFn(newNode);
      console.log('Node added with ID:', nodeId);
    } catch (error) {
      console.error('Error parsing tool data:', error);
    }
  }

  function handleReactFlowDrop(
    event: React.DragEvent,
    instance: ReactFlowInstance,
    bounds: DOMRect,
    addNodeFn: (node: Omit<Node, 'id'>) => string
  ) {
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;

    const position = calculateDropPosition(event, instance, bounds);
    const label = REACTFLOW_LABELS[type] ?? '';

    const newNode: Omit<Node, 'id'> = {
      type: 'editable',
      position,
      data: { label }
    };

    addNodeFn(newNode);
  }

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    const toolDataString = event.dataTransfer.getData('application/tool');
    if (toolDataString) {
      event.dataTransfer.dropEffect = 'copy';
      console.log('Tool drag over detected');
    } else {
      // Disallow dropping unknown payloads (e.g., external links) onto the canvas
      event.dataTransfer.dropEffect = 'none';
    }
  }, []);

  return {
    onDrop,
    onDragOver,
  };
} 