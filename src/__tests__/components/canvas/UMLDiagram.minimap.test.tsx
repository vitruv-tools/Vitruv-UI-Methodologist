const mockMinimapSpy = jest.fn();

jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('../../../testSupport/umlDiagram/mockFactories').saveMetaModelEcoreMock());
jest.mock('../../../utils/umlValidation', () => require('../../../testSupport/umlDiagram/mockFactories').umlValidationMock());
jest.mock('../../../utils/reactionFile', () => require('../../../testSupport/umlDiagram/mockFactories').reactionFileMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => ({
  UMLDiagramMinimap: (props: unknown) => {
    mockMinimapSpy(props);
    const mockReact = require('react');
    return mockReact.createElement('div', { 'data-testid': 'uml-minimap-stub' });
  },
}));
jest.mock('../../../components/flow/ReactionEditorModal', () => require('../../../testSupport/umlDiagram/mockFactories').reactionEditorModalMock());
jest.mock('../../../components/canvas/ReactionConfigPopup', () => require('../../../testSupport/umlDiagram/mockFactories').reactionConfigPopupMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());

import { REF_ECORE, SIMPLE_ECORE } from '../../../testSupport/umlDiagram/fixtures';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

describe('UMLDiagram minimap', () => {
  beforeEach(() => {
    mockMinimapSpy.mockClear();
  });

  it('includes additional meta model classes in the minimap', () => {
    renderDiagram({
      ecoreContent: SIMPLE_ECORE,
      additionalModels: [{
        id: 2,
        name: 'Reference',
        ecoreContent: REF_ECORE,
        color: '#dc2626',
        fill: 'rgba(220,38,38,0.06)',
      }],
    });

    expect(mockMinimapSpy).toHaveBeenCalled();
    const lastCall = mockMinimapSpy.mock.calls.at(-1)?.[0] as {
      classes: { id: string }[];
      modelGroups: { name: string }[];
    };
    const classIds = lastCall.classes.map(c => c.id);

    expect(classIds).toEqual(expect.arrayContaining(['Person', 'Employee', 'addl-2-Order', 'addl-2-LineItem']));
    expect(lastCall.modelGroups.length).toBeGreaterThanOrEqual(2);
  });
});
