import {
  buildDefaultUmlReactionConfig,
  getUmlReactionPortPosition,
  parseUmlAdditionalModelId,
  resolveUmlReactionClassContext,
  type UmlReactionClassContext,
} from '../../../components/canvas/umlDiagramReactionUtils';
import { UML_CLASS_BOX_WIDTH } from '../../../components/canvas/umlDiagramClassMetrics';
import { getUmlClassBoxHeight } from '../../../components/canvas/umlDiagramLayoutGeometry';
import type { UmlDiagramClass } from '../../../components/canvas/umlDiagramTypes';
import type { ReactionsModel } from '../../../types/reactions';

const UML_CLASS: UmlDiagramClass = {
  id: 'Source',
  name: 'Source',
  isAbstract: false,
  isInterface: false,
  attributes: [],
  operations: [],
  x: 40,
  y: 60,
};

const REACTION_MODELS: ReactionsModel[] = [
  {
    id: 10,
    name: 'Primary',
    ecoreContent: '<ecore:EPackage nsURI="https://models.test/primary"/>',
  },
  {
    id: 22,
    name: 'Additional',
    ecoreContent: '<ecore:EPackage nsURI="https://models.test/additional"/>',
  },
];

describe('umlDiagramReactionUtils', () => {
  it('calculates left and right reaction-port positions from class geometry', () => {
    const classHeight = getUmlClassBoxHeight(UML_CLASS);

    expect(getUmlReactionPortPosition(
      UML_CLASS,
      15,
      25,
      'left',
    )).toEqual({
      x: 55,
      y: 85 + classHeight / 2,
    });
    expect(getUmlReactionPortPosition(
      UML_CLASS,
      15,
      25,
      'right',
    )).toEqual({
      x: 55 + UML_CLASS_BOX_WIDTH,
      y: 85 + classHeight / 2,
    });
  });

  it('parses only supported additional-model class IDs', () => {
    expect(parseUmlAdditionalModelId('addl-22-Target')).toBe(22);
    expect(parseUmlAdditionalModelId('addl-x-Target')).toBeNull();
    expect(parseUmlAdditionalModelId('Primary')).toBeNull();
  });

  it('resolves primary model context and preserves its configured namespace', () => {
    expect(resolveUmlReactionClassContext(
      'Source',
      'Source',
      '<ecore:EPackage nsURI="https://models.test/live-primary"/>',
      'Primary',
      99,
      REACTION_MODELS,
    )).toEqual({
      modelId: 10,
      modelName: 'Primary',
      modelUrl: 'https://models.test/live-primary',
      className: 'Source',
    });
  });

  it('resolves additional model context with namespace and URL fallback', () => {
    expect(resolveUmlReactionClassContext(
      'addl-22-Target',
      'Target',
      '',
      'Primary',
      10,
      REACTION_MODELS,
    )).toEqual({
      modelId: 22,
      modelName: 'Additional',
      modelUrl: 'https://models.test/additional',
      className: 'Target',
    });

    expect(resolveUmlReactionClassContext(
      'addl-33-Target',
      'Target',
      '',
      'Primary',
      10,
      [{
        id: 33,
        name: 'FallbackModel',
        ecoreContent: '<ecore:EPackage/>',
      }],
    )).toEqual({
      modelId: 33,
      modelName: 'FallbackModel',
      modelUrl: 'http://vitruv.tools/FallbackModel',
      className: 'Target',
    });
  });

  it('falls back to the supplied primary ID and URL', () => {
    expect(resolveUmlReactionClassContext(
      'Source',
      'Source',
      '<ecore:EPackage/>',
      'Primary',
      99,
      [],
    )).toEqual({
      modelId: 99,
      modelName: 'Primary',
      modelUrl: 'http://vitruv.tools/Primary',
      className: 'Source',
    });
  });

  it('builds the existing default reaction configuration', () => {
    const source: UmlReactionClassContext = {
      modelId: 10,
      modelName: 'Primary',
      modelUrl: 'https://models.test/primary',
      className: 'Source',
    };
    const target: UmlReactionClassContext = {
      modelId: 22,
      modelName: 'Additional',
      modelUrl: 'https://models.test/additional',
      className: 'Target',
    };

    expect(buildDefaultUmlReactionConfig(source, target)).toEqual({
      bidirectional: false,
      reactionName: 'Source_Target',
      model1Url: 'https://models.test/primary',
      model2Url: 'https://models.test/additional',
      model1Alias: 'Primary',
      model2Alias: 'Additional',
      model1RootType: 'Source',
      model2RootType: 'Target',
      model1RootVal: 'Source',
    });
  });
});
