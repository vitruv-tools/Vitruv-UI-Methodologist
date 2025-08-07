import React, { useState } from 'react';
import { TreeNode, TreeMenuProps } from '../../types/tree';

interface TreeMenuItemProps {
  node: TreeNode;
  level: number;
  onNodeClick?: (node: TreeNode) => void;
  onDragStart?: (event: React.DragEvent, node: TreeNode) => void;
}

const TreeMenuItem: React.FC<TreeMenuItemProps> = ({ node, level, onNodeClick, onDragStart }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
    if (onNodeClick) {
      onNodeClick(node);
    }
  };

  const handleDragStart = (event: React.DragEvent) => {
    if (node.draggable && onDragStart) {
      onDragStart(event, node);
    }
  };

  const itemStyle: React.CSSProperties = {
    padding: '4px 0 4px 0',
    margin: 0,
    cursor: node.draggable ? 'grab' : 'pointer',
    background: 'none',
    border: 'none',
    fontSize: '14px',
    color: '#222',
    userSelect: 'none',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: `${level * 18 + 4}px`,
    fontWeight: level === 0 ? 600 : (hasChildren ? 600 : 400),
  };

  return (
    <div>
      <div
        style={itemStyle}
        onClick={handleToggle}
        draggable={node.draggable}
        onDragStart={handleDragStart}
      >
        {hasChildren && (
          <span style={{ width: 16, display: 'inline-block', textAlign: 'center', cursor: 'pointer', fontSize: 12 }}>
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
        {!hasChildren && <span style={{ width: 16, display: 'inline-block' }}></span>}
        <span>{node.label}</span>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeMenuItem
              key={child.id}
              node={child}
              level={level + 1}
              onNodeClick={onNodeClick}
              onDragStart={onDragStart}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const TreeMenu: React.FC<TreeMenuProps> = ({ nodes, onNodeClick, onDragStart }) => {
  return (
    <div>
      {nodes.map((node) => (
        <TreeMenuItem
          key={node.id}
          node={node}
          level={0}
          onNodeClick={onNodeClick}
          onDragStart={onDragStart}
        />
      ))}
    </div>
  );
}; 