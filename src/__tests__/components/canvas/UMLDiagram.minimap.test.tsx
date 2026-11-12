const mockMinimapSpy = vi.fn();

vi.mock('../../../utils/ecoreToUml', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).ecoreToUmlMock());
vi.mock('../../../utils/saveMetaModelEcore', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).saveMetaModelEcoreMock());
vi.mock('../../../utils/umlValidation', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlValidationMock());
vi.mock('../../../components/canvas/UMLDiagramMinimap', async () => {
  const mockReact = await import('react');
  return {
    UMLDiagramMinimap: (props: unknown) => {
      mockMinimapSpy(props);
      return mockReact.createElement('div', { 'data-testid': 'uml-minimap-stub' });
    },
  };
});
vi.mock('../../../utils/umlDiagramGeometry', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlDiagramGeometryMock());
vi.mock('../../../utils/umlClassLayout', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlClassLayoutMock());
vi.mock('../../../utils/umlLayoutStorage', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlLayoutStorageMock());

import { SIMPLE_ECORE } from '../../../testSupport/umlDiagram/fixtures';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

describe('UMLDiagram minimap', () => {
  beforeEach(() => {
    mockMinimapSpy.mockClear();
  });

  it('passes primary model classes to the minimap', () => {
    renderDiagram({
      ecoreContent: SIMPLE_ECORE,
    });

    expect(mockMinimapSpy).toHaveBeenCalled();
    const lastCall = mockMinimapSpy.mock.calls.at(-1)?.[0] as {
      classes: { id: string }[];
    };
    const classIds = lastCall.classes.map(c => c.id);

    expect(classIds).toEqual(expect.arrayContaining(['Person', 'Employee']));
  });
});
