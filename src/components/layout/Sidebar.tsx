import React from 'react';
import { TreeMenu } from '../ui/TreeMenu';
import { TreeNode } from '../../types/tree';

const sidebarStyle: React.CSSProperties = {
  width: '220px',
  background: '#fff',
  padding: '16px 8px',
  boxSizing: 'border-box',
  height: '100vh',
  borderRight: '1px solid #e0e0e0',
  overflowY: 'auto',
};

const titleStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 'bold',
  marginBottom: '16px',
  color: '#222',
  textAlign: 'left',
  padding: 0,
  borderBottom: '1px solid #e0e0e0',
};

const onDragStart = (event: React.DragEvent, node: TreeNode) => {
  if (node.nodeType) {
    event.dataTransfer.setData('application/reactflow', node.nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }
};

const onNodeClick = (node: TreeNode) => {
  // No-op for now
};

const sidebarTreeData: TreeNode[] = [
  {
    id: 'uml-diagrams',
    label: 'UML Diagrams',
    children: [
      {
        id: 'structure-diagrams',
        label: 'Structure Diagrams',
        children: [
          { id: 'class-diagram', label: 'Class Diagram', nodeType: 'class', draggable: true },
          { id: 'object-diagram', label: 'Object Diagram', nodeType: 'object', draggable: true },
          { id: 'component-diagram', label: 'Component Diagram', nodeType: 'component', draggable: true },
          { id: 'composite-structure-diagram', label: 'Composite Structure Diagram', nodeType: 'composite', draggable: true },
          { id: 'deployment-diagram', label: 'Deployment Diagram', nodeType: 'deployment', draggable: true },
          { id: 'package-diagram', label: 'Package Diagram', nodeType: 'package', draggable: true },
          { id: 'profile-diagram', label: 'Profile Diagram', nodeType: 'profile', draggable: true },
        ],
      },
      {
        id: 'behavior-diagrams',
        label: 'Behavior Diagrams',
        children: [
          { id: 'use-case-diagram', label: 'Use Case Diagram', nodeType: 'use-case', draggable: true },
          { id: 'activity-diagram', label: 'Activity Diagram', nodeType: 'activity', draggable: true },
          { id: 'state-machine-diagram', label: 'State Machine Diagram', nodeType: 'state-machine', draggable: true },
          {
            id: 'interaction-diagrams',
            label: 'Interaction Diagrams',
            children: [
              { id: 'sequence-diagram', label: 'Sequence Diagram', nodeType: 'sequence', draggable: true },
              { id: 'communication-diagram', label: 'Communication Diagram', nodeType: 'communication', draggable: true },
              { id: 'timing-diagram', label: 'Timing Diagram', nodeType: 'timing', draggable: true },
              { id: 'interaction-overview-diagram', label: 'Interaction Overview Diagram', nodeType: 'interaction-overview', draggable: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'java',
    label: 'JAVA',
    children: [], // Ready for future children
  },
  {
    id: 'c++',
    label: 'C++',
    children: [], // Ready for future children
  },
  {
    id: 'sql',
    label: 'SQL',
    children: [], // Ready for future children
  },
];

export function Sidebar() {
  return (
    <aside style={sidebarStyle}>
      <div style={titleStyle}>OBJECTIVES</div>
      <TreeMenu
        nodes={sidebarTreeData}
        onNodeClick={onNodeClick}
        onDragStart={onDragStart}
      />
    </aside>
  );
} 