const mockMinimapSpy = jest.fn();

jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('../../../testSupport/umlDiagram/mockFactories').saveMetaModelEcoreMock());
jest.mock('../../../utils/umlValidation', () => require('../../../testSupport/umlDiagram/mockFactories').umlValidationMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => ({
  UMLDiagramMinimap: (props: unknown) => {
    mockMinimapSpy(props);
    const mockReact = require('react');
    return mockReact.createElement('div', { 'data-testid': 'uml-minimap-stub' });
  },
}));
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());

import { SIMPLE_ECORE } from '../../../testSupport/umlDiagram/fixtures';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

describe('UMLDiagram minimap', () => {
  beforeEach(() => {
    mockMinimapSpy.mockClear();
  });

  it('passes primary model classes to the minimap', () => {
    renderDiagram({
      ecoreContent: SIMPLE_ECORE,
    });

    expect(mockMinimapSpy).toHaveBeenCalled();
    const lastCall = mockMinimapSpy.mock.calls.at(-1)?.[0] as {
      classes: { id: string }[];
    };
    const classIds = lastCall.classes.map(c => c.id);

    expect(classIds).toEqual(expect.arrayContaining(['Person', 'Employee']));
  });
});
