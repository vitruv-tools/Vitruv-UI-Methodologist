export function ecoreToUmlMock() {
  const actual = jest.requireActual('../../utils/ecoreToUml') as typeof import('../../utils/ecoreToUml');
  const simpleModel = {
    classes: [
      {
        id: 'Person',
        name: 'Person',
        isAbstract: false,
        isInterface: false,
        attributes: [{ id: 'Person-0', name: 'name', type: 'String', visibility: '+' }],
        operations: [],
        x: 40,
        y: 40,
      },
      {
        id: 'Employee',
        name: 'Employee',
        isAbstract: false,
        isInterface: false,
        attributes: [],
        operations: [],
        x: 280,
        y: 40,
      },
    ],
    relationships: [
      { id: 'rel-inherit', sourceId: 'Employee', targetId: 'Person', type: 'inheritance' },
    ],
  };
  const refModel = {
    classes: [
      {
        id: 'Order',
        name: 'Order',
        isAbstract: false,
        isInterface: false,
        attributes: [],
        operations: [],
        x: 40,
        y: 40,
      },
      {
        id: 'LineItem',
        name: 'LineItem',
        isAbstract: false,
        isInterface: false,
        attributes: [],
        operations: [],
        x: 280,
        y: 40,
      },
    ],
    relationships: [
      {
        id: 'rel-order-lines',
        sourceId: 'Order',
        targetId: 'LineItem',
        type: 'association',
        sourceMultiplicity: '1',
        targetMultiplicity: '0..*',
      },
    ],
  };
  return {
    __esModule: true,
    ...actual,
    ecoreToUml: (content: string) => {
      if (content.includes('empty')) return { classes: [], relationships: [] };
      if (content.includes('Order')) return refModel;
      return simpleModel;
    },
  };
}

export function saveMetaModelEcoreMock() {
  return {
    saveMetaModelEcore: jest.fn(() => Promise.resolve()),
  };
}

export function umlValidationMock() {
  return {
    validateUmlModel: () => ({ warnings: [], errors: [] }),
  };
}

export function reactionFileMock() {
  return {
    fetchReactionCode: async (_code: string, _id: unknown, buildDefault: () => string) => buildDefault(),
    persistReactionCode: async () => 1,
    resolveReactionFileId: () => 1,
  };
}

export function umlDiagramMinimapMock() {
  return {
    UMLDiagramMinimap: () => {
      const mockReact = require('react');
      return mockReact.createElement('div', {
        'data-testid': 'uml-minimap-stub',
        'aria-label': 'Diagram overview — click or drag to pan',
      });
    },
  };
}

export function reactionEditorModalMock() {
  return { ReactionEditorModal: () => null };
}

export function reactionConfigPopupMock() {
  return { ReactionConfigPopup: () => null };
}

export function umlDiagramGeometryMock() {
  return {
    bridgedLinePathD: () => 'M0,0 L100,0',
    computeLineBridges: () => new Map(),
    optimizeMultiplicityBadges: (badges: unknown[]) => badges,
    resolveMultiplicityBadgeCollisions: (badges: unknown[]) => badges,
  };
}

export function umlClassLayoutMock() {
  const actual = jest.requireActual('../../utils/umlClassLayout');
  return {
    ...actual,
    assignParallelRelMeta: (rels: unknown[]) => rels,
    computeUmlFocusRect: () => ({ minX: 0, minY: 0, maxX: 500, maxY: 400 }),
  };
}

export function umlLayoutStorageMock() {
  const actual = jest.requireActual('../../utils/umlLayoutStorage');
  return {
    ...actual,
    applyLayoutToUmlClasses: (_scope: string, _file: string, classes: unknown[]) => classes,
    hasSavedUmlLayout: () => true,
    loadUmlViewport: () => ({ x: 0, y: 0, scale: 1 }),
  };
}
