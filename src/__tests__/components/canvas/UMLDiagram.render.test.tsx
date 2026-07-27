jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('../../../testSupport/umlDiagram/mockFactories').saveMetaModelEcoreMock());
jest.mock('../../../utils/umlValidation', () => require('../../../testSupport/umlDiagram/mockFactories').umlValidationMock());
jest.mock('../../../utils/reactionFile', () => require('../../../testSupport/umlDiagram/mockFactories').reactionFileMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramMinimapMock());
jest.mock('../../../components/flow/ReactionEditorModal', () => require('../../../testSupport/umlDiagram/mockFactories').reactionEditorModalMock());
jest.mock('../../../components/canvas/ReactionConfigPopup', () => require('../../../testSupport/umlDiagram/mockFactories').reactionConfigPopupMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());

import { fireEvent, screen } from '@testing-library/react';
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

  it('shows reaction ports and hint when reactions mode is enabled', () => {
    const { container } = renderDiagram({ reactionsMode: 'reactions' });

    expect(screen.getByText(/Drag from a purple dot/i)).toBeInTheDocument();
    expect(container.querySelector('[data-reaction-port]')).toBeTruthy();
  });

  it('allows dragging a class box from its name button', () => {
    const { container } = renderDiagram();
    const box = container.querySelector('[data-classbox]') as HTMLElement;
    expect(box).toBeTruthy();
    const wrapper = box.parentElement as HTMLElement;
    const beforeLeft = wrapper.style.left;

    const nameBtn = screen.getByRole('button', { name: /Class name: Person/i });
    fireEvent.mouseDown(nameBtn, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 160, clientY: 140 });
    fireEvent.mouseUp(window);

    expect(wrapper.style.left).not.toBe(beforeLeft);
  });
});

