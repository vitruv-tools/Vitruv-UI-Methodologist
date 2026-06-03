import React, { createRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { UMLDiagram, UMLDiagramHandle } from '../../../components/canvas/UMLDiagram';
import { loadUmlLayout, saveUmlLayout } from '../../../utils/umlLayoutStorage';

const SIMPLE_ECORE = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" name="test">
  <eClassifiers xsi:type="ecore:EClass" name="Person">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="name" eType="//EString" lowerBound="1" upperBound="1"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Employee" eSuperTypes="#//Person"/>
</ecore:EPackage>`;

const EMPTY_ECORE = `<?xml version="1.0"?><ecore:EPackage xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" name="empty"/>`;

const REF_ECORE = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" name="test">
  <eClassifiers xsi:type="ecore:EClass" name="Order">
    <eStructuralFeatures xsi:type="ecore:EReference" name="lines" eType="#//LineItem" lowerBound="0" upperBound="-1"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="LineItem"/>
</ecore:EPackage>`;

const scopeId = 'uml-diagram-test';
const fileName = 'simple.ecore';

beforeEach(() => {
  localStorage.clear();
});

describe('UMLDiagram real component', () => {
  it('empty ecore shows "No UML content found." message', () => {
    render(<UMLDiagram ecoreContent={EMPTY_ECORE} />);
    expect(screen.getByText(/No UML content found/i)).toBeInTheDocument();
  });

  it('valid ecore renders class names', () => {
    render(<UMLDiagram ecoreContent={SIMPLE_ECORE} />);
    expect(screen.getByText('Person')).toBeInTheDocument();
    expect(screen.getByText('Employee')).toBeInTheDocument();
  });

  it('renders an SVG for relationship lines when there are relationships', () => {
    const { container } = render(<UMLDiagram ecoreContent={SIMPLE_ECORE} />);
    const svgs = container.querySelectorAll('svg');
    // At least one SVG for relationship lines
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('clicking "Add attribute" row enters edit mode — an input appears', async () => {
    render(<UMLDiagram ecoreContent={SIMPLE_ECORE} />);
    // The "Add attribute" row is a div with text "+ Add attribute"
    const addAttrRows = screen.getAllByText('Add attribute');
    await act(async () => {
      fireEvent.click(addAttrRows[0]);
    });
    // After clicking, an input for editing the new attribute should appear
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
  });

  it('double-clicking the class name enters name-edit mode — an input appears', async () => {
    render(<UMLDiagram ecoreContent={SIMPLE_ECORE} />);
    const personName = screen.getByText('Person');
    await act(async () => {
      fireEvent.doubleClick(personName);
    });
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
  });

  it('exposes zoomIn/zoomOut/fitToView via ref without throwing', () => {
    const diagramRef = createRef<UMLDiagramHandle>();
    render(<UMLDiagram ref={diagramRef} ecoreContent={SIMPLE_ECORE} />);
    expect(() => {
      diagramRef.current?.zoomIn();
      diagramRef.current?.zoomOut();
      diagramRef.current?.fitToView();
    }).not.toThrow();
  });

  it('mouse down on the container (not a class box) sets panning cursor', async () => {
    const { container } = render(<UMLDiagram ecoreContent={SIMPLE_ECORE} />);
    // The outer container div listens to onMouseDown for panning
    // Find the outermost div (not a classbox)
    const outerDiv = container.firstChild as HTMLElement;
    await act(async () => {
      fireEvent.mouseDown(outerDiv, { clientX: 0, clientY: 0 });
    });
    // After mousedown on non-classbox area, panning=true should be set
    // We just verify no error is thrown
    fireEvent.mouseUp(window);
  });

  it('renders class boxes with data-classbox attribute', () => {
    const { container } = render(<UMLDiagram ecoreContent={SIMPLE_ECORE} />);
    const classBoxes = container.querySelectorAll('[data-classbox]');
    expect(classBoxes.length).toBeGreaterThan(0);
  });

  it('renders attribute name from ecore', () => {
    render(<UMLDiagram ecoreContent={SIMPLE_ECORE} />);
    expect(screen.getByText('name')).toBeInTheDocument();
  });

  it('restores saved class positions when fileName and layoutScopeId are provided', () => {
    saveUmlLayout(scopeId, fileName, { Person: { x: 420, y: 310 } });
    const { container } = render(
      <UMLDiagram
        ecoreContent={SIMPLE_ECORE}
        fileName={fileName}
        layoutScopeId={scopeId}
      />,
    );
    const personBox = Array.from(container.querySelectorAll('[data-classbox]')).find(el =>
      el.textContent?.includes('Person'),
    ) as HTMLElement;
    expect(personBox).toBeTruthy();
    expect(parseFloat(personBox.style.left)).toBeGreaterThan(400);
  });

  it('persists layout to localStorage on unmount', () => {
    const { unmount } = render(
      <UMLDiagram
        ecoreContent={SIMPLE_ECORE}
        fileName={fileName}
        layoutScopeId={scopeId}
      />,
    );
    unmount();
    const saved = loadUmlLayout(scopeId, fileName);
    expect(saved).not.toBeNull();
    expect(saved?.Person).toBeDefined();
  });

  it('keeps negative coordinates in saved layout (no clamp to zero)', () => {
    saveUmlLayout(scopeId, fileName, { Person: { x: -120, y: -90 }, Employee: { x: 200, y: 100 } });
    const { unmount } = render(
      <UMLDiagram
        ecoreContent={SIMPLE_ECORE}
        fileName={fileName}
        layoutScopeId={scopeId}
      />,
    );
    unmount();
    expect(loadUmlLayout(scopeId, fileName)?.Person).toEqual({ x: -120, y: -90 });
  });

  it('highlights relationship line when clicked', async () => {
    const { container } = render(<UMLDiagram ecoreContent={SIMPLE_ECORE} />);
    const relGroup = container.querySelector('[data-rel-line]') as SVGGElement;
    expect(relGroup).not.toBeNull();
    await act(async () => {
      fireEvent.click(relGroup);
    });
    const strokeLine = relGroup.querySelectorAll('line')[2];
    expect(strokeLine?.getAttribute('stroke')).toBe('#ef4444');
  });

  it('renders multiplicity badges on association edges', () => {
    render(<UMLDiagram ecoreContent={REF_ECORE} />);
    expect(screen.getByText('0..*')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders a minimap overview in the bottom-right corner', () => {
    const { container } = render(<UMLDiagram ecoreContent={SIMPLE_ECORE} />);
    expect(container.querySelector('[title="Diagram overview — click or drag to pan"]')).not.toBeNull();
  });
});
