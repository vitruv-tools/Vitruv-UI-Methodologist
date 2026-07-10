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
import { REF_ECORE } from './diagramTestFixtures';
import { renderDiagram } from './diagramTestUtils';

describe('UMLDiagram connections', () => {
  it('shows multiplicity badges and opens the relationship editor', () => {
    const { container } = renderDiagram({ ecoreContent: REF_ECORE });

    expect(screen.getByText('0..*')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();

    const hitLine = container.querySelector('[data-rel-hit-line]');
    expect(hitLine).toBeTruthy();
    fireEvent.click(hitLine!);

    expect(screen.getByText('Edit relationship')).toBeInTheDocument();
  });

  it('creates an association when connect mode links two classes', () => {
    const { container } = renderDiagram();
    const relCountBefore = container.querySelectorAll('[data-rel-hit-line]').length;

    fireEvent.click(screen.getByTitle('Connect two classes in the same model'));

    const classBoxes = container.querySelectorAll('[data-classbox]');
    fireEvent.click(classBoxes[0]);
    fireEvent.click(classBoxes[1]);

    expect(container.querySelectorAll('[data-rel-hit-line]').length).toBeGreaterThan(relCountBefore);
  });
});
