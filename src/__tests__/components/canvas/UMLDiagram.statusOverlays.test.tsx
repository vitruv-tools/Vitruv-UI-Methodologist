/* eslint-disable import/first, testing-library/no-container, testing-library/no-node-access */

jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('../../../testSupport/umlDiagram/mockFactories').saveMetaModelEcoreMock());
jest.mock('../../../utils/umlValidation', () => {
  const actual = jest.requireActual('../../../utils/umlValidation');
  return { ...actual, validateUmlModel: jest.fn(() => []) };
});
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramMinimapMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());

import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';
import { validateUmlModel } from '../../../utils/umlValidation';

const validateUmlModelMock = validateUmlModel as jest.MockedFunction<typeof validateUmlModel>;

describe('UMLDiagram status overlays', () => {
  beforeEach(() => {
    validateUmlModelMock.mockReset();
    validateUmlModelMock.mockReturnValue([
      { severity: 'error', message: 'Class names must be unique' },
    ]);
  });

  it('shows validation feedback only while the diagram is interactive', () => {
    const { container, unmount } = renderDiagram();
    expect(container.querySelector('[data-uml-validation]'))
      .toHaveTextContent('Class names must be unique');
    unmount();

    const { container: readOnlyContainer } = renderDiagram({ interactive: false });
    expect(readOnlyContainer.querySelector('[data-uml-validation]')).not.toBeInTheDocument();
  });
});
