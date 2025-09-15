import React, { useState, useRef, KeyboardEvent } from 'react';

interface KeywordTagsInputProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

// Color palette for text colors - highly visible against white background
const TEXT_COLORS = [
  '#d32f2f', // Dark Red
  '#1976d2', // Dark Blue
  '#388e3c', // Dark Green
  '#f57c00', // Dark Orange
  '#7b1fa2', // Dark Purple
  '#00796b', // Dark Teal
  '#c2185b', // Dark Pink
  '#5d4037', // Dark Brown
  '#303f9f', // Indigo
  '#e64a19', // Deep Orange
];

const getTextColor = (index: number): string => {
  return TEXT_COLORS[index % TEXT_COLORS.length];
};

const containerStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '48px',
  border: '2px solid #d1ecf1',
  borderRadius: '6px',
  padding: '8px',
  background: '#f8f9fa',
  display: 'flex',
  alignItems: 'center',
  cursor: 'text',
  transition: 'all 0.3s ease',
  fontFamily: 'Georgia, serif',
  position: 'relative',
};

const containerFocusStyle: React.CSSProperties = {
  borderColor: '#3498db',
  outline: 'none',
  boxShadow: '0 0 0 3px rgba(52, 152, 219, 0.1)',
  background: '#ffffff',
};

const inputStyle: React.CSSProperties = {
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontSize: '14px',
  fontFamily: 'inherit',
  width: '100%',
  padding: '4px',
  color: '#333',
};

const placeholderStyle: React.CSSProperties = {
  color: '#999',
  fontSize: '14px',
  fontStyle: 'italic',
  pointerEvents: 'none',
  position: 'absolute',
  left: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
};

const coloredTextStyle: React.CSSProperties = {
  position: 'absolute',
  left: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: '14px',
  fontFamily: 'inherit',
  pointerEvents: 'none',
  whiteSpace: 'pre',
  zIndex: 1,
};

export const KeywordTagsInput: React.FC<KeywordTagsInputProps> = ({
  keywords,
  onChange,
  placeholder = "Type keywords and press Enter...",
  style
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  };

  const addKeyword = () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !keywords.includes(trimmedValue)) {
      onChange([...keywords, trimmedValue]);
      setInputValue('');
    }
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    // Add keyword if there's text in input when losing focus
    if (inputValue.trim()) {
      addKeyword();
    }
    setIsFocused(false);
  };

  const handleInputFocus = () => {
    setIsFocused(true);
  };

  // Create colored text display
  const renderColoredText = () => {
    if (keywords.length === 0) return null;
    
    // Build colored display of keywords and current input value
    
    return (
      <div style={coloredTextStyle}>
        {keywords.map((keyword, keywordIndex) => (
          <span key={keywordIndex}>
            {keywordIndex > 0 && <span style={{ color: '#333' }}>, </span>}
            {keyword.split('').map((char, charIndex) => (
              <span
                key={`${keywordIndex}-${charIndex}`}
                style={{ color: getTextColor(keywordIndex) }}
              >
                {char}
              </span>
            ))}
          </span>
        ))}
        {inputValue && (
          <>
            {keywords.length > 0 && <span style={{ color: '#333' }}>, </span>}
            <span style={{ color: '#333' }}>{inputValue}</span>
          </>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        ...containerStyle,
        ...(isFocused ? containerFocusStyle : {}),
        ...style
      }}
      onClick={handleContainerClick}
    >
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        style={{
          ...inputStyle,
          color: keywords.length > 0 ? 'transparent' : '#333',
        }}
        placeholder=""
      />
      
      {renderColoredText()}
      
      {keywords.length === 0 && !isFocused && (
        <div style={placeholderStyle}>
          {placeholder}
        </div>
      )}
    </div>
  );
};
