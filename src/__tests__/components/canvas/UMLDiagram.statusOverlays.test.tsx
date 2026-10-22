import type { MockedFunction } from 'vitest';
/* eslint-disable import/first, testing-library/no-container, testing-library/no-node-access */

vi.mock('../../../utils/ecoreToUml', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).ecoreToUmlMock());
vi.mock('../../../utils/saveMetaModelEcore', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).saveMetaModelEcoreMock());
vi.mock('../../../utils/umlValidation', async () => {
  const actual = (await vi.importActual<any>('../../../utils/umlValidation'));
  return { ...actual, validateUmlModel: vi.fn(() => []) };
});
vi.mock('../../../components/canvas/UMLDiagramMinimap', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlDiagramMinimapMock());
vi.mock('../../../utils/umlDiagramGeometry', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlDiagramGeometryMock());
vi.mock('../../../utils/umlClassLayout', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlClassLayoutMock());
vi.mock('../../../utils/umlLayoutStorage', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlLayoutStorageMock());

import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';
import { validateUmlModel } from '../../../utils/umlValidation';

const validateUmlModelMock = validateUmlModel as MockedFunction<typeof validateUmlModel>;

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
