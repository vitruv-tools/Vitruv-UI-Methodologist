jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('../../../testSupport/umlDiagram/mockFactories').saveMetaModelEcoreMock());
jest.mock('../../../utils/umlValidation', () => require('../../../testSupport/umlDiagram/mockFactories').umlValidationMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramMinimapMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());

import { screen } from '@testing-library/react';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

// Mirrors the private BW/boxH constants in UMLDiagram.tsx for the fixed "Employee -> Person"
// inheritance relationship used by the default (SIMPLE_ECORE) mock model. See mockFactories.ts.
const BW = 190;
const NAME_H = 36;
const ATTR_ROW = 22;
const ATTR_PAD = 10;
const ADD_BTN_H = 22;
const METH_H = 26;

function boxH(attributeCount: number): number {
  const ah = attributeCount * ATTR_ROW + ATTR_PAD + ADD_BTN_H;
  const oh = ADD_BTN_H; // no operations
  const mh = Math.max(METH_H, oh);
  return NAME_H + 1 + ah + 1 + mh;
}

/** Same algorithm as UMLDiagram.tsx's private edgePt(): where a box's border intersects the line to a point. */
function edgePt(bx: number, by: number, h: number, tx: number, ty: number) {
  const cx = bx + BW / 2;
  const cy = by + h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  const hw = BW / 2;
  const hh = h / 2;
  const t = Math.abs(dx) * hh > Math.abs(dy) * hw ? hw / Math.abs(dx) : hh / Math.abs(dy);
  return { x: cx + dx * t, y: cy + dy * t };
}

function parseLeftTop(style: CSSStyleDeclaration): { left: number; top: number } {
  return { left: parseFloat(style.left), top: parseFloat(style.top) };
}

function parseMarkerTranslate(style: string): { x: number; y: number } {
  // e.g. "translate(-50%, -50%) translate(123.45px, 67.8px) rotate(0deg)"
  const match = style.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*rotate/);
  if (!match) throw new Error(`Could not parse marker transform: ${style}`);
  return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
}

describe('UMLDiagram direction marker anchoring', () => {
  it('anchors the inheritance triangle at the true class-box edge, not the inset line endpoint', () => {
    const { container } = renderDiagram();

    const personBox = screen.getByText('Person').closest('[data-classbox]');
    const employeeBox = screen.getByText('Employee').closest('[data-classbox]');
    expect(personBox).toBeTruthy();
    expect(employeeBox).toBeTruthy();

    const personWrapper = personBox!.parentElement as HTMLElement;
    const employeeWrapper = employeeBox!.parentElement as HTMLElement;
    const person = parseLeftTop(personWrapper.style);
    const employee = parseLeftTop(employeeWrapper.style);

    // Employee (source) --inheritance--> Person (target); the triangle anchors on the
    // 'end' side, i.e. at Person's edge facing Employee.
    const personH = boxH(1); // Person has 1 attribute ("name")
    const employeeH = boxH(0); // Employee has 0 attributes
    const expected = edgePt(
      person.left, person.top, personH,
      employee.left + BW / 2, employee.top + employeeH / 2,
    );

    const marker = container.querySelector('[data-rel-direction-marker]');
    expect(marker).toBeTruthy();
    const actual = parseMarkerTranslate((marker as HTMLElement).style.transform);

    expect(actual.x).toBeCloseTo(expected.x, 1);
    expect(actual.y).toBeCloseTo(expected.y, 1);

    // Regression guard: the marker must NOT sit at the old (buggy) 10px-inset point, which
    // would leave a visible gap between the marker and the class box border.
    const EDGE_ENDPOINT_INSET = 10;
    const insetX = expected.x - EDGE_ENDPOINT_INSET; // inset moves along the line, toward Employee (lower x)
    expect(Math.abs(actual.x - insetX)).toBeGreaterThan(5);
  });
});
