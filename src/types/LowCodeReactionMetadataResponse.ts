import type { LowCodeReactionMetadata } from './LowCodeReactionMetadata';

/**
 * Shape returned by `GET /api/lowcode-metadata`.
 *
 * Keys of `reactionMetadataMap` are reaction template names
 * (e.g. `"CreateCorrespondence"`).
 */
export type LowCodeReactionMetadataResponse = {
  reactionMetadataMap: { [reactionName: string]: LowCodeReactionMetadata };
};
