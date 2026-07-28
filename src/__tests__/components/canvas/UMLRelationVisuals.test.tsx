import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactionEdge } from '../../../types/reactions';
import type { UMLRelationship, UMLRelType } from '../../../utils/ecoreToUml';
import type { MultiplicityBadge } from '../../../utils/umlDiagramGeometry';
import {
  getUmlRelationDirectionMarkerSide,
  getUmlRelationEdgeState,
  UMLMultiplicityBadge,
  UMLRelationDirectionMarker,
  UMLRelationHitTarget,
  UMLRelationLine,
  UML_REACTION_EDGE_COLORS,
  UML_RELATION_EDGE_COLORS,
  UML_RELATION_EDGE_WIDTHS,
} from '../../../components/canvas/UMLRelationVisuals';

const POINTS = {
  p1: { x: 10, y: 20 },
  p2: { x: 110, y: 20 },
  drawP1: { x: 20, y: 20 },
  drawP2: { x: 100, y: 20 },
};

function createRelationship(
  type: UMLRelType = 'association',
  overrides: Partial<UMLRelationship> = {},
): UMLRelationship {
  return {
    id: `rel-${type}`,
    sourceId: 'source',
    targetId: 'target',
    type,
    ...overrides,
  };
}

function createReactionEdge(bidirectional: boolean): ReactionEdge {
  return {
    id: 'reaction-1',
    sourceModelId: 1,
    sourceClassId: 'source',
    sourceClassName: 'Source',
    targetModelId: 2,
    targetClassId: 'target',
    targetClassName: 'Target',
    config: {
      bidirectional,
      reactionName: 'Source_Target',
      model1Url: 'https://example.test/source',
      model2Url: 'https://example.test/target',
      model1Alias: 'SourceModel',
      model2Alias: 'TargetModel',
      model1RootType: 'Source',
      model2RootType: 'Target',
      model1RootVal: 'Source',
    },
  };
}

describe('UMLRelationVisuals', () => {
  it('renders normal and reaction relationship lines with labels', () => {
    const relation = createRelationship('association', { label: 'assignedTo' });
    const { rerender } = render(
      <svg>
        <UMLRelationLine
          rel={relation}
          {...POINTS}
          bridges={[]}
          state="default"
        />
      </svg>,
    );

    let relationLine = screen.getByTestId('uml-relation-line');
    expect(relationLine).toContainHTML('stroke="#ffffff" stroke-width="5.5"');
    expect(relationLine).toContainHTML('stroke="#0c436e" stroke-width="1.5"');
    expect(screen.getByText('assignedTo')).toHaveAttribute('fill', '#0c436e');

    rerender(
      <svg>
        <UMLRelationLine
          rel={relation}
          {...POINTS}
          bridges={[]}
          state="selected"
          reactionEdge={createReactionEdge(false)}
        />
      </svg>,
    );

    relationLine = screen.getByTestId('uml-relation-line');
    expect(relationLine).toContainHTML('stroke="#7e22ce" stroke-width="3"');
    expect(screen.getByText('assignedTo')).toHaveAttribute('fill', '#7e22ce');
  });

  it('forwards hit-target click and hover callbacks with the existing hit styling', () => {
    const onRelClick = jest.fn();
    const onMouseEnter = jest.fn();
    const onMouseLeave = jest.fn();
    render(
      <svg>
        <UMLRelationHitTarget
          relId="rel-1"
          drawP1={POINTS.drawP1}
          drawP2={POINTS.drawP2}
          bridges={[]}
          onRelClick={onRelClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        />
      </svg>,
    );

    const hitTarget = screen.getByTestId('uml-relation-hit-target');
    expect(hitTarget).toHaveAttribute('data-rel-id', 'rel-1');
    expect(hitTarget).toHaveAttribute('stroke', 'transparent');
    expect(hitTarget).toHaveAttribute('stroke-width', '28');
    expect(hitTarget).toHaveStyle({ cursor: 'pointer', pointerEvents: 'stroke' });

    fireEvent.click(hitTarget);
    fireEvent.mouseEnter(hitTarget);
    fireEvent.mouseLeave(hitTarget);

    expect(onRelClick).toHaveBeenCalledTimes(1);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(onMouseLeave).toHaveBeenCalledTimes(1);
  });

  it('renders multiplicity badge geometry and typography', () => {
    const badge: MultiplicityBadge = {
      key: 'rel-1-source',
      relId: 'rel-1',
      end: 'start',
      anchorClassId: 'source',
      text: '0..*',
      x: 60,
      y: 45,
      nx: 0,
      ny: 1,
      anchorX: 10,
      anchorY: 20,
      lineUx: 1,
      lineUy: 0,
      lineLength: 100,
    };
    render(
      <svg>
        <UMLMultiplicityBadge badge={badge} strokeColor="#ef4444" />
      </svg>,
    );

    const badgeGraphic = screen.getByTestId('uml-multiplicity-badge');
    expect(badgeGraphic).toContainHTML(
      'x="42" y="33" width="36" height="24" rx="4" fill="#ffffff" stroke="#ef4444"',
    );
    expect(screen.getByText('0..*')).toHaveAttribute('font-size', '13');
    expect(screen.getByText('0..*')).toHaveAttribute('fill', '#ef4444');
  });

  it.each([
    {
      type: 'association' as const,
      side: 'end',
      label: 'Select relationship: assignedTo',
      overrides: { label: 'assignedTo' },
      anchor: 'translate(110px, 20px)',
      viewBox: '0 0 12 12',
      size: '18',
      graphicHtml: 'fill="#049484"',
    },
    {
      type: 'inheritance' as const,
      side: 'end',
      label: 'Select inheritance relationship',
      overrides: {},
      anchor: 'translate(110px, 20px)',
      viewBox: '0 0 12 12',
      size: '18',
      graphicHtml: 'fill="#ffffff" stroke="#049484"',
    },
    {
      type: 'composition' as const,
      side: 'start',
      label: 'Select composition relationship',
      overrides: {},
      anchor: 'translate(10px, 20px)',
      viewBox: '0 0 14 14',
      size: '20',
      graphicHtml: 'fill="#049484"',
    },
  ])(
    'renders $type marker geometry and accessible label',
    ({ type, side, label, overrides, anchor, viewBox, size, graphicHtml }) => {
      const onRelClick = jest.fn();
      render(
        <UMLRelationDirectionMarker
          rel={createRelationship(type, overrides)}
          lineStart={POINTS.p1}
          lineEnd={POINTS.p2}
          color="#049484"
          onRelClick={onRelClick}
          onMouseEnter={jest.fn()}
          onMouseLeave={jest.fn()}
        />,
      );

      expect(getUmlRelationDirectionMarkerSide(type)).toBe(side);
      const marker = screen.getByRole('button', { name: label });
      expect(marker).toHaveStyle({ cursor: 'pointer' });
      expect(marker.style.transform).toContain(anchor);
      expect(marker).toContainHTML(
        `width="${size}" height="${size}" viewBox="${viewBox}"`,
      );
      expect(marker).toContainHTML(graphicHtml);

      fireEvent.click(marker);
      expect(onRelClick).toHaveBeenCalledTimes(1);
      expect(screen.getAllByRole('button', { name: label })).toHaveLength(1);
    },
  );

  it('renders single-direction and bidirectional reaction markers', () => {
    const relation = createRelationship('association', { label: 'synchronizes' });
    const props = {
      rel: relation,
      lineStart: POINTS.p1,
      lineEnd: POINTS.p2,
      color: '#a855f7',
      onRelClick: jest.fn(),
      onMouseEnter: jest.fn(),
      onMouseLeave: jest.fn(),
    };
    const { rerender } = render(
      <UMLRelationDirectionMarker
        {...props}
        reactionEdge={createReactionEdge(false)}
      />,
    );

    let markers = screen.getAllByRole('button', {
      name: 'Select relationship: synchronizes',
    });
    expect(markers).toHaveLength(1);
    expect(markers[0].style.transform).toContain('translate(110px, 20px)');
    expect(markers[0]).toContainHTML('fill="#a855f7"');

    rerender(
      <UMLRelationDirectionMarker
        {...props}
        reactionEdge={createReactionEdge(true)}
      />,
    );

    markers = screen.getAllByRole('button', {
      name: 'Select relationship: synchronizes',
    });
    expect(markers).toHaveLength(2);
    expect(markers[0].style.transform).toContain('translate(10px, 20px)');
    expect(markers[0].style.transform).toContain('rotate(180deg)');
    expect(markers[1].style.transform).toContain('translate(110px, 20px)');
    expect(markers[1].style.transform).toContain('rotate(0deg)');
  });

  it('selects edge states, colors, and widths without visual drift', () => {
    expect(getUmlRelationEdgeState(false, false)).toBe('default');
    expect(getUmlRelationEdgeState(false, true)).toBe('hovered');
    expect(getUmlRelationEdgeState(true, true)).toBe('selected');

    expect(UML_RELATION_EDGE_COLORS).toEqual({
      default: '#0c436e',
      hovered: '#f87171',
      selected: '#ef4444',
    });
    expect(UML_REACTION_EDGE_COLORS).toEqual({
      default: '#a855f7',
      hovered: '#9333ea',
      selected: '#7e22ce',
    });
    expect(UML_RELATION_EDGE_WIDTHS).toEqual({
      default: 1.5,
      hovered: 2.5,
      selected: 3,
    });
  });
});
