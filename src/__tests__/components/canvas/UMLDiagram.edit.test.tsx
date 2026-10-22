/* eslint-disable import/first */

jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => require('../../../testSupport/umlDiagram/mockFactories').saveMetaModelEcoreMock());
jest.mock('../../../utils/umlValidation', () => require('../../../testSupport/umlDiagram/mockFactories').umlValidationMock());
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramMinimapMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());

import { createRef } from 'react';
import { screen, fireEvent, within } from '@testing-library/react';
import type { UMLDiagramHandle } from '../../../components/canvas/UMLDiagram';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

describe('UMLDiagram edit', () => {
  it('adds a class attribute and commits on canvas mouse down', () => {
    const { container } = renderDiagram();

    fireEvent.click(screen.getByText('Person'));
    fireEvent.click(screen.getAllByText('Add attribute')[0]);
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'age' } });
    fireEvent.mouseDown(container.firstChild as HTMLElement);

    expect(screen.getByText('age')).toBeInTheDocument();
  });

  it('adds a new class and deletes it from the toolbar', () => {
    renderDiagram();

    fireEvent.click(screen.getByTitle('Add class'));
    expect(screen.getByDisplayValue('NewClass')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Delete selected class or connection'));
    expect(screen.queryByText('NewClass')).not.toBeInTheDocument();
  });
});

describe('UMLDiagram attribute and operation edit rows', () => {
  const personBox = () => screen.getByRole('group', { name: /^UML class Person\b/ });

  /** Presses and releases the mouse on a field, like a real click. Returns false if mousedown was cancelled. */
  function clickField(field: HTMLElement): boolean {
    const notCancelled = fireEvent.mouseDown(field);
    fireEvent.click(field);
    return notCancelled;
  }

  it.each(['Add attribute', 'Add operation'])('lets the mouse open the dropdowns of a new row (%s)', label => {
    renderDiagram();
    fireEvent.click(screen.getByText('Person'));
    fireEvent.click(within(personBox()).getByText(label));

    const dropdowns = within(personBox()).getAllByRole('combobox');
    expect(dropdowns).toHaveLength(2);
    for (const dropdown of dropdowns) {
      expect(clickField(dropdown)).toBe(true);
    }
    fireEvent.change(dropdowns[0], { target: { value: '-' } });

    // Clicking the dropdowns and choosing a value did not close the edit row.
    expect(within(personBox()).getAllByRole('combobox')).toHaveLength(2);
  });

  it('keeps the edit row open while several fields are set, and saves them when the row is left', () => {
    const ref = createRef<UMLDiagramHandle>();
    renderDiagram({ ref });
    fireEvent.click(screen.getByText('Person'));
    fireEvent.click(within(personBox()).getByText('Add attribute'));

    const documentation = within(personBox()).getByRole('textbox', { name: /^Documentation for attribute/ });
    clickField(documentation);
    fireEvent.change(documentation, { target: { value: 'Age in years' } });
    const type = within(personBox()).getByTitle('Attribute type (primitive only)');
    clickField(type);
    fireEvent.change(type, { target: { value: 'Boolean' } });
    const visibility = within(personBox()).getByTitle('Visibility');
    clickField(visibility);
    fireEvent.change(visibility, { target: { value: '-' } });
    expect(within(personBox()).getAllByRole('combobox')).toHaveLength(2);

    // Clicking the canvas leaves the row and saves it.
    fireEvent.mouseDown(screen.getByRole('region', { name: 'UML diagram canvas' }));

    expect(within(personBox()).queryAllByRole('combobox')).toHaveLength(0);
    expect(ref.current!.getModel().classes[0].attributes.at(-1)).toEqual(expect.objectContaining({
      type: 'Boolean',
      visibility: '-',
      documentation: 'Age in years',
    }));
  });

  it('saves the row when the focus leaves a dropdown, e.g. with Tab or a toolbar button', () => {
    const ref = createRef<UMLDiagramHandle>();
    renderDiagram({ ref });
    fireEvent.click(screen.getByText('Person'));
    fireEvent.click(within(personBox()).getByText('Add attribute'));

    const type = within(personBox()).getByTitle('Attribute type (primitive only)');
    fireEvent.change(type, { target: { value: 'Double' } });
    fireEvent.blur(type);

    expect(within(personBox()).queryAllByRole('combobox')).toHaveLength(0);
    expect(ref.current!.getModel().classes[0].attributes.at(-1)).toEqual(expect.objectContaining({ type: 'Double' }));
  });

  it.each(['Add attribute', 'Add operation'])('opens the new row at once when %s is clicked while another row is open', label => {
    const ref = createRef<UMLDiagramHandle>();
    renderDiagram({ ref });
    fireEvent.click(screen.getByText('Person'));
    fireEvent.click(within(personBox()).getByRole('button', { name: 'Add attribute' }));
    expect(within(personBox()).getAllByRole('combobox')).toHaveLength(2);

    // Pressing the button keeps the open row (and the button) in place until the click.
    const add = within(personBox()).getByRole('button', { name: label });
    expect(fireEvent.mouseDown(add)).toBe(false);
    expect(within(personBox()).getAllByRole('combobox')).toHaveLength(2);
    fireEvent.click(add);

    const person = ref.current!.getModel().classes[0];
    const newMember = label === 'Add attribute' ? person.attributes.at(-1) : person.operations.at(-1);
    expect(person.attributes).toHaveLength(label === 'Add attribute' ? 3 : 2);
    expect(within(personBox()).getAllByRole('combobox')).toHaveLength(2);
    expect(within(personBox()).getByDisplayValue(newMember!.name)).toHaveFocus();
  });

  it('still selects the class when Add attribute is clicked', () => {
    renderDiagram();

    fireEvent.click(within(personBox()).getByRole('button', { name: 'Add attribute' }));

    expect(personBox()).toHaveAttribute('aria-selected', 'true');
    expect(within(personBox()).getAllByRole('combobox')).toHaveLength(2);
  });
});
