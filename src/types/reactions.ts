export interface ReactionConfig {
  bidirectional: boolean;
  reactionName: string;
  model1Url: string;
  model2Url: string;
  model1Alias: string;
  model2Alias: string;
  model1RootType: string;
  model2RootType: string;
  model1RootVal: string;
}

export interface ReactionEdge {
  id: string;
  sourceModelId: number;
  sourceClassId: string;
  sourceClassName: string;
  targetModelId: number;
  targetClassId: string;
  targetClassName: string;
  config: ReactionConfig;
}

export interface ReactionsModel {
  id: number;
  name: string;
  ecoreContent: string;
  ecoreFileId?: number;
}
