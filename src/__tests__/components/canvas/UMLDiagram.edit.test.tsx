jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('../../../testSupport/umlDiagram/mockFactories').saveMetaModelEcoreMock());
jest.mock('../../../utils/umlValidation', () => require('../../../testSupport/umlDiagram/mockFactories').umlValidationMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramMinimapMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());

import { screen, fireEvent } from '@testing-library/react';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

describe('UMLDiagram edit', () => {
  it('adds a class attribute and commits on canvas mouse down', () => {
    const { container } = renderDiagram();

    fireEvent.click(screen.getByText('Person'));
    fireEvent.click(screen.getAllByText('Add attribute')[0]);
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'age' } });
    fireEvent.mouseDown(container.firstChild as HTMLElement);

    expect(screen.getByText('age')).toBeInTheDocument();
  });

  it('adds a new class and deletes it from the toolbar', () => {
    renderDiagram();

    fireEvent.click(screen.getByTitle('Add class'));
    expect(screen.getByDisplayValue('NewClass')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Delete selected class or connection'));
    expect(screen.queryByText('NewClass')).not.toBeInTheDocument();
  });
});

