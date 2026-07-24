import React, { useState } from 'react';
import { EyeIcon, EyeOffIcon } from '../ui/PasswordVisibilityIcons';

interface PasswordInputProps {
  id: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInput?: (e: React.FormEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
}

export function PasswordInput({
  id,
  name,
  value,
  onChange,
  onInput,
  placeholder,
  disabled = false,
  required = false,
  autoComplete,
}: Readonly<PasswordInputProps>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="mock-password-field">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        onInput={onInput}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="mock-password-toggle"
        onClick={() => setVisible(prev => !prev)}
        disabled={disabled}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
