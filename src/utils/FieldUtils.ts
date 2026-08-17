/**
 * Low Code reaction field utilities.
 *
 * Type predicates, default value resolution, and template variable
 * evaluation for metadata-driven form fields.
 */

import type { LowCodeReactionFieldMetadata } from '../types/LowCodeReactionFieldMetadata';
import type { LowCodeReactionFieldVariables } from '../types/LowCodeReactionFieldVariables';

// ── Type predicates ─────────────────────────────────────────────────────

export function isStringField(field: LowCodeReactionFieldMetadata): boolean {
  return field.type === 'String';
}

export function isBooleanField(field: LowCodeReactionFieldMetadata): boolean {
  return field.type === 'Boolean';
}

export function isIntegerField(field: LowCodeReactionFieldMetadata): boolean {
  return field.type === 'Integer' || field.type === 'Long' || field.type === 'Short';
}

export function isDecimalField(field: LowCodeReactionFieldMetadata): boolean {
  return field.type === 'Float' || field.type === 'Double';
}

export function isNumericField(field: LowCodeReactionFieldMetadata): boolean {
  return isIntegerField(field) || isDecimalField(field);
}

export function isCharacterField(field: LowCodeReactionFieldMetadata): boolean {
  return field.type === 'Character';
}

export function isEnumField(field: LowCodeReactionFieldMetadata): boolean {
  return (
    field.allowableValues !== null &&
    field.allowableValues !== undefined &&
    field.allowableValues.length > 0
  );
}

export function isArrayField(field: LowCodeReactionFieldMetadata): boolean {
  return field.array === true;
}

export function isMapField(field: LowCodeReactionFieldMetadata): boolean {
  return field.map === true;
}

export function isHidden(field: LowCodeReactionFieldMetadata): boolean {
  return field.displayHide === true;
}

// ── Template evaluation ─────────────────────────────────────────────────

const TEMPLATE_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Safe template evaluation using `{{variableName}}` placeholders.
 *
 * Only variables present in the provided `variables` object are replaced.
 * Unknown placeholders are left as-is.
 *
 * This is the preferred approach over `new Function` (see security note
 * in README Phase 3). Metadata strings come from the backend, but we
 * still avoid arbitrary code execution.
 */
export function evaluateTemplate(
  template: string,
  variables: LowCodeReactionFieldVariables,
): string {
  const vars = variables as Record<string, string>;
  return template.replace(TEMPLATE_PATTERN, (match, key: string) => {
    return key in vars ? vars[key] : match;
  });
}

function capitalizeFirst(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/**
 * Extended template evaluation that also supports `${expression}` syntax
 * for backward compatibility with old-branch metadata.
 *
 * **Trust boundary:** Only call this with backend-provided metadata strings.
 * The implementation uses constrained substitution (NOT `new Function`).
 * Supported expressions:
 *   `${var}` / `{{var}}`
 *   `${var.toLowerCase()}` / `${var.toUpperCase()}`
 *   `${capitalizeFirst(var)}`
 */
export function evaluateTemplateWithExpressionSupport(
  template: string,
  variables: LowCodeReactionFieldVariables,
): string {
  const vars = variables as Record<string, string>;
  const resolve = (key: string): string | undefined =>
    key in vars ? vars[key] : undefined;

  let result = template.replace(TEMPLATE_PATTERN, (match, key: string) => {
    return resolve(key) ?? match;
  });

  result = result.replace(
    /\$\{capitalizeFirst\((\w+)\)\}/g,
    (match, key: string) => {
      const value = resolve(key);
      return value === undefined ? match : capitalizeFirst(value);
    },
  );

  result = result.replace(
    /\$\{(\w+)\.toLowerCase\(\)\}/g,
    (match, key: string) => {
      const value = resolve(key);
      return value === undefined ? match : value.toLowerCase();
    },
  );

  result = result.replace(
    /\$\{(\w+)\.toUpperCase\(\)\}/g,
    (match, key: string) => {
      const value = resolve(key);
      return value === undefined ? match : value.toUpperCase();
    },
  );

  result = result.replace(/\$\{(\w+)\}/g, (match, key: string) => {
    return resolve(key) ?? match;
  });

  return result;
}

// ── Default value resolution ────────────────────────────────────────────

/**
 * Resolve the default value for a field, applying template evaluation
 * to string defaults when variables are provided.
 */
export function getFieldDefaultValue(
  field: LowCodeReactionFieldMetadata,
  variables?: LowCodeReactionFieldVariables,
): unknown {
  if (isBooleanField(field)) {
    return field.displayDefaultBooleanValue ?? false;
  }

  if (isDecimalField(field)) {
    return field.displayDefaultDoubleValue ?? 0;
  }

  if (isIntegerField(field)) {
    return field.displayDefaultIntValue ?? 0;
  }

  if (isStringField(field) || isCharacterField(field)) {
    const raw = field.displayDefaultStringValue ?? '';
    if (variables && raw) {
      return evaluateTemplateWithExpressionSupport(raw, variables);
    }
    return raw;
  }

  if (isEnumField(field)) {
    return field.allowableValues![0] ?? '';
  }

  if (isArrayField(field) || isMapField(field)) {
    return '';
  }

  return '';
}

/**
 * Build initial form values for all visible fields in a reaction template.
 */
export function buildInitialFieldValues(
  fields: LowCodeReactionFieldMetadata[],
  variables?: LowCodeReactionFieldVariables,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    if (!isHidden(field)) {
      values[field.name] = getFieldDefaultValue(field, variables);
    }
  }
  return variables ? overlayConnectionFieldValues(values, variables) : values;
}

/**
 * Build template variables from a selected fine-granular edge.
 *
 * Includes both the canonical source/target names and the model1/model2
 * aliases used by backend reaction metadata defaults.
 */
export function buildLowCodeFieldVariables(vars: {
  sourceModelUri: string;
  sourceModelAlias: string;
  sourceUri: string;
  sourceAlias: string;
  targetModelUri: string;
  targetModelAlias: string;
  targetUri: string;
  targetAlias: string;
}): LowCodeReactionFieldVariables {
  return {
    ...vars,
    model1Uri: vars.sourceModelUri,
    model2Uri: vars.targetModelUri,
    model1Alias: vars.sourceModelAlias,
    model2Alias: vars.targetModelAlias,
    model1RootType: vars.sourceAlias,
    model2RootType: vars.targetAlias,
    model1RootVar: vars.sourceAlias.toLowerCase(),
    model2RootVar: vars.targetAlias.toLowerCase(),
  };
}

/**
 * Force identity fields to the connected models even when the backend
 * default string is a hardcoded example (e.g. `http://.../model2`).
 */
export function overlayConnectionFieldValues(
  values: Record<string, unknown>,
  variables: LowCodeReactionFieldVariables,
): Record<string, unknown> {
  const byFieldName: Record<string, string> = {
    model1Uri: variables.model1Uri,
    model2Uri: variables.model2Uri,
    model1Alias: variables.model1Alias,
    model2Alias: variables.model2Alias,
    model1RootType: variables.model1RootType,
    model2RootType: variables.model2RootType,
    model1RootVar: variables.model1RootVar,
    model2RootVar: variables.model2RootVar,
    sourceModelUri: variables.sourceModelUri,
    targetModelUri: variables.targetModelUri,
    sourceModelAlias: variables.sourceModelAlias,
    targetModelAlias: variables.targetModelAlias,
    sourceAlias: variables.sourceAlias,
    targetAlias: variables.targetAlias,
    sourceUri: variables.sourceUri,
    targetUri: variables.targetUri,
  };

  const next = { ...values };
  for (const [name, value] of Object.entries(byFieldName)) {
    if (name in next && value) {
      next[name] = value;
    }
  }
  return next;
}

// ── Validation helpers ──────────────────────────────────────────────────

/**
 * Check whether a numeric value satisfies the field's min/max constraints.
 */
export function validateNumericConstraints(
  field: LowCodeReactionFieldMetadata,
  value: number,
): string | null {
  if (field.min !== null && value < field.min) {
    return `Value must be at least ${field.min}`;
  }
  if (field.max !== null && value > field.max) {
    return `Value must be at most ${field.max}`;
  }
  if (field.decimalMin !== null) {
    const min = Number.parseFloat(field.decimalMin);
    if (!Number.isNaN(min)) {
      if (field.decimalMinInclusive ? value < min : value <= min) {
        return `Value must be ${field.decimalMinInclusive ? '>=' : '>'} ${field.decimalMin}`;
      }
    }
  }
  if (field.decimalMax !== null) {
    const max = Number.parseFloat(field.decimalMax);
    if (!Number.isNaN(max)) {
      if (field.decimalMaxInclusive ? value > max : value >= max) {
        return `Value must be ${field.decimalMaxInclusive ? '<=' : '<'} ${field.decimalMax}`;
      }
    }
  }
  return null;
}

/**
 * Check whether a string value satisfies the field's length/pattern constraints.
 */
export function validateStringConstraints(
  field: LowCodeReactionFieldMetadata,
  value: string,
): string | null {
  if (field.lengthMin !== null && value.length < field.lengthMin) {
    return `Minimum length is ${field.lengthMin}`;
  }
  if (field.lengthMax !== null && value.length > field.lengthMax) {
    return `Maximum length is ${field.lengthMax}`;
  }
  if (field.pattern !== null) {
    try {
      const flags = field.patternFlags?.join('') ?? '';
      const re = new RegExp(field.pattern, flags);
      if (!re.test(value)) {
        return `Value does not match pattern ${field.pattern}`;
      }
    } catch {
      // invalid pattern — skip validation
    }
  }
  return null;
}

/**
 * Validate a single field value against its metadata constraints.
 * Returns an error message or `null` if valid.
 */
export function validateFieldValue(
  field: LowCodeReactionFieldMetadata,
  value: unknown,
): string | null {
  if (field.required && (value === null || value === undefined || value === '')) {
    return `${field.displayName ?? field.name} is required`;
  }

  if (value === null || value === undefined || value === '') return null;

  if (isNumericField(field) && typeof value === 'number') {
    return validateNumericConstraints(field, value);
  }

  if ((isStringField(field) || isCharacterField(field)) && typeof value === 'string') {
    return validateStringConstraints(field, value);
  }

  return null;
}
