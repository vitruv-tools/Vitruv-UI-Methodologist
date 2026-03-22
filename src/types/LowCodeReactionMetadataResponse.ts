import { LowCodeReactionMetadata } from "./LowCodeReactionMetadata";


/**
 * API response wrapper for low-code reaction metadata indexed by template key.
 */
export type LowCodeReactionMetadataResponse = { reactionMetadataMap: { [reactionName: string]: LowCodeReactionMetadata; }; };
