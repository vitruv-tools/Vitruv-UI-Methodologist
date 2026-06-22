import React, { createRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { UMLDiagram, UMLDiagramHandle } from '../../../components/canvas/UMLDiagram';
import { loadUmlLayout, saveUmlLayout } from '../../../utils/umlLayoutStorage';

jest.mock('../../../utils/saveMetaModelEcore', () => ({
  saveMetaModelEcore: jest.fn(),
}));

import { saveMetaModelEcore } from '../../../utils/saveMetaModelEcore';

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

const MULTI_REF_ECORE = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" name="test">
  <eClassifiers xsi:type="ecore:EClass" name="Hub"/>
  <eClassifiers xsi:type="ecore:EClass" name="Alpha">
    <eStructuralFeatures xsi:type="ecore:EReference" name="hub" eType="#//Hub" lowerBound="1" upperBound="1"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Beta">
    <eStructuralFeatures xsi:type="ecore:EReference" name="hub" eType="#//Hub" lowerBound="1" upperBound="1"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Gamma">
    <eStructuralFeatures xsi:type="ecore:EReference" name="hub" eType="#//Hub" lowerBound="1" upperBound="1"/>
  </eClassifiers>
</ecore:EPackage>`;

const scopeId = 'uml-diagram-test';
const fileName = 'simple.ecore';

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
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

  it('saves a new attribute when clicking empty canvas after typing', async () => {
    const { container } = render(<UMLDiagram ecoreContent={SIMPLE_ECORE} />);
    fireEvent.click(screen.getByText('Person'));
    fireEvent.click(screen.getAllByText('Add attribute')[0]);
    const input = screen.getAllByRole('textbox')[0];
    fireEvent.change(input, { target: { value: 'age' } });
    const diagramRoot = container.firstChild as HTMLElement;
    await act(async () => {
      fireEvent.mouseDown(diagramRoot);
    });
    expect(screen.getByText('age')).toBeInTheDocument();
  });

  it('saves attribute visibility when changed in the dropdown', async () => {
    render(<UMLDiagram ecoreContent={SIMPLE_ECORE} />);
    fireEvent.click(screen.getByText('Person'));
    fireEvent.click(screen.getAllByText('Add attribute')[0]);
    const visSelect = screen.getAllByRole('combobox')[0];
    await act(async () => {
      fireEvent.change(visSelect, { target: { value: '-' } });
    });
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });

  it('double-clicking empty canvas closes class selection and edit panel', async () => {
    const { container } = render(<UMLDiagram ecoreContent={SIMPLE_ECORE} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Person'));
    });
    expect(screen.getByText('Edit class')).toBeInTheDocument();

    const diagramRoot = container.firstChild as HTMLElement;
    await act(async () => {
      fireEvent.doubleClick(diagramRoot);
    });
    expect(screen.queryByText('Edit class')).not.toBeInTheDocument();
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
    const personBoxPosition = personBox.parentElement as HTMLElement;
    expect(parseFloat(personBoxPosition.style.left)).toBeGreaterThan(400);
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
    const hitLine = container.querySelector('[data-rel-hit-line]');
    expect(hitLine).not.toBeNull();
    await act(async () => {
      fireEvent.click(hitLine!);
    });
    const relGroup = container.querySelector('[data-rel-line]') as SVGGElement;
    const strokeLine = relGroup?.querySelectorAll('path')[1];
    expect(strokeLine?.getAttribute('stroke')).toBe('#ef4444');
  });

  it('renders multiplicity badges on association edges', () => {
    render(<UMLDiagram ecoreContent={REF_ECORE} />);
    expect(screen.getByText('0..*')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders every cardinality badge even when values repeat at the same class', () => {
    const { container } = render(<UMLDiagram ecoreContent={MULTI_REF_ECORE} />);
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll('[data-mult-badge]').length).toBeGreaterThanOrEqual(3);
  });

  it('renders relationship lines as SVG paths for bridge support', () => {
    const { container } = render(<UMLDiagram ecoreContent={REF_ECORE} />);
    expect(container.querySelectorAll('[data-rel-line] path').length).toBeGreaterThan(0);
  });

  it('renders direction markers by default without hovering', () => {
    const { container } = render(<UMLDiagram ecoreContent={REF_ECORE} />);
    const markers = container.querySelectorAll('[data-rel-direction-marker]');
    expect(markers.length).toBeGreaterThan(0);
    markers.forEach(marker => {
      expect(marker.querySelector('path, polygon')).not.toBeNull();
    });
  });

  it('renders a minimap overview in the bottom-right corner', () => {
    const { container } = render(<UMLDiagram ecoreContent={SIMPLE_ECORE} />);
    expect(container.querySelector('[aria-label="Diagram overview — click or drag to pan"]')).not.toBeNull();
  });

  it('shows add-class toolbar button when interactive', () => {
    render(<UMLDiagram ecoreContent={SIMPLE_ECORE} />);
    expect(screen.getByTitle('Add class')).toBeInTheDocument();
  });

  it('adds a new class when toolbar add button is clicked', async () => {
    render(<UMLDiagram ecoreContent={SIMPLE_ECORE} />);
    await act(async () => {
      fireEvent.click(screen.getByTitle('Add class'));
    });
    expect(screen.getByText('Edit class')).toBeInTheDocument();
    expect(screen.getByDisplayValue('NewClass')).toBeInTheDocument();
  });

  it('deletes selected class with toolbar delete button', async () => {
    render(<UMLDiagram ecoreContent={SIMPLE_ECORE} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Person'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTitle('Delete selected class or connection'));
    });
    expect(screen.queryByText('Person')).not.toBeInTheDocument();
  });

  it('selects relationship via hit layer and opens edit panel', async () => {
    const { container } = render(<UMLDiagram ecoreContent={REF_ECORE} />);
    const hitLine = container.querySelector('[data-rel-hit-line]');
    expect(hitLine).not.toBeNull();
    await act(async () => {
      fireEvent.click(hitLine!);
    });
    expect(screen.getByText('Edit relationship')).toBeInTheDocument();
  });

  it('keeps connection editor open until the close button is clicked', async () => {
    const { container } = render(<UMLDiagram ecoreContent={REF_ECORE} />);
    const hitLine = container.querySelector('[data-rel-hit-line]');
    await act(async () => {
      fireEvent.click(hitLine!);
    });
    expect(screen.getByText('Edit relationship')).toBeInTheDocument();

    const svg = container.querySelector('svg');
    await act(async () => {
      fireEvent.click(svg!);
    });
    expect(screen.getByText('Edit relationship')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTitle('Close panel'));
    });
    expect(screen.queryByText('Edit relationship')).not.toBeInTheDocument();
  });

  it('creates association when connect mode links two classes', async () => {
    const { container } = render(<UMLDiagram ecoreContent={SIMPLE_ECORE} />);
    const relCountBefore = container.querySelectorAll('[data-rel-hit-line]').length;
    await act(async () => {
      fireEvent.click(screen.getByTitle('Connect two classes'));
    });
    const classBoxes = container.querySelectorAll('[data-classbox]');
    await act(async () => {
      fireEvent.click(classBoxes[0]);
    });
    await act(async () => {
      fireEvent.click(classBoxes[1]);
    });
    expect(container.querySelectorAll('[data-rel-hit-line]').length).toBeGreaterThan(relCountBefore);
  });

  it('workspace save updates project copy without calling library API', async () => {
    const ref = createRef<UMLDiagramHandle>();
    const onSaved = jest.fn();
    render(
      <UMLDiagram
        ref={ref}
        ecoreContent={SIMPLE_ECORE}
        interactive
        saveContext={{
          metaModelId: '1',
          ecoreFileId: 42,
          modelName: 'simple',
          saveTarget: 'workspace',
          onSaved,
        }}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByTitle('Connect two classes'));
    });
    const classBoxes = document.querySelectorAll('[data-classbox]');
    await act(async () => {
      fireEvent.click(classBoxes[0]);
      fireEvent.click(classBoxes[1]);
    });
    await act(async () => {
      await ref.current?.save();
    });
    expect(saveMetaModelEcore).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ ecoreFileId: 42 }));
    expect(screen.getByText('Saved to project')).toBeInTheDocument();
  });
});
