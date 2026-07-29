jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('../../../testSupport/umlDiagram/mockFactories').saveMetaModelEcoreMock());
jest.mock('../../../utils/umlValidation', () => require('../../../testSupport/umlDiagram/mockFactories').umlValidationMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramMinimapMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());

import { screen } from '@testing-library/react';
import { EMPTY_ECORE } from '../../../testSupport/umlDiagram/fixtures';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

describe('UMLDiagram render', () => {
  it('shows empty state when the model has no classes', () => {
    renderDiagram({ ecoreContent: EMPTY_ECORE });
    expect(screen.getByText(/No UML content found/i)).toBeInTheDocument();
  });

  it('renders classes, attributes, and diagram chrome from ecore', () => {
    const { container } = renderDiagram();

    expect(screen.getByText('Person')).toBeInTheDocument();
    expect(screen.getByText('Employee')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByTitle('Add class')).toBeInTheDocument();
    expect(container.querySelector('[data-classbox]')).toBeTruthy();
    expect(screen.getByTestId('uml-minimap-stub')).toBeInTheDocument();
  });
});
