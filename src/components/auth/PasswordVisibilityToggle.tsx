import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordVisibilityToggleProps {
  inputId: string;
  fieldLabel: string;
  isVisible: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function PasswordVisibilityToggle({
  inputId,
  fieldLabel,
  isVisible,
  onToggle,
  disabled = false,
}: Readonly<PasswordVisibilityToggleProps>) {
  const action = isVisible ? 'Hide' : 'Show';
  const accessibleLabel = `${action} ${fieldLabel}`;

  return (
    <button
      type="button"
      className="password-visibility-toggle"
      aria-controls={inputId}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      onClick={onToggle}
      disabled={disabled}
    >
      {isVisible ? (
        <EyeOff aria-hidden="true" size={18} />
      ) : (
        <Eye aria-hidden="true" size={18} />
      )}
    </button>
  );
}
