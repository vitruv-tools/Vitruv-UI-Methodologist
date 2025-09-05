import React, { useState, useRef, useEffect } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';

interface UMLNodeData {
  label: string;
  toolType?: string;
  toolName?: string;
  diagramType?: string;
  onLabelChange?: (id: string, label: string) => void;
  onDelete?: (id: string) => void;
  // Extended data for comprehensive editing
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

// Reusable editable field component
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
      
      {/* Visibility options popup */}
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
      
      {/* Options popup */}
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

      {/* Delete confirmation popup */}
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
    // This will be handled by the parent component through onNodesChange
    console.log('Node data update:', updates);
  };

  const handleDelete = () => {
    if (nodeData.onDelete) {
      nodeData.onDelete(id);
    }
  };

  // Get node style based on tool type
  const getNodeStyle = () => {
    const baseStyle = {
      padding: '0px',
      background: selected ? '#f7f9fa' : '#fff',
      border: selected ? '2px solid #0071e3' : '2px solid #333',
      borderRadius: '0px',
      minWidth: '200px',
      boxShadow: selected ? '0 0 0 2px #cde3fa' : '0 4px 12px rgba(0,0,0,0.15)',
      position: 'relative' as const,
      fontFamily: 'Arial, sans-serif',
      overflow: 'hidden',
    };

    if (nodeData.toolType === 'element') {
      switch (nodeData.toolName) {
        case 'class':
          return {
            ...baseStyle,
            borderColor: '#2ecc71',
            borderWidth: '2px',
            background: selected ? '#f0f9f0' : '#ffffff',
            minHeight: '140px',
            boxShadow: selected ? '0 0 0 2px #cde3fa' : '0 4px 16px rgba(46, 204, 113, 0.2)',
          };
        case 'abstract-class':
          return {
            ...baseStyle,
            borderColor: '#16a085',
            borderWidth: '2px',
            background: selected ? '#f0f8f0' : '#ffffff',
            minHeight: '140px',
            fontStyle: 'italic',
            boxShadow: selected ? '0 0 0 2px #cde3fa' : '0 4px 16px rgba(22, 160, 133, 0.2)',
          };
        case 'interface':
          return {
            ...baseStyle,
            borderColor: '#e74c3c',
            borderWidth: '2px',
            borderStyle: 'dashed',
            background: selected ? '#fdf0f0' : '#ffffff',
            minHeight: '120px',
            boxShadow: selected ? '0 0 0 2px #cde3fa' : '0 4px 16px rgba(231, 76, 60, 0.2)',
          };
        case 'enumeration':
          return {
            ...baseStyle,
            borderColor: '#9b59b6',
            borderWidth: '2px',
            background: selected ? '#f8f0f8' : '#ffffff',
            minHeight: '120px',
            boxShadow: selected ? '0 0 0 2px #cde3fa' : '0 4px 16px rgba(155, 89, 182, 0.2)',
          };
        case 'package':
          return {
            ...baseStyle,
            borderColor: '#f39c12',
            borderWidth: '2px',
            background: selected ? '#fdf8f0' : '#ffffff',
            minHeight: '100px',
            boxShadow: selected ? '0 0 0 2px #cde3fa' : '0 4px 16px rgba(243, 156, 18, 0.2)',
          };
        default:
          return baseStyle;
      }
    } else if (nodeData.toolType === 'member') {
      return {
        ...baseStyle,
        minHeight: '40px',
        borderRadius: '4px',
        boxShadow: selected ? '0 0 0 2px #cde3fa' : '0 2px 8px rgba(0,0,0,0.1)',
      };
    } else if (nodeData.toolType === 'multiplicity') {
      return {
        ...baseStyle,
        minHeight: '30px',
        borderRadius: '4px',
        boxShadow: selected ? '0 0 0 2px #cde3fa' : '0 2px 8px rgba(0,0,0,0.1)',
      };
    }

    return baseStyle;
  };

  // Render UML Class with editable fields
  const renderUMLClass = () => (
    <div style={{ width: '100%' }}>
      {/* Delete button - only show when selected */}
      {selected && (
        <button
          onClick={handleDelete}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            background: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#c0392b';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#e74c3c';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Delete node"
        >
          ×
        </button>
      )}
      
      {/* Class name section */}
      <div style={{
        background: '#f8fff8',
        borderBottom: '1px solid #2ecc71',
        padding: '8px 0',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '14px',
        color: '#2ecc71',
        minHeight: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <EditableField
          value={nodeData.className || ''}
          onSave={(newValue) => updateNodeData({ className: newValue })}
          placeholder="Class Name"
            style={{ 
              fontWeight: 'bold',
            fontSize: '14px',
            color: '#2ecc71',
            textAlign: 'center'
          }}
        />
      </div>
      
      {/* Attributes section */}
      <div style={{
        borderBottom: '1px solid #2ecc71',
        padding: '8px 0',
        fontSize: '12px',
        color: '#666',
        minHeight: '50px'
      }}>
        <div style={{ 
          padding: '4px 8px', 
          fontWeight: 'bold', 
          color: '#2ecc71',
          background: '#f0f9f0'
        }}>
          Attributes
        </div>
        {nodeData.attributes?.map((attr, index) => (
          <div key={index} style={{ 
            padding: '2px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <EditableField
              value={attr}
              onSave={(newValue) => {
                const newAttributes = [...(nodeData.attributes || [])];
                newAttributes[index] = newValue;
                updateNodeData({ attributes: newAttributes });
              }}
              placeholder="+ attribute: Type"
              style={{ fontSize: '12px', flex: 1 }}
              onDelete={() => {
                const newAttributes = [...(nodeData.attributes || [])];
                newAttributes.splice(index, 1);
                updateNodeData({ attributes: newAttributes });
              }}
              showDelete={true}
            />
          </div>
        ))}
        <div style={{ padding: '2px 8px' }}>
          <EditableField
            value=""
            onSave={(newValue) => {
              if (newValue.trim()) {
                const newAttributes = [...(nodeData.attributes || []), newValue];
                updateNodeData({ attributes: newAttributes });
              }
            }}
            placeholder="+ Add attribute..."
            style={{ fontSize: '12px', fontStyle: 'italic', color: '#999' }}
            showVisibility={true}
          />
        </div>
      </div>
      
      {/* Methods section */}
      <div style={{
        padding: '8px 0',
        fontSize: '12px',
        color: '#666',
        minHeight: '50px'
      }}>
        <div style={{ 
          padding: '4px 8px', 
          fontWeight: 'bold', 
          color: '#2ecc71',
          background: '#f0f9f0'
        }}>
          Methods
        </div>
        {nodeData.methods?.map((method, index) => (
          <div key={index} style={{ 
            padding: '2px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <EditableField
              value={method}
              onSave={(newValue) => {
                const newMethods = [...(nodeData.methods || [])];
                newMethods[index] = newValue;
                updateNodeData({ methods: newMethods });
              }}
              placeholder="+ method(): ReturnType"
              style={{ fontSize: '12px', flex: 1 }}
              onDelete={() => {
                const newMethods = [...(nodeData.methods || [])];
                newMethods.splice(index, 1);
                updateNodeData({ methods: newMethods });
              }}
              showDelete={true}
            />
          </div>
        ))}
        <div style={{ padding: '2px 8px' }}>
          <EditableField
            value=""
            onSave={(newValue) => {
              if (newValue.trim()) {
                const newMethods = [...(nodeData.methods || []), newValue];
                updateNodeData({ methods: newMethods });
              }
            }}
            placeholder="+ Add method..."
            style={{ fontSize: '12px', fontStyle: 'italic', color: '#999' }}
            showVisibility={true}
          />
        </div>
      </div>
    </div>
  );

  // Render UML Abstract Class
  const renderUMLAbstractClass = () => (
    <div style={{ width: '100%' }}>
      {/* Delete button - only show when selected */}
      {selected && (
        <button
          onClick={handleDelete}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            background: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#c0392b';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#e74c3c';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Delete node"
        >
          ×
        </button>
      )}
      {/* Abstract class name section */}
      <div style={{
        background: '#f0f8f0',
        borderBottom: '1px solid #16a085',
        padding: '8px 0',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '14px',
        color: '#16a085',
        minHeight: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ fontStyle: 'italic', marginRight: '8px' }}>&lt;&lt;abstract&gt;&gt;</div>
        <EditableField
          value={nodeData.className || ''}
          onSave={(newValue) => updateNodeData({ className: newValue })}
          placeholder="Abstract Class Name"
            style={{ 
              fontWeight: 'bold',
            fontSize: '14px',
              color: '#16a085',
            textAlign: 'center',
              fontStyle: 'italic'
            }}
        />
      </div>
      
      {/* Attributes section */}
      <div style={{
        borderBottom: '1px solid #16a085',
        padding: '8px 0',
        fontSize: '12px',
        color: '#666',
        minHeight: '50px'
      }}>
        <div style={{ 
          padding: '4px 8px', 
          fontWeight: 'bold', 
          color: '#16a085',
          background: '#f0f8f0'
        }}>
          Attributes
        </div>
        {nodeData.attributes?.map((attr, index) => (
          <div key={index} style={{ 
            padding: '2px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <EditableField
              value={attr}
              onSave={(newValue) => {
                const newAttributes = [...(nodeData.attributes || [])];
                newAttributes[index] = newValue;
                updateNodeData({ attributes: newAttributes });
              }}
              placeholder="+ attribute: Type"
              style={{ fontSize: '12px', flex: 1 }}
              onDelete={() => {
                const newAttributes = [...(nodeData.attributes || [])];
                newAttributes.splice(index, 1);
                updateNodeData({ attributes: newAttributes });
              }}
              showDelete={true}
            />
            <button
              onClick={() => {
                const newAttributes = [...(nodeData.attributes || [])];
                newAttributes.splice(index, 1);
                updateNodeData({ attributes: newAttributes });
              }}
              style={{
                background: '#ff6b6b',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '16px',
                height: '16px',
                fontSize: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.7,
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
              title="Delete attribute"
            >
              ×
            </button>
          </div>
        ))}
        <div style={{ padding: '2px 8px' }}>
          <EditableField
            value=""
            onSave={(newValue) => {
              if (newValue.trim()) {
                const newAttributes = [...(nodeData.attributes || []), newValue];
                updateNodeData({ attributes: newAttributes });
              }
            }}
            placeholder="+ Add attribute..."
            style={{ fontSize: '12px', fontStyle: 'italic', color: '#999' }}
            showVisibility={true}
          />
        </div>
      </div>
      
      {/* Methods section */}
      <div style={{
        padding: '8px 0',
        fontSize: '12px',
        color: '#666',
        minHeight: '50px'
      }}>
        <div style={{ 
          padding: '4px 8px', 
          fontWeight: 'bold', 
          color: '#16a085',
          background: '#f0f8f0'
        }}>
          Methods
        </div>
        {nodeData.methods?.map((method, index) => (
          <div key={index} style={{ 
            padding: '2px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <EditableField
              value={method}
              onSave={(newValue) => {
                const newMethods = [...(nodeData.methods || [])];
                newMethods[index] = newValue;
                updateNodeData({ methods: newMethods });
              }}
              placeholder="+ method(): ReturnType"
              style={{ fontSize: '12px', flex: 1 }}
            />
            <button
              onClick={() => {
                const newMethods = [...(nodeData.methods || [])];
                newMethods.splice(index, 1);
                updateNodeData({ methods: newMethods });
              }}
              style={{
                background: '#ff6b6b',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '16px',
                height: '16px',
                fontSize: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.7,
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
              title="Delete method"
            >
              ×
            </button>
          </div>
        ))}
        <div style={{ padding: '2px 8px' }}>
          <EditableField
            value=""
            onSave={(newValue) => {
              if (newValue.trim()) {
                const newMethods = [...(nodeData.methods || []), newValue];
                updateNodeData({ methods: newMethods });
              }
            }}
            placeholder="+ Add method..."
            style={{ fontSize: '12px', fontStyle: 'italic', color: '#999' }}
            showVisibility={true}
          />
        </div>
      </div>
    </div>
  );

  // Render UML Interface
  const renderUMLInterface = () => (
    <div style={{ width: '100%' }}>
      {/* Delete button - only show when selected */}
      {selected && (
        <button
          onClick={handleDelete}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            background: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#c0392b';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#e74c3c';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Delete node"
        >
          ×
        </button>
      )}
      {/* Interface name section */}
      <div style={{
        background: '#fdf0f0',
        borderBottom: '1px solid #e74c3c',
        padding: '8px 0',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '14px',
        color: '#e74c3c',
        minHeight: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ fontStyle: 'italic', marginRight: '8px' }}>&lt;&lt;interface&gt;&gt;</div>
        <EditableField
          value={nodeData.className || ''}
          onSave={(newValue) => updateNodeData({ className: newValue })}
          placeholder="Interface Name"
            style={{ 
              fontWeight: 'bold',
            fontSize: '14px',
            color: '#e74c3c',
            textAlign: 'center'
          }}
        />
      </div>
      
      {/* Methods section only (interfaces don't have attributes) */}
      <div style={{
        padding: '8px 0',
        fontSize: '12px',
        color: '#666',
        minHeight: '50px'
      }}>
        <div style={{ 
          padding: '4px 8px', 
          fontWeight: 'bold', 
          color: '#e74c3c',
          background: '#fdf0f0'
        }}>
          Methods
        </div>
        {nodeData.methods?.map((method, index) => (
          <div key={index} style={{ 
            padding: '2px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <EditableField
              value={method}
              onSave={(newValue) => {
                const newMethods = [...(nodeData.methods || [])];
                newMethods[index] = newValue;
                updateNodeData({ methods: newMethods });
              }}
              placeholder="+ method(): ReturnType"
              style={{ fontSize: '12px', flex: 1 }}
            />
            <button
              onClick={() => {
                const newMethods = [...(nodeData.methods || [])];
                newMethods.splice(index, 1);
                updateNodeData({ methods: newMethods });
              }}
              style={{
                background: '#ff6b6b',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '16px',
                height: '16px',
                fontSize: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.7,
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
              title="Delete method"
            >
              ×
            </button>
          </div>
        ))}
        <div style={{ padding: '2px 8px' }}>
          <EditableField
            value=""
            onSave={(newValue) => {
              if (newValue.trim()) {
                const newMethods = [...(nodeData.methods || []), newValue];
                updateNodeData({ methods: newMethods });
              }
            }}
            placeholder="+ Add method..."
            style={{ fontSize: '12px', fontStyle: 'italic', color: '#999' }}
            showVisibility={true}
          />
        </div>
      </div>
    </div>
  );

  // Render UML Enumeration
  const renderUMLEnumeration = () => (
    <div style={{ width: '100%' }}>
      {/* Delete button - only show when selected */}
      {selected && (
        <button
          onClick={handleDelete}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            background: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#c0392b';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#e74c3c';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Delete node"
        >
          ×
        </button>
      )}
      {/* Enum name section */}
      <div style={{
        background: '#f8f0f8',
        borderBottom: '1px solid #9b59b6',
        padding: '8px 0',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '14px',
        color: '#9b59b6',
        minHeight: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ fontStyle: 'italic', marginRight: '8px' }}>&lt;&lt;enumeration&gt;&gt;</div>
        <EditableField
          value={nodeData.className || ''}
          onSave={(newValue) => updateNodeData({ className: newValue })}
          placeholder="Enumeration Name"
            style={{ 
              fontWeight: 'bold',
            fontSize: '14px',
            color: '#9b59b6',
            textAlign: 'center'
          }}
        />
      </div>
      
      {/* Values section */}
      <div style={{
        padding: '8px 0',
        fontSize: '12px',
        color: '#666',
        minHeight: '50px'
      }}>
        <div style={{ 
          padding: '4px 8px', 
          fontWeight: 'bold', 
          color: '#9b59b6',
          background: '#f8f0f8'
        }}>
          Values
        </div>
        {nodeData.values?.map((value, index) => (
          <div key={index} style={{ 
            padding: '2px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <EditableField
              value={value}
              onSave={(newValue) => {
                const newValues = [...(nodeData.values || [])];
                newValues[index] = newValue;
                updateNodeData({ values: newValues });
              }}
              placeholder="Value"
              style={{ fontSize: '12px', flex: 1 }}
            />
            <button
              onClick={() => {
                const newValues = [...(nodeData.values || [])];
                newValues.splice(index, 1);
                updateNodeData({ values: newValues });
              }}
              style={{
                background: '#ff6b6b',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '16px',
                height: '16px',
                fontSize: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.7,
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
              title="Delete value"
            >
              ×
            </button>
          </div>
        ))}
        <div style={{ padding: '2px 8px' }}>
          <EditableField
            value=""
            onSave={(newValue) => {
              if (newValue.trim()) {
                const newValues = [...(nodeData.values || []), newValue];
                updateNodeData({ values: newValues });
              }
            }}
            placeholder="Add value..."
            style={{ fontSize: '12px', fontStyle: 'italic', color: '#999' }}
            showVisibility={true}
          />
        </div>
      </div>
    </div>
  );

  // Render UML Package
  const renderUMLPackage = () => (
    <div style={{ width: '100%' }}>
      {/* Delete button - only show when selected */}
      {selected && (
        <button
          onClick={handleDelete}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            background: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#c0392b';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#e74c3c';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Delete node"
        >
          ×
        </button>
      )}
      {/* Package name section with tab design */}
      <div style={{
        background: '#fdf8f0',
        borderBottom: '1px solid #f39c12',
        borderRight: '1px solid #f39c12',
        padding: '8px 0',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '14px',
        color: '#f39c12',
        minHeight: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}>
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
      <div style={{
        padding: '8px 0',
        fontSize: '12px',
        color: '#666',
        minHeight: '50px'
      }}>
        <div style={{ 
          padding: '4px 8px', 
          fontWeight: 'bold', 
          color: '#f39c12',
          background: '#fdf8f0'
        }}>
          Contents
        </div>
        <div style={{ padding: '2px 8px', fontStyle: 'italic', color: '#999' }}>
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

      {/* Connection handles */}
      <Handle 
        type="target" 
        position={Position.Top} 
        isConnectable={isConnectable}
        style={{ 
          background: '#0071e3',
          width: '8px',
          height: '8px'
        }}
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        isConnectable={isConnectable}
        style={{ 
          background: '#0071e3',
          width: '8px',
          height: '8px'
        }}
      />
    </div>
  );
} 
