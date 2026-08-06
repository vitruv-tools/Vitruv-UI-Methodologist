/* eslint-disable import/first, testing-library/no-container, testing-library/no-node-access */

jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('../../../testSupport/umlDiagram/mockFactories').saveMetaModelEcoreMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramMinimapMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());

import { fireEvent, screen } from '@testing-library/react';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

function classBox(className: string): HTMLElement {
  const box = screen.getAllByRole('group').find(candidate => (
    candidate.hasAttribute('data-classbox')
      && candidate.getAttribute('aria-label')?.includes(` ${className}`)
  ));
  if (!box) throw new Error(`Missing class box ${className}`);
  return box;
}

describe('UMLDiagram interaction', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('enters connect mode and cancels the armed connection with Escape', () => {
    const { container } = renderDiagram();

    fireEvent.click(screen.getByTitle('Connect two classes'));
    fireEvent.click(classBox('Employee'));
    expect(container.querySelector('[data-uml-connect-banner]'))
      .toHaveTextContent('Click the target class to create a connection');
    fireEvent.keyDown(globalThis, { key: 'Escape' });

    expect(container.querySelector('[data-uml-connect-banner]')).not.toBeInTheDocument();
    expect(screen.getByTitle('Connect two classes')).toBeInTheDocument();
  });
});
