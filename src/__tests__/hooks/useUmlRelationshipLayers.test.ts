import { act, renderHook } from '@testing-library/react';
import {
  getUmlMultiplicityPosition,
  type UmlDiagramRelationshipLayout,
} from '../../components/canvas/umlDiagramLayoutGeometry';
import type {
  UmlDiagramClass,
} from '../../components/canvas/umlDiagramTypes';
import { useUmlRelationshipLayers } from '../../hooks/useUmlRelationshipLayers';

jest.mock('../../components/canvas/umlDiagramLayoutGeometry', () => {
  const actual = jest.requireActual(
    '../../components/canvas/umlDiagramLayoutGeometry',
  );
  return {
    ...actual,
    getUmlMultiplicityPosition: jest.fn(
      actual.getUmlMultiplicityPosition,
    ),
  };
});

const mockedGetUmlMultiplicityPosition = (
  getUmlMultiplicityPosition as jest.MockedFunction<
    typeof getUmlMultiplicityPosition
  >
);

function createClass(
  id: string,
  x: number,
  y: number,
): UmlDiagramClass {
  return {
    id,
    name: id,
    isAbstract: false,
    isInterface: false,
    attributes: [],
    operations: [],
    x,
    y,
  };
}

function createRelationship(
  id: string,
  sourceId: string,
  targetId: string,
  overrides: Partial<UmlDiagramRelationshipLayout> = {},
): UmlDiagramRelationshipLayout {
  return {
    id,
    sourceId,
    targetId,
    type: 'association',
    ...overrides,
  };
}

describe('useUmlRelationshipLayers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds endpoint, inset, and bridge layouts while omitting missing endpoints', () => {
    const classes = [
      createClass('A', 0, 0),
      createClass('B', 400, 400),
      createClass('C', 400, 0),
      createClass('D', 0, 400),
    ];
    const relationships = [
      createRelationship('cross-a', 'A', 'B'),
      createRelationship('cross-b', 'C', 'D'),
      createRelationship('missing', 'A', 'missing'),
    ];

    const { result } = renderHook(() => useUmlRelationshipLayers({
      parallelRelationships: relationships,
      classes,
      offsetX: 0,
      offsetY: 0,
    }));

    expect(result.current.edgeLayouts.map(layout => layout.rel.id)).toEqual([
      'cross-a',
      'cross-b',
    ]);
    expect(result.current.edgeLayouts[0].drawP1).not.toEqual(
      result.current.edgeLayouts[0].p1,
    );
    expect(result.current.edgeLayouts[0].drawP2).not.toEqual(
      result.current.edgeLayouts[0].p2,
    );
    expect(result.current.edgeLayouts[0].bridges).toHaveLength(1);
    expect(result.current.edgeLayouts[1].bridges).toHaveLength(0);
  });

  it('consumes parallel relationship metadata when calculating endpoints', () => {
    const classes = [
      createClass('A', 0, 0),
      createClass('B', 400, 0),
    ];
    const relationships = [
      createRelationship('parallel-a', 'A', 'B', {
        parallelIndex: 0,
        parallelCount: 2,
      }),
      createRelationship('parallel-b', 'A', 'B', {
        parallelIndex: 1,
        parallelCount: 2,
      }),
    ];

    const { result } = renderHook(() => useUmlRelationshipLayers({
      parallelRelationships: relationships,
      classes,
      offsetX: 0,
      offsetY: 0,
    }));

    expect(result.current.edgeLayouts[0].rel.parallelIndex).toBe(0);
    expect(result.current.edgeLayouts[1].rel.parallelIndex).toBe(1);
    expect(result.current.edgeLayouts[1].p1.y
      - result.current.edgeLayouts[0].p1.y).toBe(14);
    expect(result.current.edgeLayouts[1].p2.y
      - result.current.edgeLayouts[0].p2.y).toBe(14);
  });

  it('creates multiplicities with marker offsets', () => {
    const classes = [
      createClass('A', 0, 0),
      createClass('B', 400, 0),
    ];
    const relationships = [
      createRelationship('normal-1', 'A', 'B', {
        sourceMultiplicity: '1',
        targetMultiplicity: '0..*',
      }),
    ];

    const { result } = renderHook(() => useUmlRelationshipLayers({
      parallelRelationships: relationships,
      classes,
      offsetX: 0,
      offsetY: 0,
    }));

    expect(result.current.multiplicityBadges.map(badge => ({
      key: badge.key,
      relId: badge.relId,
      text: badge.text,
    }))).toEqual([
      { key: 'normal-1-src', relId: 'normal-1', text: '1' },
      { key: 'normal-1-tgt', relId: 'normal-1', text: '0..*' },
    ]);
    expect(mockedGetUmlMultiplicityPosition).toHaveBeenCalledTimes(2);
    expect(mockedGetUmlMultiplicityPosition.mock.calls[0][4]).toBe('start');
    expect(mockedGetUmlMultiplicityPosition.mock.calls[0][5]).toBe(false);
    expect(mockedGetUmlMultiplicityPosition.mock.calls[1][4]).toBe('end');
    expect(mockedGetUmlMultiplicityPosition.mock.calls[1][5]).toBe(true);
  });

  it('tracks focused relationship hover state', () => {
    const { result } = renderHook(() => useUmlRelationshipLayers({
      parallelRelationships: [],
      classes: [],
      offsetX: 0,
      offsetY: 0,
    }));

    expect(result.current.hoveredRelationshipId).toBeNull();

    act(() => {
      result.current.handleRelationshipMouseEnter('relationship-1');
    });
    expect(result.current.hoveredRelationshipId).toBe('relationship-1');

    act(() => {
      result.current.handleRelationshipMouseLeave();
    });
    expect(result.current.hoveredRelationshipId).toBeNull();
  });
});
