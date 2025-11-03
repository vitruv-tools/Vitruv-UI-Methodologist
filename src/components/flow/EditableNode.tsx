import React, { useState, useRef, useEffect } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';

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
    const baseStyle = {
      padding: '0px',
      background: '#ffffff',
      border: selected ? '2px solid #2563eb' : '1px solid #9ca3af',
      borderRadius: '4px',
      minWidth: '180px',
      boxShadow: selected ? '0 4px 12px rgba(37, 99, 235, 0.25)' : '0 2px 8px rgba(0,0,0,0.08)',
      position: 'relative' as const,
      fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif`,
      overflow: 'hidden',
    };

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

  const renderUMLClass = () => (
    <div style={{ width: '100%' }}>
      {selected && (
        <button
          onClick={handleDelete}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '22px',
            height: '22px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#dc2626';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#ef4444';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Delete node"
        >
          ×
        </button>
      )}
      
      {/* Class Name Section */}
      <div style={{
        borderBottom: '1px solid #d1d5db',
        padding: '8px 12px',
        textAlign: 'center',
        fontWeight: 600,
        fontSize: '13px',
        color: '#1f2937',
        background: '#f9fafb'
      }}>
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
        <div style={{
          borderBottom: '1px solid #d1d5db',
          padding: '4px 0',
          fontSize: '11px',
          color: '#374151',
          background: '#ffffff'
        }}>
          {nodeData.attributes.map((attr, index) => (
            <div key={index} style={{ 
              padding: '2px 12px',
              display: 'flex',
              alignItems: 'center',
              fontSize: '11px',
              fontFamily: 'monospace'
            }}>
              {attr}
            </div>
          ))}
        </div>
      )}
      
      {/* Methods Section */}
      {nodeData.methods && nodeData.methods.length > 0 && (
        <div style={{
          padding: '4px 0',
          fontSize: '11px',
          color: '#374151',
          background: '#ffffff'
        }}>
          {nodeData.methods.map((method, index) => (
            <div key={index} style={{ 
              padding: '2px 12px',
              display: 'flex',
              alignItems: 'center',
              fontSize: '11px',
              fontFamily: 'monospace'
            }}>
              {method}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render UML Abstract Class
  const renderUMLAbstractClass = () => (
    <div style={{ width: '100%' }}>
      {selected && (
        <button
          onClick={handleDelete}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '22px',
            height: '22px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#dc2626';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#ef4444';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Delete node"
        >
          ×
        </button>
      )}
      
      <div style={{
        borderBottom: '1px solid #d1d5db',
        padding: '8px 12px',
        textAlign: 'center',
        fontWeight: 600,
        fontSize: '13px',
        color: '#1f2937',
        background: '#f9fafb',
        fontStyle: 'italic'
      }}>
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
        <div style={{
          borderBottom: '1px solid #d1d5db',
          padding: '4px 0',
          fontSize: '11px',
          color: '#374151',
          background: '#ffffff'
        }}>
          {nodeData.attributes.map((attr, index) => (
            <div key={index} style={{ 
              padding: '2px 12px',
              fontSize: '11px',
              fontFamily: 'monospace'
            }}>
              {attr}
            </div>
          ))}
        </div>
      )}
      
      {nodeData.methods && nodeData.methods.length > 0 && (
        <div style={{
          padding: '4px 0',
          fontSize: '11px',
          color: '#374151',
          background: '#ffffff'
        }}>
          {nodeData.methods.map((method, index) => (
            <div key={index} style={{ 
              padding: '2px 12px',
              fontSize: '11px',
              fontFamily: 'monospace'
            }}>
              {method}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render UML Interface
  const renderUMLInterface = () => (
    <div style={{ width: '100%' }}>
      {selected && (
        <button
          onClick={handleDelete}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '22px',
            height: '22px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#dc2626';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#ef4444';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Delete node"
        >
          ×
        </button>
      )}
      
      <div style={{
        borderBottom: '1px solid #d1d5db',
        padding: '8px 12px',
        textAlign: 'center',
        fontWeight: 600,
        fontSize: '13px',
        color: '#1f2937',
        background: '#f9fafb',
        fontStyle: 'italic'
      }}>
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
        <div style={{
          padding: '4px 0',
          fontSize: '11px',
          color: '#374151',
          background: '#ffffff'
        }}>
          {nodeData.methods.map((method, index) => (
            <div key={index} style={{ 
              padding: '2px 12px',
              fontSize: '11px',
              fontFamily: 'monospace'
            }}>
              {method}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render UML Enumeration
  const renderUMLEnumeration = () => (
    <div style={{ width: '100%' }}>
      {selected && (
        <button
          onClick={handleDelete}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '22px',
            height: '22px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#dc2626';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#ef4444';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Delete node"
        >
          ×
        </button>
      )}
      
      <div style={{
        borderBottom: '1px solid #d1d5db',
        padding: '8px 12px',
        textAlign: 'center',
        fontWeight: 600,
        fontSize: '13px',
        color: '#1f2937',
        background: '#f9fafb',
        fontStyle: 'italic'
      }}>
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
        <div style={{
          padding: '4px 0',
          fontSize: '11px',
          color: '#374151',
          background: '#ffffff'
        }}>
          {nodeData.values.map((value, index) => (
            <div key={index} style={{ 
              padding: '2px 12px',
              fontSize: '11px',
              fontFamily: 'monospace'
            }}>
              {value}
            </div>
          ))}
        </div>
      )}
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

      {/* Midpoint handles per side; targets on Left/Top, sources on Right/Bottom */}
      {/* Left side: allow both target and source */}
      <Handle 
        type="target" 
        position={Position.Left} 
        isConnectable={isConnectable}
        id="left-target"
        style={{ 
          top: '50%',
          left: 0,
          transform: 'translateY(-50%)',
          background: '#6b7280',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          border: '2px solid #ffffff'
        }}
      />
      <Handle 
        type="source" 
        position={Position.Left} 
        isConnectable={isConnectable}
        id="left-source"
        style={{ 
          top: '50%',
          left: 0,
          transform: 'translateY(-50%)',
          background: '#6b7280',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          border: '2px solid #ffffff',
          boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.08)'
        }}
      />

      {/* Top side: allow both target and source */}
      <Handle 
        type="target" 
        position={Position.Top} 
        isConnectable={isConnectable}
        id="top-target"
        style={{ 
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#6b7280',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          border: '2px solid #ffffff'
        }}
      />
      <Handle 
        type="source" 
        position={Position.Top} 
        isConnectable={isConnectable}
        id="top-source"
        style={{ 
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#6b7280',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          border: '2px solid #ffffff',
          boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.08)'
        }}
      />

      {/* Right side: allow both source and target */}
      <Handle 
        type="source" 
        position={Position.Right} 
        isConnectable={isConnectable}
        id="right-source"
        style={{ 
          top: '50%',
          right: 0,
          transform: 'translateY(-50%)',
          background: '#6b7280',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          border: '2px solid #ffffff'
        }}
      />
      <Handle 
        type="target" 
        position={Position.Right} 
        isConnectable={isConnectable}
        id="right-target"
        style={{ 
          top: '50%',
          right: 0,
          transform: 'translateY(-50%)',
          background: '#6b7280',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          border: '2px solid #ffffff',
          boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.08)'
        }}
      />

      {/* Bottom side: allow both source and target */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        isConnectable={isConnectable}
        id="bottom-source"
        style={{ 
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#6b7280',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          border: '2px solid #ffffff'
        }}
      />
      <Handle 
        type="target" 
        position={Position.Bottom} 
        isConnectable={isConnectable}
        id="bottom-target"
        style={{ 
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#6b7280',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          border: '2px solid #ffffff',
          boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.08)'
        }}
      />
    </div>
  );
} 
