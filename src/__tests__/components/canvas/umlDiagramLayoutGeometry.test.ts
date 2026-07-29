import {
  buildUmlClassObstacleRects,
  getUmlClassBoxHeight,
  getUmlDiagramLayoutMetrics,
  getUmlMultiplicityPosition,
  getUmlRelationshipEndpoints,
  insetUmlRelationshipEndpoints,
  type UmlDiagramRelationshipLayout,
} from '../../../components/canvas/umlDiagramLayoutGeometry';
import type { UmlDiagramClass } from '../../../components/canvas/umlDiagramTypes';

function createClass(
  overrides: Partial<UmlDiagramClass> = {},
): UmlDiagramClass {
  return {
    id: 'source',
    name: 'Source',
    isAbstract: false,
    isInterface: false,
    attributes: [],
    operations: [],
    x: 0,
    y: 0,
    ...overrides,
  };
}

describe('umlDiagramLayoutGeometry', () => {
  it('returns the existing empty and populated diagram layout metrics', () => {
    expect(getUmlDiagramLayoutMetrics([])).toEqual({
      totalW: 1200,
      totalH: 900,
      offsetX: 480,
      offsetY: 480,
      minX: 0,
      minY: 0,
      maxX: 700,
      maxY: 400,
    });

    const classes = [
      createClass({ x: 100, y: 50 }),
      createClass({
        id: 'target',
        name: 'Target',
        isAbstract: true,
        x: 400,
        y: 200,
      }),
    ];

    expect(getUmlDiagramLayoutMetrics(classes)).toEqual({
      totalW: 1450,
      totalH: 1224,
      offsetX: 380,
      offsetY: 430,
      minX: 100,
      minY: 50,
      maxX: 590,
      maxY: 314,
    });
    expect(getUmlDiagramLayoutMetrics(
      classes,
      { offsetX: 25, offsetY: 35 },
    )).toMatchObject({
      totalW: 1450,
      totalH: 1224,
      offsetX: 25,
      offsetY: 35,
    });
  });

  it('calculates normal, abstract, interface, and populated class heights', () => {
    expect(getUmlClassBoxHeight(createClass())).toBe(96);
    expect(getUmlClassBoxHeight(createClass({ isAbstract: true }))).toBe(114);
    expect(getUmlClassBoxHeight(createClass({ isInterface: true }))).toBe(114);
    expect(getUmlClassBoxHeight(createClass({
      attributes: [
        {
          id: 'source-name',
          name: 'name',
          type: 'String',
          visibility: '+',
        },
        {
          id: 'source-code',
          name: 'code',
          type: 'Int',
          visibility: '-',
        },
      ],
      operations: [
        {
          id: 'source-op-calculate',
          name: 'calculate',
          returnType: 'Void',
          visibility: '#',
        },
      ],
    }))).toBe(168);
  });

  it('calculates relationship endpoints and parallel line offsets', () => {
    const classes = [
      createClass(),
      createClass({
        id: 'target',
        name: 'Target',
        x: 300,
      }),
    ];
    const relationship: UmlDiagramRelationshipLayout = {
      id: 'source-target',
      sourceId: 'source',
      targetId: 'target',
      type: 'association',
    };

    expect(getUmlRelationshipEndpoints(
      relationship,
      classes,
      0,
      0,
    )).toEqual({
      p1: { x: 190, y: 48 },
      p2: { x: 300, y: 48 },
    });
    expect(getUmlRelationshipEndpoints(
      {
        ...relationship,
        parallelIndex: 0,
        parallelCount: 3,
      },
      classes,
      0,
      0,
    )).toEqual({
      p1: { x: 190, y: 34 },
      p2: { x: 300, y: 34 },
    });
    expect(getUmlRelationshipEndpoints(
      {
        ...relationship,
        parallelIndex: 2,
        parallelCount: 3,
      },
      classes,
      0,
      0,
    )).toEqual({
      p1: { x: 190, y: 62 },
      p2: { x: 300, y: 62 },
    });
    expect(getUmlRelationshipEndpoints(
      { ...relationship, targetId: 'missing' },
      classes,
      0,
      0,
    )).toBeNull();
  });

  it('insets long line endpoints and leaves short lines unchanged', () => {
    expect(insetUmlRelationshipEndpoints(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    )).toEqual({
      drawP1: { x: 10, y: 0 },
      drawP2: { x: 90, y: 0 },
      ux: 1,
      uy: 0,
    });
    expect(insetUmlRelationshipEndpoints(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    )).toEqual({
      drawP1: { x: 0, y: 0 },
      drawP2: { x: 10, y: 0 },
      ux: 1,
      uy: 0,
    });
  });

  it('positions multiplicities for normal, short, and direction-marked lines', () => {
    expect(getUmlMultiplicityPosition(
      0,
      0,
      200,
      0,
      'start',
    )).toMatchObject({
      x: 52,
      y: 10,
      anchorX: 0,
      anchorY: 0,
      lineUx: 1,
      lineUy: 0,
      nx: -0,
      ny: 1,
      lineLength: 200,
    });
    expect(getUmlMultiplicityPosition(
      0,
      0,
      200,
      0,
      'start',
      true,
    )).toMatchObject({
      x: 70,
      y: 10,
    });
    expect(getUmlMultiplicityPosition(
      0,
      0,
      200,
      0,
      'end',
      true,
    )).toMatchObject({
      x: 130,
      y: 10,
      anchorX: 200,
      anchorY: 0,
    });
    expect(getUmlMultiplicityPosition(
      0,
      0,
      60,
      0,
      'start',
      true,
    )).toMatchObject({
      x: 26,
      y: 31,
      lineLength: 60,
    });
  });

  it('builds class obstacle rectangles with existing clearance and height', () => {
    expect(buildUmlClassObstacleRects(
      [createClass({ x: 100, y: 200 })],
      10,
      20,
    )).toEqual([
      {
        left: 102,
        top: 212,
        right: 308,
        bottom: 324,
      },
    ]);
  });

});
