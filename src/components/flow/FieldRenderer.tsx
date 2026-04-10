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
  IconButton,
  Tooltip,
} from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { LowCodeReactionFieldMetadata } from "../../types/LowCodeReactionFieldMetadata";
import {
  isNumericField,
  isBooleanField,
  isEnumField,
  isStringField,
  getFieldDisplayName,
} from "../../utils/FieldUtils";

/**
 * Props for rendering and editing one low-code reaction field.
 */
interface FieldRendererProps {
  field: LowCodeReactionFieldMetadata;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
  errorMessage?: string;
}

/**
 * Renders an input control that matches the field metadata type and constraints.
 * @param {FieldRendererProps} props - Field metadata, value binding, and validation context.
 * @returns {JSX.Element} The appropriate editor control for the provided field.
 */
export const FieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  value,
  onChange,
  disabled = false,
  errorMessage,
}) => {
  /**
   * Helper component to render a label with optional help icon
   */
  const LabelWithHelp: React.FC<{ text: string; showAsterisk?: boolean }> = ({ 
    text, 
    showAsterisk = false 
  }) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <span>
        {text}
        {showAsterisk && <span style={{ color: "red" }}>*</span>}
      </span>
      {field.displayDescription && (
        <Tooltip title={field.displayDescription} arrow placement="top">
          <IconButton size="small" sx={{ p: 0, ml: 0.5 }}>
            <HelpOutlineIcon sx={{ fontSize: 16, color: "text.secondary" }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );

  const displayName = getFieldDisplayName(field);

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

  // Numeric types with slider
  if (isNumericField(field) && !field.array && !field.map) {
    const min = field.min ?? 0;
    const max = field.max ?? 100;
    const numValue = typeof value === "number" ? value : min;

    return (
      <Box sx={{ width: "100%" }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          <LabelWithHelp text={displayName} showAsterisk={field.required ?? false} />
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
              const num = Number.parseFloat(e.target.value);
              if (!Number.isNaN(num)) onChange(num);
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
  if (isBooleanField(field) && !field.array && !field.map) {
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
          <LabelWithHelp text={displayName} showAsterisk={field.required ?? false} />
        }
      />
    );
  }

  // Enum / dropdown
  if (isEnumField(field)) {
    return (
      <Box sx={{ position: "relative" }}>
        <FormControl fullWidth size="small" disabled={disabled}>
          <InputLabel id={`${field.name}-label`}>
            {displayName}
            {field.required && <span style={{ color: "red" }}>*</span>}
          </InputLabel>
          <Select
            labelId={`${field.name}-label`}
            value={value || ""}
            label={displayName}
            onChange={(e) => onChange(e.target.value)}
          >
            {field.allowableValues!.map((val) => (
              <MenuItem key={val} value={val}>
                {val}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {field.displayDescription && (
          <Tooltip title={field.displayDescription} arrow placement="top">
            <IconButton 
              size="small" 
              sx={{ 
                position: "absolute", 
                right: 32, 
                top: 8,
                p: 0,
                zIndex: 1
              }}
            >
              <HelpOutlineIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  }

  // String with pattern validation or text field
  if (isStringField(field) && !field.array && !field.map) {
    const stringValue = value as string;
    const isInvalid = !validateStringPattern(stringValue, field.pattern);
    const isLengthInvalid = !validateStringLength(
      stringValue,
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
      <Box sx={{ position: "relative" }}>
        <TextField
          fullWidth
          size="small"
          label={displayName}
          value={stringValue}
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
        {field.displayDescription && (
          <Tooltip title={field.displayDescription} arrow placement="top">
            <IconButton 
              size="small" 
              sx={{ 
                position: "absolute", 
                right: 8, 
                top: 8,
                p: 0,
                zIndex: 1
              }}
            >
              <HelpOutlineIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
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
          <LabelWithHelp 
            text={`${displayName}${field.array ? " (Array)" : field.map ? " (Map)" : ""}`} 
            showAsterisk={field.required ?? false} 
          />
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
            typeof value === "string" ? value : JSON.stringify(value || (field.array ? [] : {}))
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
    <Box sx={{ position: "relative" }}>
      <TextField
        fullWidth
        size="small"
        label={displayName}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={field.required ?? false}
      />
      {field.displayDescription && (
        <Tooltip title={field.displayDescription} arrow placement="top">
          <IconButton 
            size="small" 
            sx={{ 
              position: "absolute", 
              right: 8, 
              top: 8,
              p: 0,
              zIndex: 1
            }}
          >
            <HelpOutlineIcon sx={{ fontSize: 16, color: "text.secondary" }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};
