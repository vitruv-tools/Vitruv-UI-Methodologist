jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('../../../testSupport/umlDiagram/mockFactories').saveMetaModelEcoreMock());
jest.mock('../../../utils/umlValidation', () => require('../../../testSupport/umlDiagram/mockFactories').umlValidationMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramMinimapMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());

import { screen, fireEvent } from '@testing-library/react';
import { REF_ECORE } from '../../../testSupport/umlDiagram/fixtures';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

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

    fireEvent.click(screen.getByTitle('Connect two classes'));

    const classBoxes = container.querySelectorAll('[data-classbox]');
    fireEvent.click(classBoxes[0]);
    fireEvent.click(classBoxes[1]);

    expect(container.querySelectorAll('[data-rel-hit-line]').length).toBeGreaterThan(relCountBefore);
  });
});

