import React, { useState, useRef, useEffect } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import {
  getBaseNodeStyle,
  headerBaseStyle,
  italicHeaderStyle,
  borderedSectionBodyStyle,
  sectionBodyStyle,
  listItemStyle,
  packageHeaderStyle,
  packageContentStyle,
  packageContentTitleStyle,
  packageHintStyle,
  getDeleteButtonStyle,
  handleStyles
} from './umlNodeStyles';

interface UMLNodeData {
  label: string;
  toolType?: string;
  toolName?: string;
  diagramType?: string;
  onLabelChange?: (id: string, label: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
  attributes?: string[];
  methods?: string[];
  values?: string[];
  packageName?: string;
}

interface EditableFieldProps {
  value: string;
  onSave: (newValue: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  multiline?: boolean;
  onDelete?: () => void;
  showDelete?: boolean;
  showVisibility?: boolean;
}
function EditableField({ value, onSave, placeholder, style, multiline = false, onDelete, showDelete = false, showVisibility = false }: EditableFieldProps & { onDelete?: () => void, showDelete?: boolean, showVisibility?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [showOptions, setShowOptions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showVisibilityOptions, setShowVisibilityOptions] = useState(false);
  const [selectedVisibility, setSelectedVisibility] = useState('+');
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      if (multiline && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      } else if (inputRef.current) {
      inputRef.current.focus();
        inputRef.current.select();
      }
    }
  }, [editing, multiline]);

  const handleSave = () => {
    if (editValue.trim() !== value) {
      onSave(editValue.trim());
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleClick = () => {
    if (showDelete && onDelete) {
      setShowOptions(!showOptions);
    }
  };

  const handleEdit = () => {
    setShowOptions(false);
    setEditing(true);
  };

  const handleDeleteClick = () => {
    setShowOptions(false);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (onDelete) {
      onDelete();
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  const handleAddClick = () => {
    if (showVisibility) {
      setShowVisibilityOptions(true);
    } else {
      setEditing(true);
    }
  };

  const handleVisibilitySelect = (visibility: string) => {
    setSelectedVisibility(visibility);
    setShowVisibilityOptions(false);
    setEditing(true);
  };

  const handleVisibilitySave = () => {
    if (editValue.trim()) {
      const newValue = `${selectedVisibility} ${editValue.trim()}`;
      onSave(newValue);
    }
    setEditing(false);
    setEditValue('');
  };

  if (editing) {
    if (multiline) {
      return (
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={showVisibility ? handleVisibilitySave : handleSave}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            border: '2px solid #0071e3',
            borderRadius: '4px',
            padding: '4px',
            fontSize: 'inherit',
            fontFamily: 'inherit',
            resize: 'vertical',
            minHeight: '60px',
            outline: 'none',
            ...style
          }}
          placeholder={showVisibility ? `${selectedVisibility} name: Type` : placeholder}
        />
      );
    }

    return (
      <input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={showVisibility ? handleVisibilitySave : handleSave}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          border: '2px solid #0071e3',
          borderRadius: '4px',
          padding: '4px',
          fontSize: 'inherit',
          fontFamily: 'inherit',
          outline: 'none',
          ...style
        }}
        placeholder={showVisibility ? `${selectedVisibility} name: Type` : placeholder}
      />
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        onDoubleClick={() => setEditing(true)}
        onClick={showVisibility ? handleAddClick : handleClick}
        style={{
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: '2px',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          ...style
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f0f0f0';
          e.currentTarget.style.transform = 'scale(1.02)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title={showVisibility ? "Click to add new item" : showDelete && onDelete ? "Click to show options, double-click to edit" : "Double-click to edit"}
      >
        {value || placeholder}
      </div>
      
      {showVisibilityOptions && showVisibility && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          background: '#fff',
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 1000,
          minWidth: '120px'
        }}>
          <div style={{
            fontSize: '11px',
            color: '#666',
            marginBottom: '4px',
            textAlign: 'center',
            fontWeight: 'bold'
          }}>
            Select visibility:
          </div>
          <button
            onClick={() => handleVisibilitySelect('+')}
            style={{
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '11px',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'center',
              marginBottom: '4px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#218838'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#28a745'}
            title="Public (+)"
          >
            + Public
          </button>
          <button
            onClick={() => handleVisibilitySelect('#')}
            style={{
              background: '#ffc107',
              color: '#212529',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '11px',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'center',
              marginBottom: '4px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#e0a800'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#ffc107'}
            title="Protected (#)"
          >
            # Protected
          </button>
          <button
            onClick={() => handleVisibilitySelect('-')}
            style={{
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '11px',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'center',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#c82333'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#dc3545'}
            title="Private (-)"
          >
            - Private
          </button>
        </div>
      )}
      
      {showOptions && showDelete && onDelete && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          background: '#fff',
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 1000,
          minWidth: '120px'
        }}>
          <button
            onClick={handleEdit}
            style={{
              background: '#0071e3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '11px',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'center',
              marginBottom: '4px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#005bb5'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#0071e3'}
            title="Edit this item"
          >
            ✏️ Edit
          </button>
          <button
            onClick={handleDeleteClick}
            style={{
              background: '#ff6b6b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '11px',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'center',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#ff5252'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#ff6b6b'}
            title="Delete this item"
          >
            🗑️ Delete
          </button>
        </div>
      )}

      {showDeleteConfirm && onDelete && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          background: '#fff',
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 1001,
          minWidth: '150px'
        }}>
          <div style={{
            fontSize: '11px',
            color: '#666',
            marginBottom: '8px',
            textAlign: 'center'
          }}>
            Are you sure you want to delete this?
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={handleDeleteConfirm}
              style={{
                background: '#ff6b6b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '10px',
                cursor: 'pointer',
                flex: 1,
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#ff5252'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#ff6b6b'}
            >
              Yes, Delete
            </button>
            <button
              onClick={handleDeleteCancel}
              style={{
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '10px',
                cursor: 'pointer',
                flex: 1,
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#5a6268'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#6c757d'}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function EditableNode({ id, data, selected, isConnectable, xPos, yPos, ...rest }: NodeProps<UMLNodeData>) {
  const nodeData = data || {};
  
  const updateNodeData = (updates: Partial<UMLNodeData>) => {
    console.log('Node data update:', updates);
  };

  const handleDelete = () => {
    if (nodeData.onDelete) {
      nodeData.onDelete(id);
    }
  };

  const getNodeStyle = () => {
    const baseStyle = getBaseNodeStyle(!!selected);

    if (nodeData.toolType === 'element') {
      switch (nodeData.toolName) {
        case 'class':
          return {
            ...baseStyle,
            borderColor: selected ? '#2563eb' : '#6b7280',
            background: '#ffffff',
          };
        case 'abstract-class':
          return {
            ...baseStyle,
            borderColor: selected ? '#2563eb' : '#6b7280',
            background: '#ffffff',
          };
        case 'interface':
          return {
            ...baseStyle,
            borderColor: selected ? '#2563eb' : '#6b7280',
            borderStyle: 'dashed',
            background: '#ffffff',
          };
        case 'enumeration':
          return {
            ...baseStyle,
            borderColor: selected ? '#2563eb' : '#6b7280',
            background: '#ffffff',
          };
        case 'package':
          return {
            ...baseStyle,
            borderColor: selected ? '#2563eb' : '#6b7280',
            background: '#ffffff',
          };
        default:
          return baseStyle;
      }
    } else if (nodeData.toolType === 'member') {
      return {
        ...baseStyle,
        minHeight: '40px',
        borderRadius: '4px',
        boxShadow: selected ? '0 4px 12px rgba(37, 99, 235, 0.25)' : '0 2px 8px rgba(0,0,0,0.08)',
      };
    } else if (nodeData.toolType === 'multiplicity') {
      return {
        ...baseStyle,
        minHeight: '30px',
        borderRadius: '4px',
        boxShadow: selected ? '0 4px 12px rgba(37, 99, 235, 0.25)' : '0 2px 8px rgba(0,0,0,0.08)',
      };
    }

    return baseStyle;
  };

  const DeleteButton: React.FC<{
    onDeleteClick: () => void;
    title?: string;
    background?: string;
    hoverBackground?: string;
    size?: number;
    boxShadow?: string;
  }> = ({ onDeleteClick, title = 'Delete node', background = '#ef4444', hoverBackground = '#dc2626', size = 22, boxShadow = '0 4px 12px rgba(239,68,68,0.3)' }) => {
    return (
      <button
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDeleteClick(); }}
        style={getDeleteButtonStyle({ background, size, boxShadow })}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = hoverBackground;
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = background;
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title={title}
      >
        ×
      </button>
    );
  };

  const renderLines = (items: string[]) => (
    <>
      {items.map((text, index) => (
        <div key={index} style={listItemStyle}>
          {text}
        </div>
      ))}
    </>
  );

  const renderUMLClass = () => (
    <div style={{ width: '100%' }}>
      {selected && (
        <DeleteButton onDeleteClick={handleDelete} />
      )}
      
      {/* Class Name Section */}
      <div style={headerBaseStyle}>
        <EditableField
          value={nodeData.className || ''}
          onSave={(newValue) => updateNodeData({ className: newValue })}
          placeholder="Class Name"
          style={{ 
            fontWeight: '600',
            fontSize: '13px',
            color: '#1f2937',
            textAlign: 'center'
          }}
        />
      </div>
      
      {/* Attributes Section */}
      {nodeData.attributes && nodeData.attributes.length > 0 && (
        <div style={borderedSectionBodyStyle}>
          {renderLines(nodeData.attributes)}
        </div>
      )}
      
      {/* Methods Section */}
      {nodeData.methods && nodeData.methods.length > 0 && (
        <div style={sectionBodyStyle}>
          {renderLines(nodeData.methods)}
        </div>
      )}
    </div>
  );

  // Render UML Abstract Class
  const renderUMLAbstractClass = () => (
    <div style={{ width: '100%' }}>
      {selected && (
        <DeleteButton onDeleteClick={handleDelete} />
      )}
      
      <div style={italicHeaderStyle}>
        <span style={{ fontSize: '10px', fontWeight: 'normal' }}>&lt;&lt;abstract&gt;&gt;</span>
        {' '}
        <EditableField
          value={nodeData.className || ''}
          onSave={(newValue) => updateNodeData({ className: newValue })}
          placeholder="Abstract Class Name"
          style={{ 
            fontWeight: '600',
            fontSize: '13px',
            color: '#1f2937',
            textAlign: 'center',
            fontStyle: 'italic'
          }}
        />
      </div>
      
      {nodeData.attributes && nodeData.attributes.length > 0 && (
        <div style={borderedSectionBodyStyle}>
          {renderLines(nodeData.attributes)}
        </div>
      )}
      
      {nodeData.methods && nodeData.methods.length > 0 && (
        <div style={sectionBodyStyle}>
          {renderLines(nodeData.methods)}
        </div>
      )}
    </div>
  );

  // Render UML Interface
  const renderUMLInterface = () => (
    <div style={{ width: '100%' }}>
      {selected && (
        <DeleteButton onDeleteClick={handleDelete} />
      )}
      
      <div style={italicHeaderStyle}>
        <span style={{ fontSize: '10px', fontWeight: 'normal' }}>&lt;&lt;interface&gt;&gt;</span>
        {' '}
        <EditableField
          value={nodeData.className || ''}
          onSave={(newValue) => updateNodeData({ className: newValue })}
          placeholder="Interface Name"
          style={{ 
            fontWeight: '600',
            fontSize: '13px',
            color: '#1f2937',
            textAlign: 'center',
            fontStyle: 'italic'
          }}
        />
      </div>
      
      {nodeData.methods && nodeData.methods.length > 0 && (
        <div style={sectionBodyStyle}>
          {renderLines(nodeData.methods)}
        </div>
      )}
    </div>
  );

  // Render UML Enumeration
  const renderUMLEnumeration = () => (
    <div style={{ width: '100%' }}>
      {selected && (
        <DeleteButton onDeleteClick={handleDelete} />
      )}
      
      <div style={italicHeaderStyle}>
        <span style={{ fontSize: '10px', fontWeight: 'normal' }}>&lt;&lt;enumeration&gt;&gt;</span>
        {' '}
        <EditableField
          value={nodeData.className || ''}
          onSave={(newValue) => updateNodeData({ className: newValue })}
          placeholder="Enumeration Name"
          style={{ 
            fontWeight: '600',
            fontSize: '13px',
            color: '#1f2937',
            textAlign: 'center',
            fontStyle: 'italic'
          }}
        />
      </div>
      
      {nodeData.values && nodeData.values.length > 0 && (
        <div style={sectionBodyStyle}>
          {renderLines(nodeData.values)}
        </div>
      )}
    </div>
  );

  // Render UML Package
  const renderUMLPackage = () => (
    <div style={{ width: '100%' }}>
      {/* Delete button - only show when selected */}
      {selected && (
        <DeleteButton
          onDeleteClick={handleDelete}
          background="#e74c3c"
          hoverBackground="#c0392b"
          size={20}
          boxShadow="0 2px 4px rgba(0,0,0,0.2)"
        />
      )}
      {/* Package name section with tab design */}
      <div style={packageHeaderStyle}>
        <EditableField
          value={nodeData.packageName || ''}
          onSave={(newValue) => updateNodeData({ packageName: newValue })}
          placeholder="Package Name"
            style={{ 
              fontWeight: 'bold',
            fontSize: '14px',
            color: '#f39c12',
            textAlign: 'center'
          }}
        />
      </div>
      
      {/* Package contents */}
      <div style={packageContentStyle}>
        <div style={packageContentTitleStyle}>
          Contents
        </div>
        <div style={packageHintStyle}>
          Drag classes here...
        </div>
      </div>
    </div>
  );

  // Render UML Member (attribute or method)
  const renderUMLMember = () => (
    <div style={{ width: '100%', textAlign: 'center', padding: '8px' }}>
      <EditableField
        value={nodeData.label || ''}
        onSave={(newValue) => updateNodeData({ label: newValue })}
        placeholder="+ member: Type"
        style={{ fontSize: '14px', fontWeight: 'bold' }}
      />
    </div>
  );

  // Render Relationship
  const renderRelationship = () => (
    <div style={{ width: '100%', textAlign: 'center', padding: '8px' }}>
      <EditableField
        value={nodeData.label || ''}
        onSave={(newValue) => updateNodeData({ label: newValue })}
        placeholder="Relationship"
        style={{ fontSize: '14px', fontWeight: 'bold' }}
      />
    </div>
  );

  // Render Multiplicity
  const renderMultiplicity = () => (
    <div style={{ width: '100%', textAlign: 'center', padding: '8px' }}>
      <EditableField
        value={nodeData.label || ''}
        onSave={(newValue) => updateNodeData({ label: newValue })}
        placeholder="1"
        style={{ fontSize: '14px', fontWeight: 'bold', color: '#e74c3c' }}
      />
    </div>
  );

  // Get the appropriate renderer based on tool type
  const getRenderer = () => {
    console.log('getRenderer called with:', { toolType: nodeData.toolType, toolName: nodeData.toolName });
    
    if (nodeData.toolType === 'element') {
      switch (nodeData.toolName) {
        case 'class':
          console.log('Rendering UML Class');
          return renderUMLClass();
        case 'abstract-class':
          console.log('Rendering UML Abstract Class');
          return renderUMLAbstractClass();
        case 'interface':
          console.log('Rendering UML Interface');
          return renderUMLInterface();
        case 'enumeration':
          console.log('Rendering UML Enumeration');
          return renderUMLEnumeration();
        case 'package':
          console.log('Rendering UML Package');
          return renderUMLPackage();
        default:
          console.log('Unknown element type, falling back to relationship');
          return renderRelationship();
      }
    } else if (nodeData.toolType === 'member') {
      console.log('Rendering UML Member');
      return renderUMLMember();
    } else if (nodeData.toolType === 'relationship') {
      console.log('Rendering Relationship');
      return renderRelationship();
    } else if (nodeData.toolType === 'multiplicity') {
      console.log('Rendering Multiplicity');
      return renderMultiplicity();
    }
    
    console.log('No specific renderer found, using default');
    return renderRelationship();
  };

  const nodeStyle = getNodeStyle();

  return (
    <div style={nodeStyle}>
      {/* Render the appropriate UML element */}
      {getRenderer()}

      {/* Midpoint handles per side; targets on Left/Top, sources on Right/Bottom */}
      {/* Left side: allow both target and source */}
      <Handle 
        type="target" 
        position={Position.Left} 
        isConnectable={isConnectable}
        id="left-target"
        style={handleStyles.leftTarget}
      />
      <Handle 
        type="source" 
        position={Position.Left} 
        isConnectable={isConnectable}
        id="left-source"
        style={handleStyles.leftSource}
      />

      {/* Top side: allow both target and source */}
      <Handle 
        type="target" 
        position={Position.Top} 
        isConnectable={isConnectable}
        id="top-target"
        style={handleStyles.topTarget}
      />
      <Handle 
        type="source" 
        position={Position.Top} 
        isConnectable={isConnectable}
        id="top-source"
        style={handleStyles.topSource}
      />

      {/* Right side: allow both source and target */}
      <Handle 
        type="source" 
        position={Position.Right} 
        isConnectable={isConnectable}
        id="right-source"
        style={handleStyles.rightSource}
      />
      <Handle 
        type="target" 
        position={Position.Right} 
        isConnectable={isConnectable}
        id="right-target"
        style={handleStyles.rightTarget}
      />

      {/* Bottom side: allow both source and target */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        isConnectable={isConnectable}
        id="bottom-source"
        style={handleStyles.bottomSource}
      />
      <Handle 
        type="target" 
        position={Position.Bottom} 
        isConnectable={isConnectable}
        id="bottom-target"
        style={handleStyles.bottomTarget}
      />
    </div>
  );
} 
