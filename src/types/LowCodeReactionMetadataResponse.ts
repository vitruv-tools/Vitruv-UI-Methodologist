import type { LowCodeReactionMetadata } from './LowCodeReactionMetadata';

/**
 * Shape returned by `GET /api/lowcode-metadata`.
 *
 * Keys of `reactionMetadataMap` are Jackson subtype names
 * (e.g. `"create_corresponding_root_on_insert_root"`).
 * `LowCodeReactionMetadata.name` is the human-readable display title.
 */
export type LowCodeReactionMetadataResponse = {
  reactionMetadataMap: { [reactionName: string]: LowCodeReactionMetadata };
};
