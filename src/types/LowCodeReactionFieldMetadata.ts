/**
 * Describes one field in a Low Code reaction template.
 *
 * Returned by the backend metadata API and consumed by FieldRenderer
 * to produce the appropriate form control.
 */
export type LowCodeReactionFieldMetadata = {
  name: string;
  type:
    | "String"
    | "Boolean"
    | "Integer"
    | "Long"
    | "Float"
    | "Double"
    | "Short"
    | "Character";

  required: boolean | null;
  array: boolean | null;
  map: boolean | null;
  mapKeyType: string | null;
  mapValueType: string | null;

  allowableValues: string[] | null;

  sizeMin: number | null;
  sizeMax: number | null;
  lengthMin: number | null;
  lengthMax: number | null;
  min: number | null;
  max: number | null;
  decimalMin: string | null;
  decimalMinInclusive: boolean | null;
  decimalMax: string | null;
  decimalMaxInclusive: boolean | null;
  pattern: string | null;
  patternFlags: string[] | null;

  displayName: string | null;
  displayDescription: string | null;
  displayHide: boolean | null;
  displayDefaultStringValue: string | null;
  displayDefaultIntValue: number | null;
  displayDefaultBooleanValue: boolean | null;
  displayDefaultDoubleValue: number | null;
};
