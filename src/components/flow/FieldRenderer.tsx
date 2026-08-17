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
  isStringField,
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
  const label = field.displayName || field.name;
  const description = field.displayDescription ?? undefined;
  const required = field.required === true;
  const error = validateFieldValue(field, value);

  if (isBooleanField(field)) {
    return (
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
  }

  if (isEnumField(field)) {
    return (
      <FormControl fullWidth size="small" sx={{ mb: 1 }} error={!!error}>
        <InputLabel>{label}</InputLabel>
        <Select
          value={typeof value === 'string' ? value : ''}
          label={label}
          onChange={(e) => onChange(field.name, e.target.value)}
          disabled={disabled}
          required={required}
        >
          {field.allowableValues!.map((v) => (
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
  }

  if (isIntegerField(field)) {
    return (
      <TextField
        fullWidth
        size="small"
        type="number"
        label={label}
        value={value ?? ''}
        onChange={(e) => {
          const parsed = Number.parseInt(e.target.value, 10);
          onChange(field.name, Number.isNaN(parsed) ? '' : parsed);
        }}
        disabled={disabled}
        required={required}
        error={!!error}
        helperText={error ?? description}
        inputProps={{
          step: 1,
          ...(field.min !== null ? { min: field.min } : {}),
          ...(field.max !== null ? { max: field.max } : {}),
        }}
        sx={{ mb: 1 }}
      />
    );
  }

  if (isDecimalField(field)) {
    return (
      <TextField
        fullWidth
        size="small"
        type="number"
        label={label}
        value={value ?? ''}
        onChange={(e) => {
          const parsed = Number.parseFloat(e.target.value);
          onChange(field.name, Number.isNaN(parsed) ? '' : parsed);
        }}
        disabled={disabled}
        required={required}
        error={!!error}
        helperText={error ?? description}
        inputProps={{
          step: 'any',
          ...(field.min !== null ? { min: field.min } : {}),
          ...(field.max !== null ? { max: field.max } : {}),
        }}
        sx={{ mb: 1 }}
      />
    );
  }

  if (isArrayField(field) || isMapField(field)) {
    return (
      <TextField
        fullWidth
        size="small"
        multiline
        minRows={2}
        maxRows={6}
        label={label}
        value={typeof value === 'string' ? value : JSON.stringify(value ?? '', null, 2)}
        onChange={(e) => onChange(field.name, e.target.value)}
        disabled={disabled}
        required={required}
        error={!!error}
        helperText={error ?? description ?? (isMapField(field) ? 'JSON map' : 'JSON array')}
        sx={{ mb: 1 }}
      />
    );
  }

  if (isCharacterField(field)) {
    return (
      <TextField
        fullWidth
        size="small"
        label={label}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(field.name, e.target.value.slice(0, 1))}
        disabled={disabled}
        required={required}
        error={!!error}
        helperText={error ?? description}
        inputProps={{ maxLength: 1 }}
        sx={{ mb: 1 }}
      />
    );
  }

  // Default: String field
  return (
    <TextField
      fullWidth
      size="small"
      label={label}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(field.name, e.target.value)}
      disabled={disabled}
      required={required}
      error={!!error}
      helperText={error ?? description}
      inputProps={{
        ...(field.lengthMax !== null ? { maxLength: field.lengthMax } : {}),
      }}
      sx={{ mb: 1 }}
    />
  );
};

export default FieldRenderer;
