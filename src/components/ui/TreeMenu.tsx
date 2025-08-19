import React, { useState } from 'react';
import { TreeNode, TreeMenuProps } from '../../types';

interface TreeMenuItemProps {
  node: TreeNode;
  level: number;
  selectedId?: string;
  onNodeClick?: (node: TreeNode) => void;
  onDragStart?: (event: React.DragEvent, node: TreeNode) => void;
}

const TreeMenuItem: React.FC<TreeMenuItemProps> = ({ node, level, selectedId, onNodeClick, onDragStart }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

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
    padding: '8px 10px',
    margin: '2px 0',
    cursor: node.draggable ? 'grab' : 'pointer',
    background: isSelected ? 'linear-gradient(135deg, #e8f4fd 0%, #d1ecf1 100%)' : 'none',
    border: isSelected ? '2px solid #3498db' : 'none',
    fontSize: '14px',
    color: isSelected ? '#2c3e50' : (level === 0 ? '#333' : (hasChildren ? '#555' : '#666')),
    userSelect: 'none',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: `${level * 16 + 12}px`,
    fontWeight: isSelected ? 600 : (level === 0 ? 600 : (hasChildren ? 500 : 400)),
    borderRadius: '6px',
    transition: 'all 0.2s ease',
    minHeight: '20px',
    boxShadow: isSelected ? '0 4px 12px rgba(52, 152, 219, 0.15)' : 'none',
    transform: isSelected ? 'translateY(-1px)' : 'none',
  };

  const expandIconStyle: React.CSSProperties = {
    width: 20,
    display: 'inline-block',
    textAlign: 'center',
    cursor: 'pointer',
    fontSize: 12,
    color: isSelected ? '#3498db' : '#666',
    marginRight: '6px',
    transition: 'all 0.2s ease',
    transform: isSelected ? 'scale(1.1)' : 'scale(1)',
  };

  const childrenContainerStyle: React.CSSProperties = {
    marginLeft: '4px',
    borderLeft: isSelected ? '2px solid #3498db' : '1px solid #e0e0e0',
    paddingLeft: '8px',
    transition: 'border-color 0.2s ease',
  };

  return (
    <div>
      <div
        style={itemStyle}
        onClick={handleToggle}
        draggable={node.draggable}
        onDragStart={handleDragStart}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.background = 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }
        }}
      >
        {hasChildren && (
          <span style={expandIconStyle}>
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
        {!hasChildren && <span style={{ width: 20, display: 'inline-block' }}></span>}
        <span>{node.label}</span>
      </div>
      {hasChildren && isExpanded && (
        <div style={childrenContainerStyle}>
          {node.children!.map((child: TreeNode) => (
            <TreeMenuItem
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
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
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const handleNodeClick = (node: TreeNode) => {
    if (node.draggable) {
      setSelectedId(node.id);
    }
    if (onNodeClick) {
      onNodeClick(node);
    }
  };

  return (
    <div style={{ 
      background: '#ffffff',
      borderRadius: '4px',
      padding: '10px',
      border: '1px solid #e0e0e0'
    }}>
      {nodes.map((node: TreeNode) => (
        <TreeMenuItem
          key={node.id}
          node={node}
          level={0}
          selectedId={selectedId}
          onNodeClick={handleNodeClick}
          onDragStart={onDragStart}
        />
      ))}
    </div>
  );
}; 