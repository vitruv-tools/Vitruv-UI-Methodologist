import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { FlowNodeECoreData } from '../../../types/flow';
import {
  EOBJECT_ATTR_ROW_HEIGHT,
  EOBJECT_HEADER_HEIGHT,
} from '../../../utils/reactionEdgeGeometry';
import { BRAND_COLOR } from '../../ui/sharedStyles';

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

type CardinalSide = 'top' | 'right' | 'bottom' | 'left';

function sideToPosition(side: CardinalSide): Position {
  if (side === 'top') return Position.Top;
  if (side === 'right') return Position.Right;
  if (side === 'bottom') return Position.Bottom;
  return Position.Left;
}

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
  const borderColor = selected ? BRAND_COLOR : 'var(--v-uml-box-border)';

  return (
    <div
      style={{
        minWidth: 180,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 6,
        background: 'var(--v-uml-box-bg)',
        color: 'var(--v-uml-box-text)',
        boxShadow: selected
          ? '0 0 0 2px rgba(4,148,132,0.27), 0 4px 12px rgba(0,0,0,0.18)'
          : '0 1px 4px rgba(0,0,0,0.08)',
        overflow: 'visible',
        fontSize: 12,
        position: 'relative',
      }}
    >
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => {
        const position = sideToPosition(side);
        const hidden = {
          width: 6,
          height: 6,
          opacity: 0,
          pointerEvents: 'none' as const,
          border: 'none',
          background: 'transparent',
        };
        return (
          <React.Fragment key={side}>
            <Handle type="source" position={position} id={`${side}-source`} style={hidden} />
            <Handle type="target" position={position} id={`${side}-target`} style={hidden} />
          </React.Fragment>
        );
      })}

      {/* Class header */}
      <div
        style={{
          height: HEADER_HEIGHT,
          padding: '0 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: attributes.length > 0 ? '1px solid var(--v-uml-separator)' : 'none',
          background: color ? `${color}18` : 'var(--v-uml-box-muted)',
          borderRadius: '6px 6px 0 0',
          position: 'relative',
        }}
      >
        {isInterface && (
          <span style={{ fontSize: 9, color: 'var(--v-uml-box-text-muted)', marginRight: 4 }}>&laquo;interface&raquo;</span>
        )}
        {isAbstract && !isInterface && (
          <span style={{ fontSize: 9, color: 'var(--v-uml-box-text-muted)', marginRight: 4 }}>&laquo;abstract&raquo;</span>
        )}
        <span style={{ fontWeight: 600, fontStyle: isAbstract ? 'italic' : 'normal', color: 'var(--v-uml-box-text)' }}>
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
            background: 'var(--v-chrome-icon)',
            border: '1.5px solid var(--v-uml-box-border)',
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
            background: 'var(--v-chrome-icon)',
            border: '1.5px solid var(--v-uml-box-border)',
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
              borderBottom: idx < attributes.length - 1 ? '1px solid var(--v-uml-separator)' : 'none',
              position: 'relative',
              fontSize: 11,
            }}
          >
            <span style={{ color: 'var(--v-uml-box-text-muted)' }}>
              + {attr.name}: {attr.type}
              {attr.multiplicity && (
                <span style={{ color: 'var(--v-text-faint)', marginLeft: 4 }}>[{attr.multiplicity}]</span>
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
                background: 'var(--v-text-faint)',
                border: '1.5px solid var(--v-uml-box-border)',
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
                background: 'var(--v-text-faint)',
                border: '1.5px solid var(--v-uml-box-border)',
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
