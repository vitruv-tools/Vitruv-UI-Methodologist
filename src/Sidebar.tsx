import React from 'react';

const sidebarStyle: React.CSSProperties = {
  width: 180,
  background: '#eee',
  padding: 20,
  boxSizing: 'border-box',
  height: '100vh',
  position: 'absolute',
  left: 0,
  top: 0,
  zIndex: 10
};

const itemStyle: React.CSSProperties = {
  border: '1px solid #999',
  padding: 8,
  marginBottom: 12,
  background: '#fff',
  borderRadius: 4,
  cursor: 'grab',
  textAlign: 'center'
};

const onDragStart = (event: React.DragEvent, nodeType: string) => {
  event.dataTransfer.setData('application/reactflow', nodeType);
  event.dataTransfer.effectAllowed = 'move';
};

export function Sidebar() {
  return (
    <aside style={sidebarStyle}>
      <div style={itemStyle} draggable onDragStart={event => onDragStart(event, 'sequence')}>
        Sequence Table
      </div>
      <div style={itemStyle} draggable onDragStart={event => onDragStart(event, 'object')}>
        Object Table
      </div>
    </aside>
  );
}