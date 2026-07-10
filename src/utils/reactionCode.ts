import { ReactionConfig } from '../types/reactions';

/** Build starter `.reactions` source from a UML reaction edge config. */
export function buildInitialReactionCodeFromConfig(config: ReactionConfig): string {
  const alias1 = config.model1Alias || 'source';
  const alias2 = config.model2Alias || 'target';
  const uri1 = config.model1Url || `http://vitruv.tools/${alias1}`;
  const uri2 = config.model2Url || `http://vitruv.tools/${alias2}`;
  const reactionLabel = config.reactionName || `${alias1}To${alias2}`;
  return (
    `import "${uri1}" as ${alias1}\n` +
    `import "${uri2}" as ${alias2}\n\n` +
    `reactions: ${reactionLabel}\n` +
    `in reaction to changes in ${alias1}\n` +
    `execute actions in ${alias2}\n\n`
  );
}
