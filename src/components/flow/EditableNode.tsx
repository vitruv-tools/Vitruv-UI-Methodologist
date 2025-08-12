import React, { useState, useRef, useEffect } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';

interface UMLNodeData {
  label: string;
  toolType?: string;
  toolName?: string;
  diagramType?: string;
  onLabelChange?: (id: string, label: string) => void;
}

export function EditableNode({ id, data, selected, isConnectable, xPos, yPos, ...rest }: NodeProps<UMLNodeData>) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label || '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Debug logging
  console.log('EditableNode render:', { id, data, selected });

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  // Save label and exit edit mode
  const save = () => {
    setEditing(false);
    if (data.onLabelChange) {
      data.onLabelChange(id, label);
    }
  };

  // Get node style based on tool type
  const getNodeStyle = () => {
    const baseStyle = {
      padding: '0px', // Remove padding to let UML compartments handle spacing
      background: selected ? '#f7f9fa' : '#fff',
      border: selected ? '2px solid #0071e3' : '2px solid #333',
      borderRadius: '0px', // UML elements typically have sharp corners
      minWidth: '200px', // Increased for better UML appearance
      boxShadow: selected ? '0 0 0 2px #cde3fa' : '0 4px 12px rgba(0,0,0,0.15)',
      position: 'relative' as const,
      fontFamily: 'Arial, sans-serif',
      overflow: 'hidden', // Ensure clean edges
    };

    // Apply specific styles based on tool type
    if (data.toolType === 'element') {
      switch (data.toolName) {
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
          return baseStyle; // Add default case for unknown element types
      }
    } else if (data.toolType === 'member') {
      return {
        ...baseStyle,
        borderColor: '#1abc9c',
        borderWidth: '1px',
        background: selected ? '#f0f9f0' : '#f8f9fa',
        minWidth: '140px',
        minHeight: '50px',
        fontSize: '12px',
        padding: '8px 12px',
        borderRadius: '4px', // Slight rounding for members
      };
    } else if (data.toolType === 'relationship') {
      return {
        ...baseStyle,
        borderColor: '#34495e',
        borderWidth: '1px',
        background: selected ? '#f0f0f0' : '#f8f8f8',
        minWidth: '140px',
        minHeight: '60px',
        textAlign: 'center' as const,
        borderRadius: '20px', // Relationships are typically rounded
        padding: '12px',
      };
    } else if (data.toolType === 'multiplicity') {
      return {
        ...baseStyle,
        borderColor: '#e74c3c',
        borderWidth: '1px',
        background: selected ? '#fdf0f0' : '#ffffff',
        minWidth: '50px',
        minHeight: '40px',
        textAlign: 'center' as const,
        fontSize: '14px',
        fontWeight: 'bold',
        padding: '8px',
        borderRadius: '4px',
      };
    }

    return baseStyle;
  };

  // Render UML Class structure
  const renderUMLClass = () => (
    <div style={{ width: '100%' }}>
      {/* Class name section */}
      <div style={{
        borderBottom: '1px solid #2ecc71',
        padding: '12px 8px',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '14px',
        color: '#2ecc71',
        background: '#f8fff8',
        minHeight: '20px'
      }}>
        {editing ? (
          <input
            ref={inputRef}
            value={label}
            style={{ 
              width: '100%', 
              border: 'none', 
              background: 'transparent',
              fontSize: '14px',
              fontWeight: 'bold',
              outline: 'none',
              textAlign: 'center',
              color: '#2ecc71'
            }}
            onChange={e => setLabel(e.target.value)}
            onBlur={save}
            onKeyDown={e => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <div
            onDoubleClick={() => setEditing(true)}
            style={{ cursor: 'pointer' }}
            title="Double-click to rename"
          >
            {label}
          </div>
        )}
      </div>
      
      {/* Attributes section */}
      <div style={{
        borderBottom: '1px solid #2ecc71',
        padding: '8px 0',
        minHeight: '50px',
        fontSize: '12px',
        color: '#666',
        background: '#ffffff'
      }}>
        <div style={{ 
          padding: '6px 8px', 
          fontStyle: 'italic',
          fontWeight: '600',
          color: '#2ecc71',
          background: '#f8fff8',
          borderBottom: '1px solid #e8f5e8'
        }}>
          Attributes
        </div>
        <div style={{ padding: '4px 8px' }}>+ name: String</div>
        <div style={{ padding: '4px 8px' }}>+ age: Integer</div>
        <div style={{ padding: '4px 8px' }}>- id: Long</div>
      </div>
      
      {/* Methods section */}
      <div style={{
        padding: '8px 0',
        fontSize: '12px',
        color: '#666',
        background: '#ffffff'
      }}>
        <div style={{ 
          padding: '6px 8px', 
          fontStyle: 'italic',
          fontWeight: '600',
          color: '#2ecc71',
          background: '#f8fff8'
        }}>
          Methods
        </div>
        <div style={{ padding: '4px 8px' }}>+ getName(): String</div>
        <div style={{ padding: '4px 8px' }}>+ setAge(age: Integer)</div>
        <div style={{ padding: '4px 8px' }}>+ calculate(): Double</div>
      </div>
    </div>
  );

  // Render UML Abstract Class structure
  const renderUMLAbstractClass = () => (
    <div style={{ width: '100%' }}>
      {/* Abstract class name section */}
      <div style={{
        borderBottom: '1px solid #16a085',
        padding: '12px 8px',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '14px',
        color: '#16a085',
        fontStyle: 'italic',
        background: '#f0f8f0',
        minHeight: '20px'
      }}>
        {editing ? (
          <input
            ref={inputRef}
            value={label}
            style={{ 
              width: '100%', 
              border: 'none', 
              background: 'transparent',
              fontSize: '14px',
              fontWeight: 'bold',
              outline: 'none',
              textAlign: 'center',
              color: '#16a085',
              fontStyle: 'italic'
            }}
            onChange={e => setLabel(e.target.value)}
            onBlur={save}
            onKeyDown={e => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <div
            onDoubleClick={() => setEditing(true)}
            style={{ cursor: 'pointer' }}
            title="Double-click to rename"
          >
            &lt;&lt;abstract&gt;&gt;
            <br />
            {label}
          </div>
        )}
      </div>
      
      {/* Attributes section */}
      <div style={{
        borderBottom: '1px solid #16a085',
        padding: '8px 0',
        minHeight: '50px',
        fontSize: '12px',
        color: '#666',
        background: '#ffffff'
      }}>
        <div style={{ 
          padding: '6px 8px', 
          fontStyle: 'italic',
          fontWeight: '600',
          color: '#16a085',
          background: '#f0f8f0',
          borderBottom: '1px solid #e0f0e0'
        }}>
          Attributes
        </div>
        <div style={{ padding: '4px 8px' }}>+ name: String</div>
        <div style={{ padding: '4px 8px' }}>+ age: Integer</div>
        <div style={{ padding: '4px 8px' }}># type: String</div>
      </div>
      
      {/* Methods section */}
      <div style={{
        padding: '8px 0',
        fontSize: '12px',
        color: '#666',
        background: '#ffffff'
      }}>
        <div style={{ 
          padding: '6px 8px', 
          fontStyle: 'italic',
          fontWeight: '600',
          color: '#16a085',
          background: '#f0f8f0'
        }}>
          Methods
        </div>
        <div style={{ padding: '4px 8px' }}>+ getName(): String</div>
        <div style={{ padding: '4px 8px' }}>+ setAge(age: Integer)</div>
        <div style={{ padding: '4px 8px' }}># abstractMethod(): void</div>
      </div>
    </div>
  );

  // Render UML Interface structure
  const renderUMLInterface = () => (
    <div style={{ width: '100%' }}>
      {/* Interface name section */}
      <div style={{
        borderBottom: '1px solid #e74c3c',
        padding: '12px 8px',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '14px',
        color: '#e74c3c',
        background: '#fdf0f0',
        minHeight: '20px'
      }}>
        {editing ? (
          <input
            ref={inputRef}
            value={label}
            style={{ 
              width: '100%', 
              border: 'none', 
              background: 'transparent',
              fontSize: '14px',
              fontWeight: 'bold',
              outline: 'none',
              textAlign: 'center',
              color: '#e74c3c'
            }}
            onChange={e => setLabel(e.target.value)}
            onBlur={save}
            onKeyDown={e => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <div
            onDoubleClick={() => setEditing(true)}
            style={{ cursor: 'pointer' }}
            title="Double-click to rename"
          >
            &lt;&lt;interface&gt;&gt;
            <br />
            {label}
          </div>
        )}
      </div>
      
      {/* Methods section */}
      <div style={{
        padding: '8px 0',
        fontSize: '12px',
        color: '#666',
        background: '#ffffff'
      }}>
        <div style={{ 
          padding: '6px 8px', 
          fontStyle: 'italic',
          fontWeight: '600',
          color: '#e74c3c',
          background: '#fdf0f0'
        }}>
          Methods
        </div>
        <div style={{ padding: '4px 8px' }}>+ calculate(): Double</div>
        <div style={{ padding: '4px 8px' }}>+ validate(): Boolean</div>
        <div style={{ padding: '4px 8px' }}>+ process(): void</div>
      </div>
    </div>
  );

  // Render UML Enumeration structure
  const renderUMLEnumeration = () => (
    <div style={{ width: '100%' }}>
      {/* Enum name section */}
      <div style={{
        borderBottom: '1px solid #9b59b6',
        padding: '8px 0',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '14px',
        color: '#9b59b6'
      }}>
        {editing ? (
          <input
            ref={inputRef}
            value={label}
            style={{ 
              width: '100%', 
              border: 'none', 
              background: 'transparent',
              fontSize: '14px',
              fontWeight: 'bold',
              outline: 'none',
              textAlign: 'center',
              color: '#9b59b6'
            }}
            onChange={e => setLabel(e.target.value)}
            onBlur={save}
            onKeyDown={e => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <div
            onDoubleClick={() => setEditing(true)}
            style={{ cursor: 'pointer' }}
            title="Double-click to rename"
          >
            &lt;&lt;enumeration&gt;&gt;
            <br />
            {label}
          </div>
        )}
      </div>
      
      {/* Values section */}
      <div style={{
        padding: '8px 0',
        fontSize: '12px',
        color: '#666'
      }}>
        <div style={{ padding: '4px 8px', fontStyle: 'italic' }}>Values</div>
        <div style={{ padding: '4px 8px' }}>RED</div>
        <div style={{ padding: '4px 8px' }}>GREEN</div>
        <div style={{ padding: '4px 8px' }}>BLUE</div>
      </div>
    </div>
  );

  // Render UML Package structure
  const renderUMLPackage = () => (
    <div style={{ width: '100%' }}>
      {/* Package name section */}
      <div style={{
        borderBottom: '1px solid #f39c12',
        borderRight: '1px solid #f39c12',
        padding: '8px 0',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '14px',
        color: '#f39c12',
        position: 'relative'
      }}>
        {editing ? (
          <input
            ref={inputRef}
            value={label}
            style={{ 
              width: '100%', 
              border: 'none', 
              background: 'transparent',
              fontSize: '14px',
              fontWeight: 'bold',
              outline: 'none',
              textAlign: 'center',
              color: '#f39c12'
            }}
            onChange={e => setLabel(e.target.value)}
            onBlur={save}
            onKeyDown={e => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <div
            onDoubleClick={() => setEditing(true)}
            style={{ cursor: 'pointer' }}
            title="Double-click to rename"
          >
            {label}
          </div>
        )}
      </div>
      
      {/* Package content area */}
      <div style={{
        padding: '20px 8px',
        fontSize: '12px',
        color: '#666',
        textAlign: 'center',
        fontStyle: 'italic'
      }}>
        Package contents
      </div>
    </div>
  );

  // Render UML Member (Attribute/Method)
  const renderUMLMember = () => (
    <div style={{ width: '100%', textAlign: 'center' }}>
      {editing ? (
        <input
          ref={inputRef}
          value={label}
          style={{ 
            width: '100%', 
            border: 'none', 
            background: 'transparent',
            fontSize: '12px',
            fontWeight: 'bold',
            outline: 'none',
            textAlign: 'center',
            color: '#1abc9c'
          }}
          onChange={e => setLabel(e.target.value)}
          onBlur={save}
          onKeyDown={e => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          style={{ cursor: 'pointer', fontWeight: 'bold', color: '#1abc9c' }}
          title="Double-click to rename"
        >
          {label}
        </div>
      )}
    </div>
  );

  // Render relationship
  const renderRelationship = () => (
    <div style={{ width: '100%', textAlign: 'center' }}>
      {editing ? (
        <input
          ref={inputRef}
          value={label}
          style={{ 
            width: '100%', 
            border: 'none', 
            background: 'transparent',
            fontSize: '14px',
            fontWeight: 'bold',
            outline: 'none',
            textAlign: 'center',
            color: '#34495e'
          }}
          onChange={e => setLabel(e.target.value)}
          onBlur={save}
          onKeyDown={e => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          style={{ cursor: 'pointer', fontWeight: 'bold', color: '#34495e' }}
          title="Double-click to rename"
        >
          {label}
        </div>
      )}
    </div>
  );

  // Render multiplicity label
  const renderMultiplicity = () => (
    <div style={{ width: '100%', textAlign: 'center' }}>
      {editing ? (
        <input
          ref={inputRef}
          value={label}
          style={{ 
            width: '100%', 
            border: 'none', 
            background: 'transparent',
            fontSize: '14px',
            fontWeight: 'bold',
            outline: 'none',
            textAlign: 'center',
            color: '#e74c3c'
          }}
          onChange={e => setLabel(e.target.value)}
          onBlur={save}
          onKeyDown={e => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          style={{ cursor: 'pointer', fontWeight: 'bold', color: '#e74c3c' }}
          title="Double-click to rename"
        >
          {label}
        </div>
      )}
    </div>
  );

  // Get the appropriate renderer based on tool type
  const getRenderer = () => {
    console.log('getRenderer called with:', { toolType: data.toolType, toolName: data.toolName });
    
    if (data.toolType === 'element') {
      switch (data.toolName) {
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
          return renderRelationship(); // Fallback for unknown elements
      }
    } else if (data.toolType === 'member') {
      console.log('Rendering UML Member');
      return renderUMLMember();
    } else if (data.toolType === 'relationship') {
      console.log('Rendering Relationship');
      return renderRelationship();
    } else if (data.toolType === 'multiplicity') {
      console.log('Rendering Multiplicity');
      return renderMultiplicity();
    }
    
    console.log('No specific renderer found, using default');
    // Default renderer for other types
    return (
      <div style={{ width: '100%', textAlign: 'center' }}>
        {editing ? (
          <input
            ref={inputRef}
            value={label}
            style={{ 
              width: '100%', 
              border: 'none', 
              background: 'transparent',
              fontSize: '14px',
              fontWeight: 'bold',
              outline: 'none',
              textAlign: 'center'
            }}
            onChange={e => setLabel(e.target.value)}
            onBlur={save}
            onKeyDown={e => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <div
            onDoubleClick={() => setEditing(true)}
            style={{ cursor: 'pointer', fontWeight: 'bold' }}
            title="Double-click to rename"
          >
            {label}
          </div>
        )}
      </div>
    );
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