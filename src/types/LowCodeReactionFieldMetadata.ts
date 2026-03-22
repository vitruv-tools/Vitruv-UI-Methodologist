
/**
 * Field metadata definition for rendering and validating low-code reaction inputs.
 */
export type LowCodeReactionFieldMetadata = {
  // Name of the reaction template field
  name: string;
  // Type that the reaction template field expects
  type: "String" |
  "Boolean" |
  "Integer" |
  "Long" |
  "Float" |
  "Double" |
  "Short" |
  "Character";
  // Whether this field is required
  required: boolean | null;
  // Whether this field represents a collection of values (e.g., array or list)
  array: boolean | null;
  // Whether this field represents a mapping (e.g., dictionary or map)
  map: boolean | null;
  // If this field is a mapping, the expected type of the keys
  mapKeyType: string | null;
  // If this field is a mapping, the expected type of the values
  mapValueType: string | null;
  // If this field has a predefined set of allowable values (e.g., an enum), they are listed here
  allowableValues: string[] | null;
  // Minimum and maximum elements of a collection field, if applicable
  sizeMin: number | null;
  sizeMax: number | null;
  // Length constraint for string fields
  lengthMin: number | null;
  lengthMax: number | null;
  // Numerical constraints for numeric fields
  min: number | null;
  max: number | null;
  // Numerical constraints for decimal fields, represented as strings to preserve precision
  decimalMin: string | null;
  decimalMinInclusive: boolean | null;
  decimalMax: string | null;
  decimalMaxInclusive: boolean | null;
  // Regular expression pattern that string fields must match, if applicable
  pattern: string | null;
  patternFlags: string[] | null;
  // Display name of the reaction
  displayName: string | null;
  // Description of the reaction
  displayDescription: string | null;
  // Whether this field should be hidden in the UI
  displayHide: boolean | null;
  // Default values for display purposes
  displayDefaultStringValue: string | null;
  displayDefaultIntValue: number | null;
  displayDefaultBooleanValue: boolean | null;
  displayDefaultDoubleValue: number | null;
};


