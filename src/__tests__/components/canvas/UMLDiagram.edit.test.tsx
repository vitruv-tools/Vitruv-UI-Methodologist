jest.mock('../../../utils/ecoreToUml', () => require('./diagramMockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('./diagramMockFactories').saveMetaModelEcoreMock());
jest.mock('../../../utils/umlValidation', () => require('./diagramMockFactories').umlValidationMock());
jest.mock('../../../utils/reactionFile', () => require('./diagramMockFactories').reactionFileMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => require('./diagramMockFactories').umlDiagramMinimapMock());
jest.mock('../../../components/flow/ReactionEditorModal', () => require('./diagramMockFactories').reactionEditorModalMock());
jest.mock('../../../components/canvas/ReactionConfigPopup', () => require('./diagramMockFactories').reactionConfigPopupMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('./diagramMockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('./diagramMockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('./diagramMockFactories').umlLayoutStorageMock());

import { screen, fireEvent } from '@testing-library/react';
import { renderDiagram } from './diagramTestUtils';

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
