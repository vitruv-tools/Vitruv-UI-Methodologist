import { LowCodeReactionFieldMetadata } from "../types/LowCodeReactionFieldMetadata";
import { LowCodeReactionFieldVariables } from "../types/LowCodeReactionFieldVariables";

/**
 * Check if a field is a numeric type
 */
export const isNumericField = (
  field: LowCodeReactionFieldMetadata,
): boolean => {
  return isIntegerField(field) || isDecimalField(field);
};

/**
 * Check if a field is a numeric type
 */
export const isIntegerField = (
  field: LowCodeReactionFieldMetadata,
): boolean => {
  return ["integer", "int", "long", "short"].includes(field.type.toLowerCase());
};

/**
 * Check if a field is a numeric type
 */
export const isDecimalField = (
  field: LowCodeReactionFieldMetadata,
): boolean => {
  return ["float", "double"].includes(field.type.toLowerCase());
};

/**
 * Check if a field is a boolean type
 */
export const isBooleanField = (
  field: LowCodeReactionFieldMetadata,
): boolean => {
  return field.type.toLowerCase() === "boolean";
};

/**
 * Check if a field is an enum (has allowable values)
 */
export const isEnumField = (field: LowCodeReactionFieldMetadata): boolean => {
  return !!(field.allowableValues && field.allowableValues.length > 0);
};

/**
 * Check if a field is a string type
 */
export const isStringField = (field: LowCodeReactionFieldMetadata): boolean => {
  return field.type.toLowerCase() === "string";
};

/**
 * Get the default value for a field based on its metadata
 */
export const getFieldDefaultValue = (
  field: LowCodeReactionFieldMetadata,
  variables: Partial<LowCodeReactionFieldVariables>,
): any => {
  // Fall back to type-based defaults
  if (isBooleanField(field)) {
    if (field.displayDefaultBooleanValue != null) {
      return field.displayDefaultBooleanValue;
    }
    return false;
  }
  if (isNumericField(field)) {
    if (isIntegerField(field) && field.displayDefaultIntValue != null) {
      return field.displayDefaultIntValue;
    }
    if (isDecimalField(field) && field.displayDefaultDoubleValue != null) {
      return field.displayDefaultDoubleValue;
    }
    return field.min ?? 0;
  }
  if (isEnumField(field)) {
    return field.allowableValues![0];
  }
  if (field.array) {
    return [];
  }
  if (field.map) {
    return {};
  }
  if (field.displayDefaultStringValue != null) {
    return evaluateTemplateWithExpressionSupport(field.displayDefaultStringValue, variables);
  }
  return "";
};

function capitalizeFirst(str: string): string {
  return str[0].toUpperCase() + str.slice(1);
}

export function evaluateTemplateWithExpressionSupport(template: string, values: Partial<LowCodeReactionFieldVariables>): string {
  const executionContext = {
    ...values,
    capitalizeFirst, 
  }
  return new Function(...Object.keys(executionContext), `return \`${template}\`;`)(...Object.values(executionContext));
}

export function evaluateTemplate(template: string, values: Partial<LowCodeReactionFieldVariables>): string {
  return template.replace(/\${(.*?)}/g, (_, key) => {
      return (values as Record<string, string>)[key.trim()] ?? `\$\{${key}\}`;
  });
}

/**
 * Get the display name for a field
 */
export const getFieldDisplayName = (
  field: LowCodeReactionFieldMetadata,
): string => {
  return field.displayName || field.name;
};
