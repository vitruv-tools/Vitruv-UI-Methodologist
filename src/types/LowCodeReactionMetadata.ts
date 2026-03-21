import { LowCodeReactionFieldMetadata } from "./LowCodeReactionFieldMetadata";


export type LowCodeReactionMetadata = {
  // Display name of the reaction
  name: string | null;
  // Description of the reaction
  description: string | null;
  // Whether this reaction should be hidden in the UI
  hide: boolean | null;
  fields: LowCodeReactionFieldMetadata[];
};
