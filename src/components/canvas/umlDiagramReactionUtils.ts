import type {
  ReactionConfig,
  ReactionsModel,
} from '../../types/reactions';
import { extractNsUriFromEcore } from '../../utils/ecoreParser';
import type { Point } from '../../utils/umlDiagramGeometry';
import { UML_CLASS_BOX_WIDTH } from './umlDiagramClassMetrics';
import { getUmlClassBoxHeight } from './umlDiagramLayoutGeometry';
import type { UmlDiagramClass } from './umlDiagramTypes';

export type UmlReactionPortSide = 'left' | 'right';

export interface UmlReactionDragState {
  sourceClassId: string;
  sourceSide: UmlReactionPortSide;
  startX: number;
  startY: number;
  cursorX: number;
  cursorY: number;
}

export interface UmlReactionClassContext {
  modelId: number;
  modelName: string;
  modelUrl: string;
  className: string;
}

export function getUmlReactionPortPosition(
  umlClass: UmlDiagramClass,
  offsetX: number,
  offsetY: number,
  side: UmlReactionPortSide,
): Point {
  const height = getUmlClassBoxHeight(umlClass);
  return {
    x: side === 'left'
      ? umlClass.x + offsetX
      : umlClass.x + offsetX + UML_CLASS_BOX_WIDTH,
    y: umlClass.y + offsetY + height / 2,
  };
}

export function parseUmlAdditionalModelId(classId: string): number | null {
  const match = /^addl-(\d+)-/.exec(classId);
  return match ? Number(match[1]) : null;
}

export function resolveUmlReactionClassContext(
  classId: string,
  className: string,
  primaryEcore: string,
  primaryName: string,
  primaryModelId: number,
  reactionModels: ReactionsModel[],
): UmlReactionClassContext {
  const additionalModelId = parseUmlAdditionalModelId(classId);
  if (additionalModelId != null) {
    const model = reactionModels.find(
      reactionModel => reactionModel.id === additionalModelId,
    );
    if (model) {
      return {
        modelId: model.id,
        modelName: model.name,
        modelUrl: extractNsUriFromEcore(model.ecoreContent)
          ?? `http://vitruv.tools/${model.name}`,
        className,
      };
    }
  }

  const primaryModel = reactionModels.find(
    reactionModel => reactionModel.name === primaryName,
  ) ?? reactionModels[0];
  return {
    modelId: primaryModel?.id ?? primaryModelId,
    modelName: primaryName,
    modelUrl: extractNsUriFromEcore(primaryEcore)
      ?? `http://vitruv.tools/${primaryName}`,
    className,
  };
}

export function buildDefaultUmlReactionConfig(
  source: UmlReactionClassContext,
  target: UmlReactionClassContext,
): ReactionConfig {
  return {
    bidirectional: false,
    reactionName: `${source.className}_${target.className}`,
    model1Url: source.modelUrl,
    model2Url: target.modelUrl,
    model1Alias: source.modelName,
    model2Alias: target.modelName,
    model1RootType: source.className,
    model2RootType: target.className,
    model1RootVal: source.className,
  };
}
