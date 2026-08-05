import { fireEvent, render, screen } from '@testing-library/react';
import type { UMLRelationship } from '../../../utils/ecoreToUml';
import type { MultiplicityBadge } from '../../../utils/umlDiagramGeometry';
import type {
  UmlRelationshipEdgeLayout,
} from '../../../hooks/useUmlRelationshipLayers';
import {
  UMLRelationshipBaseLayer,
  UMLRelationshipOverlayLayers,
} from '../../../components/canvas/UMLRelationshipLayers';

function createRelationship(
  id: string,
  overrides: Partial<UMLRelationship> = {},
): UMLRelationship {
  return {
    id,
    sourceId: 'source',
    targetId: 'target',
    type: 'association',
    ...overrides,
  };
}

function createLayout(
  relationship: UMLRelationship,
  overrides: Partial<UmlRelationshipEdgeLayout> = {},
): UmlRelationshipEdgeLayout {
  return {
    rel: relationship,
    p1: { x: 10, y: 20 },
    p2: { x: 110, y: 20 },
    drawP1: { x: 20, y: 20 },
    drawP2: { x: 100, y: 20 },
    bridges: [],
    ...overrides,
  };
}

const BADGE: MultiplicityBadge = {
  key: 'rel-1-target',
  relId: 'rel-1',
  end: 'end',
  anchorClassId: 'target',
  text: '0..*',
  x: 70,
  y: 40,
  nx: 0,
  ny: 1,
  anchorX: 110,
  anchorY: 20,
  lineUx: 1,
  lineUy: 0,
  lineLength: 100,
};

describe('UMLRelationshipLayers', () => {
  it('renders selected and hovered base lines with bridge paths', () => {
    const selectedRelationship = createRelationship('rel-1');
    const hoveredRelationship = createRelationship('rel-2');
    const onBackgroundClick = jest.fn();
    render(
      <UMLRelationshipBaseLayer
        totalWidth={1200}
        totalHeight={900}
        edgeLayouts={[
          createLayout(selectedRelationship, {
            bridges: [{ t: 0.5, bulgeSign: 1 }],
          }),
          createLayout(hoveredRelationship),
        ]}
        selectedRelationshipId="rel-1"
        hoveredRelationshipId="rel-2"
        onBackgroundClick={onBackgroundClick}
      />,
    );

    const svg = screen.getByTestId('uml-relationship-base-layer');
    expect(svg).toHaveStyle({
      position: 'absolute',
      width: '1200px',
      height: '900px',
      overflow: 'visible',
    });

    const relationLines = screen.getAllByTestId('uml-relation-line');
    expect(relationLines[0]).toContainHTML(
      'stroke="#ef4444" stroke-width="3"',
    );
    expect(relationLines[0]).toContainHTML(' Q ');
    expect(relationLines[1]).toContainHTML(
      'stroke="#f87171" stroke-width="2.5"',
    );

    fireEvent.click(svg);
    expect(onBackgroundClick).toHaveBeenCalledTimes(1);
  });

  it('renders overlay layers without a wrapper and forwards hit and marker events', () => {
    const relationship = createRelationship('rel-1', {
      label: 'assignedTo',
    });
    const layout = createLayout(relationship, {
      bridges: [{ t: 0.5, bulgeSign: -1 }],
    });
    const onRelationshipClick = jest.fn();
    const onRelationshipMouseEnter = jest.fn();
    const onRelationshipMouseLeave = jest.fn();
    render(
      <UMLRelationshipOverlayLayers
        totalWidth={1200}
        totalHeight={900}
        edgeLayouts={[layout]}
        multiplicityBadges={[BADGE]}
        selectedRelationshipId="rel-1"
        hoveredRelationshipId={null}
        onRelationshipClick={onRelationshipClick}
        onRelationshipMouseEnter={onRelationshipMouseEnter}
        onRelationshipMouseLeave={onRelationshipMouseLeave}
      />,
    );

    const hitLayer = screen.getByTestId('uml-relationship-hit-layer');
    const badgeLayer = screen.getByTestId(
      'uml-relationship-multiplicity-layer',
    );
    expect(hitLayer).toHaveAttribute('data-rel-hit-layer');
    expect(badgeLayer).toHaveAttribute('data-mult-badge-layer');
    expect(hitLayer).toHaveStyle({
      zIndex: '6',
      pointerEvents: 'none',
      overflow: 'visible',
    });
    expect(badgeLayer).toHaveStyle({
      zIndex: '22',
      pointerEvents: 'none',
      overflow: 'visible',
    });

    const hitTarget = screen.getByTestId('uml-relation-hit-target');
    expect(hitTarget).toHaveAttribute('data-rel-id', 'rel-1');
    expect(hitTarget.getAttribute('d')).toContain('Q');
    fireEvent.click(hitTarget);
    fireEvent.mouseEnter(hitTarget);
    fireEvent.mouseLeave(hitTarget);

    expect(screen.getByTestId('uml-multiplicity-badge')).toContainHTML(
      'stroke="#ef4444"',
    );

    const marker = screen.getByRole('button', {
      name: 'Select relationship: assignedTo',
    });
    expect(marker).toHaveAttribute('data-rel-id', 'rel-1');
    expect(marker.style.transform).toContain('translate(110px, 20px)');
    expect(marker.style.transform).not.toContain('translate(100px, 20px)');
    expect(marker).toContainHTML('fill="#ef4444"');
    fireEvent.click(marker);
    fireEvent.mouseEnter(marker);
    fireEvent.mouseLeave(marker);

    expect(onRelationshipClick).toHaveBeenCalledTimes(2);
    expect(onRelationshipClick).toHaveBeenNthCalledWith(
      1,
      'rel-1',
      expect.any(Object),
    );
    expect(onRelationshipClick).toHaveBeenNthCalledWith(
      2,
      'rel-1',
      expect.any(Object),
    );
    expect(onRelationshipMouseEnter).toHaveBeenCalledTimes(2);
    expect(onRelationshipMouseEnter).toHaveBeenNthCalledWith(1, 'rel-1');
    expect(onRelationshipMouseEnter).toHaveBeenNthCalledWith(2, 'rel-1');
    expect(onRelationshipMouseLeave).toHaveBeenCalledTimes(2);
  });
});
