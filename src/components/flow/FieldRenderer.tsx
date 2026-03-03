import {
  Box,
  Typography,
  Slider,
  TextField,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { LowCodeReactionFieldMetadata } from "../../services/api";

/**
 * Render field component based on metadata
 */
interface FieldRendererProps {
  field: LowCodeReactionFieldMetadata;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
  errorMessage?: string;
}

export const FieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  value,
  onChange,
  disabled = false,
  errorMessage,
}) => {
  /**
   * Validate string against pattern if available
   */
  const validateStringPattern = (
    value: string,
    pattern: string | null,
  ): boolean => {
    if (!pattern) return true;
    try {
      const regex = new RegExp(pattern);
      return regex.test(value);
    } catch {
      return true; // If regex is invalid, don't block input
    }
  };

  /**
   * Validate string length
   */
  const validateStringLength = (
    value: string,
    lengthMin: number | null,
    lengthMax: number | null,
  ): boolean => {
    const len = value.length;
    if (lengthMin !== null && len < lengthMin) return false;
    if (lengthMax !== null && len > lengthMax) return false;
    return true;
  };

  const isNumericType = [
    "integer",
    "int",
    "long",
    "float",
    "double",
    "short",
  ].includes(field.type.toLowerCase());
  const isBoolean = field.type.toLocaleLowerCase() === "boolean";
  const isEnum = field.allowableValues && field.allowableValues.length > 0;
  const isString = field.type.toLocaleLowerCase() === "string";

  // Numeric types with slider
  if (isNumericType && !field.array && !field.map) {
    const min = field.min ?? 0;
    const max = field.max ?? 100;
    const numValue = typeof value === "number" ? value : min;

    return (
      <Box sx={{ width: "100%" }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {field.name}
          {field.required && <span style={{ color: "red" }}>*</span>}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Slider
            value={numValue}
            onChange={(_, newValue) => onChange(newValue)}
            min={min}
            max={max}
            step={field.type === "Integer" || field.type === "Long" ? 1 : 0.1}
            disabled={disabled}
            valueLabelDisplay="auto"
            sx={{ flex: 1 }}
          />
          <TextField
            type="number"
            size="small"
            value={numValue}
            onChange={(e) => {
              const num = parseFloat(e.target.value);
              if (!isNaN(num)) onChange(num);
            }}
            inputProps={{ min, max }}
            disabled={disabled}
            sx={{ width: 80 }}
          />
        </Box>
      </Box>
    );
  }

  // Boolean checkbox
  if (isBoolean && !field.array && !field.map) {
    return (
      <FormControlLabel
        control={
          <Checkbox
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
          />
        }
        label={
          <>
            {field.name}
            {field.required && <span style={{ color: "red" }}>*</span>}
          </>
        }
      />
    );
  }

  // Enum / dropdown
  if (isEnum) {
    return (
      <FormControl fullWidth size="small" disabled={disabled}>
        <InputLabel id={`${field.name}-label`}>
          {field.name}
          {field.required && <span style={{ color: "red" }}>*</span>}
        </InputLabel>
        <Select
          labelId={`${field.name}-label`}
          value={value || ""}
          label={field.name}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.allowableValues!.map((val) => (
            <MenuItem key={val} value={val}>
              {val}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  // String with pattern validation or text field
  if (isString && !field.array && !field.map) {
    const isInvalid = !validateStringPattern(value as string, field.pattern);
    const isLengthInvalid = !validateStringLength(
      value as string,
      field.lengthMin,
      field.lengthMax,
    );

    let helperText = errorMessage || "";
    if (isInvalid) {
      helperText = `Must match pattern: ${field.pattern}`;
    }
    if (isLengthInvalid) {
      helperText = `Length must be between ${field.lengthMin ?? 0} and ${field.lengthMax ?? "∞"}`;
    }

    return (
      <TextField
        fullWidth
        size="small"
        label={field.name}
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        error={isInvalid || isLengthInvalid}
        helperText={helperText}
        required={field.required ?? false}
        placeholder={
          field.pattern
            ? `Pattern: ${field.pattern}`
            : field.lengthMin || field.lengthMax
              ? `Length: ${field.lengthMin ?? 0}-${field.lengthMax ?? "∞"}`
              : undefined
        }
      />
    );
  }

  // Array / Collection handling
  if (field.array || field.map) {
    return (
      <Box
        sx={{
          p: 2,
          border: "1px dashed #ccc",
          borderRadius: 1,
          bgcolor: "#fafafa",
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
          {field.name}
          {field.required && <span style={{ color: "red" }}>*</span>}
          {field.array && ` (Array)`}
          {field.map && ` (Map)`}
        </Typography>
        <Typography variant="caption" color="textSecondary">
          {field.array && `Size: ${field.sizeMin ?? 0}-${field.sizeMax ?? "∞"}`}
          {field.map &&
            `Keys: ${field.mapKeyType}, Values: ${field.mapValueType}`}
        </Typography>
        <TextField
          fullWidth
          size="small"
          multiline
          rows={3}
          placeholder={
            field.array
              ? "JSON array (e.g., [1, 2, 3])"
              : field.map
                ? 'JSON object (e.g., {"key": "value"})'
                : "JSON"
          }
          value={
            typeof value === "string" ? value : JSON.stringify(value || {})
          }
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onChange(parsed);
            } catch {
              onChange(e.target.value);
            }
          }}
          disabled={disabled}
          sx={{ mt: 1 }}
        />
      </Box>
    );
  }

  // Fallback to text field
  return (
    <TextField
      fullWidth
      size="small"
      label={field.name}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required={field.required ?? false}
    />
  );
};
