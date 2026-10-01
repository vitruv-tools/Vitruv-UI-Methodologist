import { fireEvent, render, screen } from '@testing-library/react';
import { ClassEditPanel } from '../../../components/canvas/UMLDiagramEditPanels';
import type { UmlDiagramClass } from '../../../components/canvas/umlDiagramTypes';

const makeClass = (name: string): UmlDiagramClass => ({
  id: name,
  name,
  isAbstract: false,
  isInterface: false,
  attributes: [],
  operations: [],
  x: 0,
  y: 0,
});

function renderPanel(cls: UmlDiagramClass, onUpdate = jest.fn()) {
  const props = {
    classes: [cls],
    parentId: null,
    onUpdate,
    onSetParent: jest.fn(),
    onDelete: jest.fn(),
    onClose: jest.fn(),
  };
  const view = render(<ClassEditPanel cls={cls} {...props} />);
  return {
    onUpdate,
    rerenderWith: (next: UmlDiagramClass) => view.rerender(<ClassEditPanel cls={next} {...props} />),
    input: () => screen.getByLabelText('Class name') as HTMLInputElement,
  };
}

describe('ClassEditPanel class name input', () => {
  it('lets the whole name be cleared without committing an empty name', () => {
    const { input, onUpdate } = renderPanel(makeClass('Address'));

    fireEvent.change(input(), { target: { value: '' } });

    expect(input().value).toBe('');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('restores the previous name when blurred while empty', () => {
    const { input, onUpdate } = renderPanel(makeClass('Address'));

    fireEvent.change(input(), { target: { value: '' } });
    fireEvent.blur(input());

    expect(input().value).toBe('Address');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('commits a single rename on blur instead of once per keystroke', () => {
    const { input, onUpdate } = renderPanel(makeClass('Address'));

    fireEvent.change(input(), { target: { value: 'A' } });
    fireEvent.change(input(), { target: { value: 'Ad' } });
    fireEvent.change(input(), { target: { value: 'Adr' } });
    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.blur(input());

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({ name: 'Adr' });
  });

  it('commits on Enter and trims surrounding whitespace', () => {
    const { input, onUpdate } = renderPanel(makeClass('Address'));

    fireEvent.change(input(), { target: { value: '  Street  ' } });
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(onUpdate).toHaveBeenCalledWith({ name: 'Street' });
  });

  it('reverts the draft on Escape', () => {
    const { input, onUpdate } = renderPanel(makeClass('Address'));

    fireEvent.change(input(), { target: { value: 'Street' } });
    fireEvent.keyDown(input(), { key: 'Escape' });

    expect(input().value).toBe('Address');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('does not commit when the name is unchanged', () => {
    const { input, onUpdate } = renderPanel(makeClass('Address'));

    fireEvent.blur(input());

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('follows the class name when it changes from outside (undo, other class)', () => {
    const { input, rerenderWith } = renderPanel(makeClass('Address'));

    fireEvent.change(input(), { target: { value: 'Half typed' } });
    rerenderWith(makeClass('Person'));

    expect(input().value).toBe('Person');
  });
});
