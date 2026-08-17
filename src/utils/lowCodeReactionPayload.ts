/**
 * Wire shape for `lowCodeReactionRequestBase`.
 *
 * The backend type is abstract; Jackson selects the concrete request class from
 * `@JsonTypeInfo(property = "name")`. That value is the metadata-map key
 * (e.g. `create_corresponding_root_on_insert_root`), not the display title.
 */

export const LOW_CODE_TEMPLATE_KEY = '_reactionTemplate';

const JACKSON_TYPE_NAME = /^[a-z][a-z0-9_]*$/;

function asJacksonTypeName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return JACKSON_TYPE_NAME.test(trimmed) ? trimmed : undefined;
}

/**
 * Resolve the Jackson subtype discriminator from stored form values.
 * Prefers the editor's map-key (`_reactionTemplate`) over `name`, and ignores
 * display titles such as "Create Corresponding Root".
 */
export function resolveLowCodeReactionDiscriminator(
  fieldValues: Record<string, unknown> | undefined,
): string | undefined {
  if (!fieldValues) return undefined;
  return (
    asJacksonTypeName(fieldValues[LOW_CODE_TEMPLATE_KEY])
    ?? asJacksonTypeName(fieldValues.name)
  );
}

/**
 * Shape sent inside each fine relation's `lowCodeReactionRequestBase`.
 * Strips the UI-only template key and sets `name` to the Jackson discriminator.
 */
export function toWireLowCodeReactionRequestBase(
  fieldValues: Record<string, unknown> | undefined,
): { [key: string]: unknown } | undefined {
  if (!fieldValues) return undefined;

  const { [LOW_CODE_TEMPLATE_KEY]: _templateKey, ...rest } = fieldValues;
  const name = resolveLowCodeReactionDiscriminator(fieldValues);
  const payload: { [key: string]: unknown } = { ...rest };
  if (name) payload.name = name;

  return Object.keys(payload).length > 0 ? payload : undefined;
}
