import React, { useState, useRef, KeyboardEvent } from 'react';

interface KeywordTagsInputProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  id?: string;
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '48px',
  border: '2px solid #d1ecf1',
  borderRadius: '8px',
  padding: '8px',
  background: '#f8f9fa',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '6px',
  cursor: 'text',
  transition: 'all 0.3s ease',
  fontFamily: 'Georgia, serif',
};

const containerFocusStyle: React.CSSProperties = {
  borderColor: '#049484',
  outline: 'none',
  boxShadow: '0 0 0 3px rgba(4, 148, 132, 0.1)',
  background: '#ffffff',
};

const tagStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 10px',
  background: 'linear-gradient(135deg, #049484 0%, #037368 100%)',
  color: '#ffffff',
  borderRadius: '6px',
  fontSize: '13px',
  fontWeight: 500,
};

const removeButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#ffffff',
  cursor: 'pointer',
  padding: '0 2px',
  fontSize: '16px',
  lineHeight: '1',
  fontWeight: 600,
  transition: 'opacity 0.2s ease',
};

const inputStyle: React.CSSProperties = {
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontSize: '14px',
  fontFamily: 'inherit',
  flex: '1',
  minWidth: '120px',
  padding: '4px',
  color: '#333',
};

export const KeywordTagsInput: React.FC<KeywordTagsInputProps> = ({
  keywords,
  onChange,
  placeholder = "Type keywords separated by commas or press Enter...",
  style,
  id
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

  const handleContainerKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleContainerClick();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Check if user typed a comma
    if (value.includes(',')) {
      const parts = value.split(',');
      const lastPart = parts.at(-1)?.trim() ?? '';
      const keywordsToAdd = parts.slice(0, -1).map(k => k.trim()).filter(k => k.length > 0);
      
      if (keywordsToAdd.length > 0) {
        const newKeywords = keywordsToAdd.filter(k => !keywords.includes(k));
        if (newKeywords.length > 0) {
          onChange([...keywords, ...newKeywords]);
        }
      }
      
      setInputValue(lastPart);
    } else {
      setInputValue(value);
    }
  };

  const handleInputBlur = () => {
    if (inputValue.trim()) {
      addKeyword();
    }
    setIsFocused(false);
  };

  const handleInputFocus = () => {
    setIsFocused(true);
  };

  const removeKeyword = (keywordToRemove: string) => {
    onChange(keywords.filter(k => k !== keywordToRemove));
  };

  return (
    <div
      style={{
        ...containerStyle,
        ...(isFocused ? containerFocusStyle : {}),
        ...style
      }}
      onClick={handleContainerClick}
      onKeyDown={handleContainerKeyDown}
      tabIndex={0}
      role="button"
      aria-label="Focus keyword input"
    >
      {keywords.map((keyword) => (
        <div key={keyword} style={tagStyle}>
          <span>{keyword}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeKeyword(keyword);
            }}
            style={removeButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.7';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            aria-label={`Remove ${keyword}`}
          >
            ×
          </button>
        </div>
      ))}
      
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        style={inputStyle}
        placeholder={keywords.length === 0 ? placeholder : ''}
      />
    </div>
  );
};
