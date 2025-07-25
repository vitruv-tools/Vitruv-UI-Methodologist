import React, { useState, useRef, useEffect } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';

export function EditableNode({ id, data, selected, isConnectable, xPos, yPos, ...rest }: NodeProps) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label || '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  // Save label and exit edit mode
  const save = () => {
    setEditing(false);
    data.onLabelChange(id, label);
  };

  return (
    <div style={{
      padding: 10,
      background: selected ? '#f7f9fa' : '#fff',
      border: selected ? '2px solid #0071e3' : '1px solid #999',
      borderRadius: 5,
      minWidth: 120,
      boxShadow: selected ? '0 0 0 2px #cde3fa' : undefined
    }}>
      {editing ? (
        <input
          ref={inputRef}
          value={label}
          style={{ width: '100%' }}
          onChange={e => setLabel(e.target.value)}
          onBlur={save}
          onKeyDown={e => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <span
          onDoubleClick={() => setEditing(true)}
          style={{ cursor: 'pointer', userSelect: 'none', fontWeight: 500 }}
          title="Double-click to rename"
        >
          {label}
        </span>
      )}
      {/* Connection handles */}
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />
    </div>
  );
}