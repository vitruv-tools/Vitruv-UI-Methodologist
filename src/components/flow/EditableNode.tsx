import React, { useState, useRef, useEffect } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';

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

interface ElementStyleConfig {
  borderColor: string;
  background: string;
  selectedBackground: string;
  headerBackground: string;
  sectionBackground: string;
  minHeight: string;
  borderStyle?: string;
  fontStyle?: string;
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

const ELEMENT_STYLES: Record<string, ElementStyleConfig> = {
  class: {
    borderColor: '#2ecc71',
    background: '#ffffff',
    selectedBackground: '#f0f9f0',
    headerBackground: '#f8fff8',
    sectionBackground: '#f0f9f0',
    minHeight: '140px',
  },
  'abstract-class': {
    borderColor: '#16a085',
    background: '#ffffff',
    selectedBackground: '#f0f8f0',
    headerBackground: '#f0f8f0',
    sectionBackground: '#f0f8f0',
    minHeight: '140px',
    fontStyle: 'italic',
  },
  interface: {
    borderColor: '#e74c3c',
    background: '#ffffff',
    selectedBackground: '#fdf0f0',
    headerBackground: '#fdf0f0',
    sectionBackground: '#fdf0f0',
    borderStyle: 'dashed',
    minHeight: '120px',
  },
  enumeration: {
    borderColor: '#9b59b6',
    background: '#ffffff',
    selectedBackground: '#f8f0f8',
    headerBackground: '#f8f0f8',
    sectionBackground: '#f8f0f8',
    minHeight: '120px',
  },
  package: {
    borderColor: '#f39c12',
    background: '#ffffff',
    selectedBackground: '#fdf8f0',
    headerBackground: '#fdf8f0',
    sectionBackground: '#fdf8f0',
    minHeight: '100px',
  },
};

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

const updateArray = <T,>(
  array: T[] | undefined,
  index: number,
  operation: 'update' | 'delete',
  newValue?: T
): T[] => {
  const arr = array || [];
  if (operation === 'delete') {
    return arr.filter((_, i) => i !== index);
  }
  const newArr = [...arr];
  if (newValue !== undefined) {
    newArr[index] = newValue;
  }
  return newArr;
};

const addToArray = <T,>(array: T[] | undefined, value: T): T[] => {
  return [...(array || []), value];
};

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

const DeleteButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'absolute',
        top: '-8px',
        right: '-8px',
        background: isHovered ? '#c0392b' : '#e74c3c',
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
        transition: 'all 0.2s ease',
        transform: isHovered ? 'scale(1.1)' : 'scale(1)',
      }}
      title="Delete node"
    >
      ×
    </button>
  );
};

const SectionHeader: React.FC<{
  title: string;
  color: string;
  background: string;
}> = ({ title, color, background }) => (
  <div style={{
    padding: '4px 8px',
    fontWeight: 'bold',
    color,
    background,
  }}>
    {title}
  </div>
);

const ClassHeader: React.FC<{
  value: string;
  placeholder: string;
  onSave: (value: string) => void;
  style: ElementStyleConfig;
  stereotype?: string;
}> = ({ value, placeholder, onSave, style, stereotype }) => (
  <div style={{
    background: style.headerBackground,
    borderBottom: `1px solid ${style.borderColor}`,
    padding: '8px 0',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: '14px',
    color: style.borderColor,
    minHeight: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    {stereotype && (
      <div style={{ fontStyle: 'italic', marginRight: '8px' }}>
        &lt;&lt;{stereotype}&gt;&gt;
      </div>
    )}
    <EditableField
      value={value}
      onSave={onSave}
      placeholder={placeholder}
      style={{
        fontWeight: 'bold',
        fontSize: '14px',
        color: style.borderColor,
        textAlign: 'center',
        ...(style.fontStyle && { fontStyle: style.fontStyle }),
      }}
    />
  </div>
);

const EditableList: React.FC<{
  items: string[] | undefined;
  placeholder: string;
  addPlaceholder: string;
  onUpdate: (items: string[]) => void;
  showVisibility?: boolean;
}> = ({ items, placeholder, addPlaceholder, onUpdate, showVisibility = false }) => (
  <>
    {items?.map((item, index) => (
      <div key={index} style={{
        padding: '2px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <EditableField
          value={item}
          onSave={(newValue) => onUpdate(updateArray(items, index, 'update', newValue))}
          placeholder={placeholder}
          style={{ fontSize: '12px', flex: 1 }}
          onDelete={() => onUpdate(updateArray(items, index, 'delete'))}
          showDelete={true}
        />
      </div>
    ))}
    <div style={{ padding: '2px 8px' }}>
      <EditableField
        value=""
        onSave={(newValue) => {
          if (newValue.trim()) {
            onUpdate(addToArray(items, newValue));
          }
        }}
        placeholder={addPlaceholder}
        style={{ fontSize: '12px', fontStyle: 'italic', color: '#999' }}
        showVisibility={showVisibility}
      />
    </div>
  </>
);

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

  const getNodeStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      padding: '0px',
      background: selected ? '#f7f9fa' : '#fff',
      border: selected ? '2px solid #0071e3' : '2px solid #333',
      borderRadius: '0px',
      minWidth: '200px',
      boxShadow: selected ? '0 0 0 2px #cde3fa' : '0 4px 12px rgba(0,0,0,0.15)',
      position: 'relative',
      fontFamily: 'Arial, sans-serif',
      overflow: 'hidden',
    };

    const toolName = nodeData.toolName;
    const elementStyle = toolName && ELEMENT_STYLES[toolName];

    if (nodeData.toolType === 'element' && elementStyle) {
      return {
        ...baseStyle,
        borderColor: elementStyle.borderColor,
        borderWidth: '2px',
        borderStyle: elementStyle.borderStyle || 'solid',
        background: selected ? elementStyle.selectedBackground : elementStyle.background,
        minHeight: elementStyle.minHeight,
        boxShadow: selected 
          ? '0 0 0 2px #cde3fa' 
          : `0 4px 16px ${elementStyle.borderColor}33`,
        ...(elementStyle.fontStyle && { fontStyle: elementStyle.fontStyle }),
      };
    }

    if (nodeData.toolType === 'member' || nodeData.toolType === 'multiplicity') {
      return {
        ...baseStyle,
        minHeight: nodeData.toolType === 'member' ? '40px' : '30px',
        borderRadius: '4px',
        boxShadow: selected ? '0 0 0 2px #cde3fa' : '0 2px 8px rgba(0,0,0,0.1)',
      };
    }

    return baseStyle;
  };

  const renderUMLStructure = (
    styleConfig: ElementStyleConfig,
    sections: Array<{
      title: string;
      items?: string[];
      placeholder: string;
      addPlaceholder: string;
      dataKey: 'attributes' | 'methods' | 'values';
    }>,
    headerPlaceholder: string,
    stereotype?: string
  ) => (
    <div style={{ width: '100%' }}>
      {selected && <DeleteButton onClick={handleDelete} />}
      
      <ClassHeader
        value={nodeData.className || nodeData.packageName || ''}
        placeholder={headerPlaceholder}
        onSave={(newValue) => updateNodeData(
          stereotype === 'package' ? { packageName: newValue } : { className: newValue }
        )}
        style={styleConfig}
        stereotype={stereotype}
      />

      {sections.map((section, idx) => (
        <div
          key={section.title}
          style={{
            borderBottom: idx < sections.length - 1 ? `1px solid ${styleConfig.borderColor}` : undefined,
            padding: '8px 0',
            fontSize: '12px',
            color: '#666',
            minHeight: '50px',
          }}
        >
          <SectionHeader
            title={section.title}
            color={styleConfig.borderColor}
            background={styleConfig.sectionBackground}
          />
          {section.title === 'Contents' ? (
            <div style={{ padding: '2px 8px', fontStyle: 'italic', color: '#999' }}>
              Drag classes here...
            </div>
          ) : (
            <EditableList
              items={nodeData[section.dataKey]}
              placeholder={section.placeholder}
              addPlaceholder={section.addPlaceholder}
              onUpdate={(newItems) => updateNodeData({ [section.dataKey]: newItems })}
              showVisibility={section.dataKey !== 'values'}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderSimpleNode = (placeholder: string, color?: string) => (
    <div style={{ width: '100%', textAlign: 'center', padding: '8px' }}>
      <EditableField
        value={nodeData.label || ''}
        onSave={(newValue) => updateNodeData({ label: newValue })}
        placeholder={placeholder}
        style={{ 
          fontSize: '14px', 
          fontWeight: 'bold',
          ...(color && { color }),
        }}
      />
    </div>
  );

  const getRenderer = () => {
    const { toolType, toolName } = nodeData;

    if (toolType === 'element') {
      const styleConfig = toolName && ELEMENT_STYLES[toolName];
      
      if (!styleConfig) return renderSimpleNode('Relationship');

      const configs: Record<string, any> = {
        'class': {
          sections: [
            { title: 'Attributes', dataKey: 'attributes', placeholder: '+ attribute: Type', addPlaceholder: '+ Add attribute...' },
            { title: 'Methods', dataKey: 'methods', placeholder: '+ method(): ReturnType', addPlaceholder: '+ Add method...' },
          ],
          placeholder: 'Class Name',
        },
        'abstract-class': {
          sections: [
            { title: 'Attributes', dataKey: 'attributes', placeholder: '+ attribute: Type', addPlaceholder: '+ Add attribute...' },
            { title: 'Methods', dataKey: 'methods', placeholder: '+ method(): ReturnType', addPlaceholder: '+ Add method...' },
          ],
          placeholder: 'Abstract Class Name',
          stereotype: 'abstract',
        },
        'interface': {
          sections: [
            { title: 'Methods', dataKey: 'methods', placeholder: '+ method(): ReturnType', addPlaceholder: '+ Add method...' },
          ],
          placeholder: 'Interface Name',
          stereotype: 'interface',
        },
        'enumeration': {
          sections: [
            { title: 'Values', dataKey: 'values', placeholder: 'Value', addPlaceholder: 'Add value...' },
          ],
          placeholder: 'Enumeration Name',
          stereotype: 'enumeration',
        },
        'package': {
          sections: [
            { title: 'Contents', dataKey: 'methods', placeholder: '', addPlaceholder: '' },
          ],
          placeholder: 'Package Name',
          stereotype: 'package',
        },
      };

      const config = configs[toolName];
      if (config) {
        return renderUMLStructure(
          styleConfig,
          config.sections,
          config.placeholder,
          config.stereotype
        );
      }
    }

    if (toolType === 'member') return renderSimpleNode('+ member: Type');
    if (toolType === 'multiplicity') return renderSimpleNode('1', '#e74c3c');
    
    return renderSimpleNode('Relationship');
  };

  return (
    <div style={getNodeStyle()}>
      {getRenderer()}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        style={{ background: '#0071e3', width: '8px', height: '8px' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={{ background: '#0071e3', width: '8px', height: '8px' }}
      />
    </div>
  );
}