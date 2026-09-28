import React from 'react';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import type { LowCodeReactionFieldMetadata } from '../../types/LowCodeReactionFieldMetadata';
import {
  isBooleanField,
  isEnumField,
  isIntegerField,
  isDecimalField,
  isCharacterField,
  isArrayField,
  isMapField,
  validateFieldValue,
} from '../../utils/FieldUtils';

interface FieldRendererProps {
  field: LowCodeReactionFieldMetadata;
  value: unknown;
  onChange: (name: string, value: unknown) => void;
  disabled?: boolean;
}

type FieldControlProps = {
  field: LowCodeReactionFieldMetadata;
  value: unknown;
  onChange: (name: string, value: unknown) => void;
  disabled: boolean;
  label: string;
  description?: string;
  required: boolean;
  error: string | null;
};

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  return '';
}

function asJsonText(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value ?? '', null, 2);
}

function numberBounds(field: LowCodeReactionFieldMetadata): { min?: number; max?: number } {
  const bounds: { min?: number; max?: number } = {};
  if (field.min !== null) bounds.min = field.min;
  if (field.max !== null) bounds.max = field.max;
  return bounds;
}

function parseNumberInput(raw: string, parser: (text: string) => number): number | '' {
  const parsed = parser(raw);
  if (Number.isNaN(parsed)) return '';
  return parsed;
}

function jsonHelperText(
  field: LowCodeReactionFieldMetadata,
  error: string | null,
  description?: string,
): string {
  if (error) return error;
  if (description) return description;
  if (isMapField(field)) return 'JSON map';
  return 'JSON array';
}

const BooleanFieldControl: React.FC<FieldControlProps> = ({
  field,
  value,
  onChange,
  disabled,
  label,
}) => (
  <FormControlLabel
    control={
      <Checkbox
        checked={value === true}
        onChange={(e) => onChange(field.name, e.target.checked)}
        disabled={disabled}
        size="small"
      />
    }
    label={label}
    sx={{ mb: 1 }}
  />
);

const EnumFieldControl: React.FC<FieldControlProps> = ({
  field,
  value,
  onChange,
  disabled,
  label,
  description,
  required,
  error,
}) => (
  <FormControl fullWidth size="small" sx={{ mb: 1 }} error={!!error}>
    <InputLabel>{label}</InputLabel>
    <Select
      value={asString(value)}
      label={label}
      onChange={(e) => onChange(field.name, e.target.value)}
      disabled={disabled}
      required={required}
    >
      {(field.allowableValues ?? []).map((v) => (
        <MenuItem key={v} value={v}>
          {v}
        </MenuItem>
      ))}
    </Select>
    {(error || description) && (
      <FormHelperText>{error ?? description}</FormHelperText>
    )}
  </FormControl>
);

const NumberFieldControl: React.FC<FieldControlProps & {
  parser: (text: string) => number;
  step: number | 'any';
}> = ({
  field,
  value,
  onChange,
  disabled,
  label,
  description,
  required,
  error,
  parser,
  step,
}) => (
  <TextField
    fullWidth
    size="small"
    type="number"
    label={label}
    value={value ?? ''}
    onChange={(e) => onChange(field.name, parseNumberInput(e.target.value, parser))}
    disabled={disabled}
    required={required}
    error={!!error}
    helperText={error ?? description}
    slotProps={{ htmlInput: { step, ...numberBounds(field) } }}
    sx={{ mb: 1 }}
  />
);

const JsonFieldControl: React.FC<FieldControlProps> = ({
  field,
  value,
  onChange,
  disabled,
  label,
  description,
  required,
  error,
}) => (
  <TextField
    fullWidth
    size="small"
    multiline
    minRows={2}
    maxRows={6}
    label={label}
    value={asJsonText(value)}
    onChange={(e) => onChange(field.name, e.target.value)}
    disabled={disabled}
    required={required}
    error={!!error}
    helperText={jsonHelperText(field, error, description)}
    sx={{ mb: 1 }}
  />
);

const CharacterFieldControl: React.FC<FieldControlProps> = ({
  field,
  value,
  onChange,
  disabled,
  label,
  description,
  required,
  error,
}) => (
  <TextField
    fullWidth
    size="small"
    label={label}
    value={asString(value)}
    onChange={(e) => onChange(field.name, e.target.value.slice(0, 1))}
    disabled={disabled}
    required={required}
    error={!!error}
    helperText={error ?? description}
    slotProps={{ htmlInput: { maxLength: 1 } }}
    sx={{ mb: 1 }}
  />
);

const StringFieldControl: React.FC<FieldControlProps> = ({
  field,
  value,
  onChange,
  disabled,
  label,
  description,
  required,
  error,
}) => {
  const htmlInput = field.lengthMax !== null ? { maxLength: field.lengthMax } : undefined;
  return (
    <TextField
      fullWidth
      size="small"
      label={label}
      value={asString(value)}
      onChange={(e) => onChange(field.name, e.target.value)}
      disabled={disabled}
      required={required}
      error={!!error}
      helperText={error ?? description}
      slotProps={htmlInput ? { htmlInput } : undefined}
      sx={{ mb: 1 }}
    />
  );
};

/**
 * Renders a single Low Code reaction form field based on its metadata type.
 *
 * | Kind               | UI Control              |
 * |--------------------|-------------------------|
 * | Boolean            | Checkbox                |
 * | Enum (allowable)   | Select dropdown         |
 * | Integer/Long/Short | Number input            |
 * | Float/Double       | Decimal number input    |
 * | String             | TextField               |
 * | Character          | Single-char TextField   |
 * | array / map        | JSON textarea           |
 */
const FieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  value,
  onChange,
  disabled = false,
}) => {
  const controlProps: FieldControlProps = {
    field,
    value,
    onChange,
    disabled,
    label: field.displayName || field.name,
    description: field.displayDescription ?? undefined,
    required: field.required === true,
    error: validateFieldValue(field, value),
  };

  if (isBooleanField(field)) return <BooleanFieldControl {...controlProps} />;
  if (isEnumField(field)) return <EnumFieldControl {...controlProps} />;
  if (isIntegerField(field)) {
    return (
      <NumberFieldControl
        {...controlProps}
        parser={(text) => Number.parseInt(text, 10)}
        step={1}
      />
    );
  }
  if (isDecimalField(field)) {
    return (
      <NumberFieldControl
        {...controlProps}
        parser={Number.parseFloat}
        step="any"
      />
    );
  }
  if (isArrayField(field) || isMapField(field)) {
    return <JsonFieldControl {...controlProps} />;
  }
  if (isCharacterField(field)) return <CharacterFieldControl {...controlProps} />;
  return <StringFieldControl {...controlProps} />;
};

export default FieldRenderer;
