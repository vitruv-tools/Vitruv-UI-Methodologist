import { fireEvent, render, screen } from '@testing-library/react';
import {
  UMLClassBox,
  type UMLClassBoxProps,
} from '../../../components/canvas/UMLClassBox';
import type {
  UmlDiagramClass,
  UmlDiagramEditState,
} from '../../../components/canvas/umlDiagramTypes';

const umlClass: UmlDiagramClass = {
  id: 'employee',
  name: 'Employee',
  isAbstract: false,
  isInterface: false,
  attributes: [
    {
      id: 'employee-name',
      name: 'name',
      type: 'EString',
      visibility: '-',
    },
  ],
  operations: [
    {
      id: 'employee-calculate',
      name: 'calculate',
      returnType: 'EVoid',
      visibility: '+',
    },
  ],
  x: 100,
  y: 200,
};

function createProps(
  overrides: Partial<UMLClassBoxProps> = {},
): UMLClassBoxProps {
  return {
    cls: umlClass,
    offsetX: 20,
    offsetY: 30,
    scale: 1,
    selected: false,
    connectSource: false,
    interactive: true,
    edit: null,
    reactionsMode: false,
    onReactionPortMouseDown: jest.fn(),
    onSelect: jest.fn(),
    onMove: jest.fn(),
    onDragStart: jest.fn(),
    onDragEnd: jest.fn(),
    onStartEditName: jest.fn(),
    onSaveName: jest.fn(),
    onStartEditAttr: jest.fn(),
    onSaveAttr: jest.fn(),
    onCancelEdit: jest.fn(),
    onAddAttr: jest.fn(),
    onDeleteAttr: jest.fn(),
    onStartEditOp: jest.fn(),
    onSaveOp: jest.fn(),
    onAddOp: jest.fn(),
    onDeleteOp: jest.fn(),
    onDelete: jest.fn(),
    onEditChange: jest.fn(),
    ...overrides,
  };
}

describe('UMLClassBox', () => {
  it('renders the class name and extracted member rows', () => {
    render(<UMLClassBox {...createProps()} />);

    expect(screen.getByRole('group', {
      name: 'UML class Employee',
    })).toHaveAttribute('data-classbox');
    expect(screen.getByRole('button', {
      name: 'Class name: Employee. Press Enter to select.',
    })).toHaveTextContent('Employee');
    expect(screen.getByRole('button', {
      name: 'Attribute name: String. Press Enter to edit.',
    })).toHaveTextContent('-name:String');
    expect(screen.getByRole('button', {
      name: 'Operation calculate: Void. Press Enter to edit.',
    })).toHaveTextContent('+calculate():Void');
  });

  it('forwards mouse and keyboard selection with unchanged accessibility state', () => {
    const props = createProps();
    render(<UMLClassBox {...props} />);

    const classBox = screen.getByRole('group', {
      name: 'UML class Employee',
    });
    expect(classBox).toHaveAttribute('aria-selected', 'false');
    expect(classBox).toHaveAttribute('tabindex', '0');

    fireEvent.click(classBox);
    fireEvent.keyDown(classBox, { key: 'Enter' });
    fireEvent.keyDown(classBox, { key: ' ' });

    expect(props.onSelect).toHaveBeenCalledTimes(3);
  });

  it('forwards scaled drag coordinates and suppresses the click after dragging', () => {
    const props = createProps({ scale: 2 });
    render(<UMLClassBox {...props} />);

    const classBox = screen.getByRole('group', {
      name: 'UML class Employee',
    });
    fireEvent.mouseDown(classBox, { clientX: 10, clientY: 20 });
    fireEvent.mouseMove(window, { clientX: 20, clientY: 30 });
    fireEvent.mouseUp(window);
    fireEvent.click(classBox);

    expect(props.onDragStart).toHaveBeenCalledTimes(1);
    expect(props.onMove).toHaveBeenCalledWith('employee', 105, 205);
    expect(props.onDragEnd).toHaveBeenCalledTimes(1);
    expect(props.onSelect).not.toHaveBeenCalled();

    fireEvent.click(classBox);
    expect(props.onSelect).toHaveBeenCalledTimes(1);
  });

  it('removes active drag listeners when unmounted', () => {
    const removeEventListener = jest.spyOn(globalThis, 'removeEventListener');
    const view = render(<UMLClassBox {...createProps()} />);

    fireEvent.mouseDown(screen.getByRole('group', {
      name: 'UML class Employee',
    }), { clientX: 10, clientY: 20 });
    view.unmount();

    expect(removeEventListener).toHaveBeenCalledWith(
      'mousemove',
      expect.any(Function),
    );
    expect(removeEventListener).toHaveBeenCalledWith(
      'mouseup',
      expect.any(Function),
    );
    removeEventListener.mockRestore();
  });

  it('preserves class-name editing callbacks for double-click, change, Enter, Escape, and blur', () => {
    const props = createProps({ selected: true });
    const view = render(<UMLClassBox {...props} />);

    fireEvent.doubleClick(screen.getByRole('button', {
      name: 'Class name: Employee. Press Enter to edit.',
    }));
    expect(props.onStartEditName).toHaveBeenCalledTimes(1);

    const nameEdit: UmlDiagramEditState = {
      classId: umlClass.id,
      kind: 'name',
      val: 'RenamedEmployee',
    };
    view.rerender(<UMLClassBox {...props} edit={nameEdit} />);

    const input = screen.getByRole('textbox', {
      name: 'Class name for Employee',
    });
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: 'ChangedEmployee' } });
    expect(props.onEditChange).toHaveBeenCalledWith({
      ...nameEdit,
      val: 'ChangedEmployee',
    });

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onSaveName).toHaveBeenCalledWith('RenamedEmployee');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(props.onCancelEdit).toHaveBeenCalledTimes(1);

    fireEvent.blur(input);
    expect(props.onSaveName).toHaveBeenCalledTimes(2);
  });

  it('shows the delete control only when editable and selected', () => {
    const props = createProps();
    const view = render(<UMLClassBox {...props} />);

    expect(screen.queryByRole('button', {
      name: 'Delete class Employee',
    })).not.toBeInTheDocument();

    view.rerender(<UMLClassBox {...props} selected />);
    const deleteButton = screen.getByRole('button', {
      name: 'Delete class Employee',
    });
    expect(deleteButton).toHaveAttribute('data-no-drag');
    fireEvent.click(deleteButton);
    expect(props.onDelete).toHaveBeenCalledTimes(1);

    view.rerender(
      <UMLClassBox {...props} selected interactive={false} />,
    );
    expect(screen.queryByRole('button', {
      name: 'Delete class Employee',
    })).not.toBeInTheDocument();
  });

  it('preserves reaction-port attributes and forwards both port callbacks', () => {
    const props = createProps({ reactionsMode: true });
    render(<UMLClassBox {...props} />);

    const rightPort = screen.getByRole('button', {
      name: 'Right reaction port for Employee',
    });
    const leftPort = screen.getByRole('button', {
      name: 'Left reaction port for Employee',
    });

    expect(rightPort).toHaveAttribute('data-reaction-port');
    expect(rightPort).toHaveAttribute('data-class-id', 'employee');
    expect(rightPort).toHaveAttribute('data-port-side', 'right');
    expect(leftPort).toHaveAttribute('data-reaction-port');
    expect(leftPort).toHaveAttribute('data-class-id', 'employee');
    expect(leftPort).toHaveAttribute('data-port-side', 'left');

    fireEvent.mouseDown(rightPort);
    fireEvent.mouseDown(leftPort);

    expect(props.onReactionPortMouseDown).toHaveBeenNthCalledWith(
      1,
      expect.any(Object),
      'employee',
      'right',
    );
    expect(props.onReactionPortMouseDown).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      'employee',
      'left',
    );
  });
});
