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

// Types
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

type VisibilityType = '+' | '#' | '-';

// Constants
const VISIBILITY_OPTIONS: Array<{
  symbol: VisibilityType;
  label: string;
  color: string;
  hoverColor: string;
  title: string;
}> = [
  { symbol: '+', label: 'Public', color: '#28a745', hoverColor: '#218838', title: 'Public (+)' },
  { symbol: '#', label: 'Protected', color: '#ffc107', hoverColor: '#e0a800', title: 'Protected (#)' },
  { symbol: '-', label: 'Private', color: '#dc3545', hoverColor: '#c82333', title: 'Private (-)' },
];

// NOTE: element style presets were removed since node styles are composed via umlNodeStyles helpers

// Utility Functions
const createButtonStyle = (
  backgroundColor: string,
  hoverColor: string
) => ({
  base: {
    background: backgroundColor,
    color: backgroundColor === '#ffc107' ? '#212529' : 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '11px',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'center' as const,
    transition: 'background-color 0.2s',
  },
  getHoverHandlers: () => ({
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => 
      e.currentTarget.style.background = hoverColor,
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => 
      e.currentTarget.style.background = backgroundColor,
  }),
});

const createInputStyle = (editing: boolean, style?: React.CSSProperties): React.CSSProperties => ({
  width: '100%',
  border: editing ? '2px solid #0071e3' : 'none',
  borderRadius: '4px',
  padding: '4px',
  fontSize: 'inherit',
  fontFamily: 'inherit',
  outline: 'none',
  ...style,
});

// Sub-Components
const VisibilityButton: React.FC<{
  option: typeof VISIBILITY_OPTIONS[0];
  onSelect: (symbol: VisibilityType) => void;
}> = ({ option, onSelect }) => {
  const buttonStyle = createButtonStyle(option.color, option.hoverColor);
  
  return (
    <button
      onClick={() => onSelect(option.symbol)}
      style={{ ...buttonStyle.base, marginBottom: '4px' }}
      {...buttonStyle.getHoverHandlers()}
      title={option.title}
    >
      {option.symbol} {option.label}
    </button>
  );
};

const MenuOverlay: React.FC<{
  children: React.ReactNode;
  minWidth?: string;
}> = ({ children, minWidth = '120px' }) => (
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
    minWidth,
  }}>
    {children}
  </div>
);

const MenuTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: '11px',
    color: '#666',
    marginBottom: '4px',
    textAlign: 'center',
    fontWeight: 'bold',
  }}>
    {children}
  </div>
);

// Removed unused SectionHeader, ClassHeader and EditableList subcomponents

function EditableField({
  value,
  onSave,
  placeholder,
  style,
  multiline = false,
  onDelete,
  showDelete = false,
  showVisibility = false,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [showOptions, setShowOptions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showVisibilityOptions, setShowVisibilityOptions] = useState(false);
  const [selectedVisibility, setSelectedVisibility] = useState<VisibilityType>('+');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      const ref = multiline ? textareaRef : inputRef;
      ref.current?.focus();
      ref.current?.select();
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

  const handleVisibilitySave = () => {
    if (editValue.trim()) {
      onSave(`${selectedVisibility} ${editValue.trim()}`);
    }
    setEditing(false);
    setEditValue('');
  };

  const handleVisibilitySelect = (visibility: VisibilityType) => {
    setSelectedVisibility(visibility);
    setShowVisibilityOptions(false);
    setEditing(true);
  };

  const inputPlaceholder = showVisibility 
    ? `${selectedVisibility} name: Type` 
    : placeholder;

  if (editing) {
    const inputBaseStyle = createInputStyle(true, style);
    const onBlur = showVisibility ? handleVisibilitySave : handleSave;

    const commonProps = {
      value: editValue,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => 
        setEditValue(e.target.value),
      onBlur,
      onKeyDown: handleKeyDown,
      placeholder: inputPlaceholder,
    };

    if (multiline) {
      return (
        <textarea
          ref={textareaRef}
          {...commonProps}
          style={{ ...inputBaseStyle, resize: 'vertical', minHeight: '60px' }}
        />
      );
    }

    return <input ref={inputRef} {...commonProps} style={inputBaseStyle} />;
  }

  const getTitle = () => {
    if (showVisibility) return "Click to add new item";
    if (showDelete && onDelete) return "Click to show options, double-click to edit";
    return "Double-click to edit";
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        onDoubleClick={() => setEditing(true)}
        onClick={showVisibility 
          ? () => setShowVisibilityOptions(true) 
          : () => setShowOptions(!showOptions)
        }
        style={{
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: '2px',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          ...style,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f0f0f0';
          e.currentTarget.style.transform = 'scale(1.02)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title={getTitle()}
      >
        {value || placeholder}
      </div>

      {showVisibilityOptions && showVisibility && (
        <MenuOverlay>
          <MenuTitle>Select visibility:</MenuTitle>
          {VISIBILITY_OPTIONS.map((option) => (
            <VisibilityButton
              key={option.symbol}
              option={option}
              onSelect={handleVisibilitySelect}
            />
          ))}
        </MenuOverlay>
      )}

      {showOptions && showDelete && onDelete && (
        <MenuOverlay>
          <button
            onClick={() => {
              setShowOptions(false);
              setEditing(true);
            }}
            style={createButtonStyle('#0071e3', '#005bb5').base}
            {...createButtonStyle('#0071e3', '#005bb5').getHoverHandlers()}
            title="Edit this item"
          >
            ✏️ Edit
          </button>
          <button
            onClick={() => {
              setShowOptions(false);
              setShowDeleteConfirm(true);
            }}
            style={{ ...createButtonStyle('#ff6b6b', '#ff5252').base, marginTop: '4px' }}
            {...createButtonStyle('#ff6b6b', '#ff5252').getHoverHandlers()}
            title="Delete this item"
          >
            🗑️ Delete
          </button>
        </MenuOverlay>
      )}

      {showDeleteConfirm && onDelete && (
        <MenuOverlay minWidth="150px">
          <div style={{
            fontSize: '11px',
            color: '#666',
            marginBottom: '8px',
            textAlign: 'center',
          }}>
            Are you sure you want to delete this?
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => {
                onDelete();
                setShowDeleteConfirm(false);
              }}
              style={{ ...createButtonStyle('#ff6b6b', '#ff5252').base, flex: 1, fontSize: '10px' }}
              {...createButtonStyle('#ff6b6b', '#ff5252').getHoverHandlers()}
            >
              Yes, Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              style={{ ...createButtonStyle('#6c757d', '#5a6268').base, flex: 1, fontSize: '10px' }}
              {...createButtonStyle('#6c757d', '#5a6268').getHoverHandlers()}
            >
              Cancel
            </button>
          </div>
        </MenuOverlay>
      )}
    </div>
  );
}

// Main Component
export function EditableNode({ id, data, selected, isConnectable }: NodeProps<UMLNodeData>) {
  const nodeData = data || {};

  const updateNodeData = (updates: Partial<UMLNodeData>) => {
    console.log('Node data update:', updates);
  };

  const handleDelete = () => {
    nodeData.onDelete?.(id);
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
    }

    if (nodeData.toolType === 'member' || nodeData.toolType === 'multiplicity') {
      return {
        ...baseStyle,
        minHeight: nodeData.toolType === 'member' ? '40px' : '30px',
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

  // Member node is handled by renderSimpleNode via getRenderer

  // Simple fallback renderer for generic items
  const renderSimpleNode = (defaultPlaceholder: string, textColor?: string) => (
    <div style={{ width: '100%', textAlign: 'center', padding: '8px' }}>
      <EditableField
        value={nodeData.label || ''}
        onSave={(newValue) => updateNodeData({ label: newValue })}
        placeholder={defaultPlaceholder}
        style={{
          fontSize: '14px',
          fontWeight: 'bold',
          ...(textColor ? { color: textColor } : {}),
        }}
      />
    </div>
  );

  const getRenderer = () => {
    const { toolType, toolName } = nodeData;

    if (toolType === 'element') {
      switch (toolName) {
        case 'class':
          return renderUMLClass();
        case 'abstract-class':
          return renderUMLAbstractClass();
        case 'interface':
          return renderUMLInterface();
        case 'enumeration':
          return renderUMLEnumeration();
        case 'package':
          return renderUMLPackage();
        default:
          return renderSimpleNode('Element');
      }
    }

    if (toolType === 'member') return renderSimpleNode('+ member: Type');
    if (toolType === 'multiplicity') return renderSimpleNode('1', '#e74c3c');
    
    return renderSimpleNode('Relationship');
  };

  return (
    <div style={getNodeStyle()}>
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