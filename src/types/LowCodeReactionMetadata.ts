import type { LowCodeReactionFieldMetadata } from './LowCodeReactionFieldMetadata';

/**
 * Metadata for a single reaction template.
 *
 * `fields` drives the form that FieldRenderer produces;
 * `hide` templates are suppressed from the reaction-type selector.
 */
export type LowCodeReactionMetadata = {
  name: string | null;
  description: string | null;
  hide: boolean | null;
  fields: LowCodeReactionFieldMetadata[];
};
