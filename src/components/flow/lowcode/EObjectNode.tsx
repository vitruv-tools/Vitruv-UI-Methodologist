import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { FlowNodeECoreData } from '../../../types/flow';
import {
  EOBJECT_ATTR_ROW_HEIGHT,
  EOBJECT_HEADER_HEIGHT,
} from '../../../utils/reactionEdgeGeometry';

export interface EObjectNodeData {
  label: string;
  className: string;
  attributes: Array<{ name: string; type: string; multiplicity?: string }>;
  isAbstract?: boolean;
  isInterface?: boolean;
  ecore: FlowNodeECoreData;
  group?: string;
  color?: string;
  modelAlias?: string;
}

const HANDLE_SIZE = 8;
const ATTR_ROW_HEIGHT = EOBJECT_ATTR_ROW_HEIGHT;
const HEADER_HEIGHT = EOBJECT_HEADER_HEIGHT;

/**
 * EObject node for the expanded reaction canvas.
 *
 * Each class node has:
 *   - Left/right handles on the class header (for class-level connections)
 *   - Left/right handles on each attribute row (for attribute-level connections)
 *
 * Handle ID convention:
 *   Class-level: `reaction-source-{eObjectId}` / `reaction-target-{eObjectId}`
 *   Attribute:   `reaction-source-{eObjectId}.{attrName}` / `reaction-target-{eObjectId}.{attrName}`
 */
const EObjectNode: React.FC<NodeProps<EObjectNodeData>> = ({ data, selected }) => {
  const { className, attributes, isAbstract, isInterface, ecore, color } = data;
  const borderColor = selected ? '#1976d2' : '#ccc';

  return (
    <div
      style={{
        minWidth: 180,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 6,
        background: '#fff',
        boxShadow: selected
          ? '0 0 0 2px #1976d244, 0 4px 12px rgba(0,0,0,0.1)'
          : '0 1px 4px rgba(0,0,0,0.06)',
        overflow: 'visible',
        fontSize: 12,
        position: 'relative',
      }}
    >
      {/* Class header */}
      <div
        style={{
          height: HEADER_HEIGHT,
          padding: '0 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: attributes.length > 0 ? '1px solid #e8e8e8' : 'none',
          background: color ? `${color}18` : '#f8f9fa',
          borderRadius: '6px 6px 0 0',
          position: 'relative',
        }}
      >
        {isInterface && (
          <span style={{ fontSize: 9, color: '#777', marginRight: 4 }}>&laquo;interface&raquo;</span>
        )}
        {isAbstract && !isInterface && (
          <span style={{ fontSize: 9, color: '#777', marginRight: 4 }}>&laquo;abstract&raquo;</span>
        )}
        <span style={{ fontWeight: 600, fontStyle: isAbstract ? 'italic' : 'normal', color: '#222' }}>
          {className}
        </span>

        {/* Class-level handles (on header row) */}
        <Handle
          type="target"
          position={Position.Left}
          id={`reaction-target-${ecore.eObjectId}`}
          className="reaction-handle reaction-handle-target"
          style={{
            position: 'absolute',
            left: -HANDLE_SIZE / 2,
            top: HEADER_HEIGHT / 2 - HANDLE_SIZE / 2,
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            background: '#888',
            border: '1.5px solid #555',
            borderRadius: '50%',
          }}
        />
        <Handle
          type="source"
          position={Position.Right}
          id={`reaction-source-${ecore.eObjectId}`}
          className="reaction-handle reaction-handle-source"
          style={{
            position: 'absolute',
            right: -HANDLE_SIZE / 2,
            top: HEADER_HEIGHT / 2 - HANDLE_SIZE / 2,
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            background: '#888',
            border: '1.5px solid #555',
            borderRadius: '50%',
          }}
        />
      </div>

      {/* Attribute rows — each with its own handles */}
      {attributes.map((attr, idx) => {
        const attrHandleId = `${ecore.eObjectId}.${attr.name}`;

        return (
          <div
            key={attr.name}
            style={{
              height: ATTR_ROW_HEIGHT,
              padding: '0 28px',
              display: 'flex',
              alignItems: 'center',
              borderBottom: idx < attributes.length - 1 ? '1px solid #f2f2f2' : 'none',
              position: 'relative',
              fontSize: 11,
            }}
          >
            <span style={{ color: '#555' }}>
              + {attr.name}: {attr.type}
              {attr.multiplicity && (
                <span style={{ color: '#999', marginLeft: 4 }}>[{attr.multiplicity}]</span>
              )}
            </span>

            {/* Attribute-level target handle (left) */}
            <Handle
              type="target"
              position={Position.Left}
              id={`reaction-target-${attrHandleId}`}
              className="reaction-handle reaction-handle-target"
              style={{
                position: 'absolute',
                left: -HANDLE_SIZE / 2,
                top: ATTR_ROW_HEIGHT / 2 - HANDLE_SIZE / 2,
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                background: '#aaa',
                border: '1.5px solid #777',
                borderRadius: '50%',
              }}
            />

            {/* Attribute-level source handle (right) */}
            <Handle
              type="source"
              position={Position.Right}
              id={`reaction-source-${attrHandleId}`}
              className="reaction-handle reaction-handle-source"
              style={{
                position: 'absolute',
                right: -HANDLE_SIZE / 2,
                top: ATTR_ROW_HEIGHT / 2 - HANDLE_SIZE / 2,
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                background: '#aaa',
                border: '1.5px solid #777',
                borderRadius: '50%',
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default memo(EObjectNode);
