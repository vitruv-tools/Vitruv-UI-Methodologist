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

import { screen } from '@testing-library/react';
import { EMPTY_ECORE } from './diagramTestFixtures';
import { renderDiagram } from './diagramTestUtils';

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

  it('shows reaction ports and hint when reactions mode is enabled', () => {
    const { container } = renderDiagram({ reactionsMode: 'reactions' });

    expect(screen.getByText(/Drag from a purple dot/i)).toBeInTheDocument();
    expect(container.querySelector('[data-reaction-port]')).toBeTruthy();
  });
});
