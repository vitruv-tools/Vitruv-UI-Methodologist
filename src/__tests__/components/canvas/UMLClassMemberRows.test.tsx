import { fireEvent, render, screen } from '@testing-library/react';
import {
  UmlAddAttributeRow,
  UmlAddOperationRow,
  UmlAttributeRow,
  UmlOperationRow,
  type UmlAttributeRowProps,
  type UmlOperationRowProps,
} from '../../../components/canvas/UMLClassMemberRows';
import type {
  UmlAttributeEditState,
  UmlOperationEditState,
} from '../../../components/canvas/umlDiagramTypes';

const attribute = {
  id: 'employee-name',
  name: 'name',
  type: 'EString',
  visibility: '-' as const,
};

const operation = {
  id: 'employee-calculate',
  name: 'calculate',
  returnType: 'EVoid',
  visibility: '#' as const,
};

const attributeEditing: UmlAttributeEditState = {
  classId: 'employee',
  kind: 'attr',
  attrId: attribute.id,
  name: attribute.name,
  type: attribute.type,
  visibility: attribute.visibility,
};

const operationEditing: UmlOperationEditState = {
  classId: 'employee',
  kind: 'op',
  opId: operation.id,
  name: operation.name,
  returnType: operation.returnType,
  visibility: operation.visibility,
};

function createAttributeRowProps(
  overrides: Partial<UmlAttributeRowProps> = {},
): UmlAttributeRowProps {
  return {
    attr: attribute,
    editing: null,
    hovered: false,
    onMouseEnter: jest.fn(),
    onMouseLeave: jest.fn(),
    onDoubleClick: jest.fn(),
    onSave: jest.fn(),
    onCancel: jest.fn(),
    onDelete: jest.fn(),
    onEditChange: jest.fn(),
    ...overrides,
  };
}

function createOperationRowProps(
  overrides: Partial<UmlOperationRowProps> = {},
): UmlOperationRowProps {
  return {
    op: operation,
    editing: null,
    hovered: false,
    onMouseEnter: jest.fn(),
    onMouseLeave: jest.fn(),
    onDoubleClick: jest.fn(),
    onSave: jest.fn(),
    onCancel: jest.fn(),
    onDelete: jest.fn(),
    onEditChange: jest.fn(),
    ...overrides,
  };
}

describe('UMLClassMemberRows', () => {
  it('renders attribute and operation display text with unchanged accessible labels', () => {
    render(
      <>
        <UmlAttributeRow {...createAttributeRowProps()} />
        <UmlOperationRow {...createOperationRowProps()} />
      </>,
    );

    const attributeButton = screen.getByRole('button', {
      name: 'Attribute name: String. Press Enter to edit.',
    });
    const operationButton = screen.getByRole('button', {
      name: 'Operation calculate: Void. Press Enter to edit.',
    });

    expect(attributeButton).toHaveTextContent('-name:String');
    expect(operationButton).toHaveTextContent('#calculate():Void');
  });

  it('forwards double-click and keyboard-triggered edit actions', () => {
    const attributeProps = createAttributeRowProps();
    const operationProps = createOperationRowProps();

    render(
      <>
        <UmlAttributeRow {...attributeProps} />
        <UmlOperationRow {...operationProps} />
      </>,
    );

    const attributeButton = screen.getByRole('button', {
      name: 'Attribute name: String. Press Enter to edit.',
    });
    const operationButton = screen.getByRole('button', {
      name: 'Operation calculate: Void. Press Enter to edit.',
    });

    fireEvent.doubleClick(attributeButton);
    fireEvent.keyDown(attributeButton, { key: 'Enter' });
    fireEvent.doubleClick(operationButton);
    fireEvent.keyDown(operationButton, { key: 'F2' });

    expect(attributeProps.onDoubleClick).toHaveBeenCalledTimes(2);
    expect(operationProps.onDoubleClick).toHaveBeenCalledTimes(2);
  });

  it('renders attribute edit controls and preserves change, blur, Enter, and Escape behavior', () => {
    const props = createAttributeRowProps({ editing: attributeEditing, expanded: true });

    render(<UmlAttributeRow {...props} />);

    const input = screen.getByRole('textbox');
    const visibilitySelect = screen.getByTitle('Visibility');
    const typeSelect = screen.getByTitle('Attribute type (primitive only)');

    expect(input).toHaveValue('name');
    expect(input).toHaveFocus();
    expect(visibilitySelect).toHaveValue('-');
    expect(typeSelect).toHaveValue('String');

    fireEvent.change(input, { target: { value: 'title' } });
    expect(props.onEditChange).toHaveBeenCalledWith('title', 'EString', '-');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onSave).toHaveBeenCalledWith('name', 'EString', '-');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(props.onCancel).toHaveBeenCalledTimes(1);

    fireEvent.blur(input, { target: { value: 'title' } });
    expect(props.onSave).toHaveBeenCalledWith('title', 'EString', '-');
  });

  it('forwards attribute visibility and type changes before saving', () => {
    const props = createAttributeRowProps({ editing: attributeEditing });

    render(<UmlAttributeRow {...props} />);

    const visibilitySelect = screen.getByTitle('Visibility');
    const typeSelect = screen.getByTitle('Attribute type (primitive only)');
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });

    visibilitySelect.dispatchEvent(mouseDownEvent);
    expect(mouseDownEvent.defaultPrevented).toBe(true);

    fireEvent.change(visibilitySelect, { target: { value: '#' } });
    expect(props.onEditChange).toHaveBeenCalledWith('name', 'EString', '#');
    expect(props.onSave).toHaveBeenCalledWith('name', 'EString', '#');
    expect((props.onEditChange as jest.Mock).mock.invocationCallOrder[0])
      .toBeLessThan((props.onSave as jest.Mock).mock.invocationCallOrder[0]);

    fireEvent.change(typeSelect, { target: { value: 'Int' } });
    expect(props.onEditChange).toHaveBeenCalledWith('name', 'Int', '-');
    expect(props.onSave).toHaveBeenCalledWith('name', 'Int', '-');
  });

  it('renders operation edit controls and preserves keyboard, blur, visibility, and return-type behavior', () => {
    const props = createOperationRowProps({ editing: operationEditing, expanded: true });

    render(<UmlOperationRow {...props} />);

    const input = screen.getByRole('textbox');
    const [visibilitySelect, returnTypeSelect] = screen.getAllByRole('combobox');

    expect(input).toHaveValue('calculate');
    expect(input).toHaveFocus();
    expect(visibilitySelect).toHaveValue('#');
    expect(returnTypeSelect).toHaveValue('String');

    fireEvent.change(input, { target: { value: 'compute' } });
    expect(props.onEditChange).toHaveBeenCalledWith('compute', 'EVoid', '#');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onSave).toHaveBeenCalledWith('calculate', 'EVoid', '#');

    fireEvent.keyDown(returnTypeSelect, { key: 'Escape' });
    expect(props.onCancel).toHaveBeenCalledTimes(1);

    fireEvent.blur(input, { target: { value: 'compute' } });
    expect(props.onSave).toHaveBeenCalledWith('compute', 'EVoid', '#');

    fireEvent.change(visibilitySelect, { target: { value: '+' } });
    expect(props.onEditChange).toHaveBeenCalledWith('compute', 'EVoid', '+');
    expect(props.onSave).toHaveBeenCalledWith('compute', 'EVoid', '+');

    fireEvent.change(returnTypeSelect, { target: { value: 'Int' } });
    expect(props.onEditChange).toHaveBeenCalledWith('compute', 'Int', '#');
    expect(props.onSave).toHaveBeenCalledWith('compute', 'Int', '#');
  });

  it('renders delete controls only when requested and forwards delete actions', () => {
    const attributeProps = createAttributeRowProps();
    const operationProps = createOperationRowProps();
    const view = render(
      <>
        <UmlAttributeRow {...attributeProps} />
        <UmlOperationRow {...operationProps} />
      </>,
    );

    expect(screen.queryByRole('button', { name: 'Delete attribute' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete operation' })).not.toBeInTheDocument();

    view.rerender(
      <>
        <UmlAttributeRow {...attributeProps} showDelete />
        <UmlOperationRow {...operationProps} showDelete />
      </>,
    );

    const deleteAttribute = screen.getByRole('button', { name: 'Delete attribute' });
    const deleteOperation = screen.getByRole('button', { name: 'Delete operation' });
    expect(deleteAttribute).toHaveAttribute('data-no-drag');
    expect(deleteOperation).toHaveAttribute('data-no-drag');

    fireEvent.click(deleteAttribute);
    fireEvent.click(deleteOperation);

    expect(attributeProps.onDelete).toHaveBeenCalledTimes(1);
    expect(operationProps.onDelete).toHaveBeenCalledTimes(1);
  });

  it('renders add rows with drag guards, hover behavior, and forwarded callbacks', () => {
    const onAddAttribute = jest.fn();
    const onAddOperation = jest.fn();

    render(
      <>
        <UmlAddAttributeRow onClick={onAddAttribute} />
        <UmlAddOperationRow onClick={onAddOperation} />
      </>,
    );

    const addAttribute = screen.getByRole('button', { name: 'Add attribute' });
    const addOperation = screen.getByRole('button', { name: 'Add operation' });
    expect(addAttribute).toHaveAttribute('data-no-drag');
    expect(addOperation).toHaveAttribute('data-no-drag');
    expect(addAttribute).toHaveStyle({ color: '#64748b' });

    fireEvent.mouseEnter(addAttribute);
    expect(addAttribute).toHaveStyle({ color: '#049484' });
    fireEvent.mouseLeave(addAttribute);
    expect(addAttribute).toHaveStyle({ color: '#64748b' });

    fireEvent.click(addAttribute);
    fireEvent.click(addOperation);

    expect(onAddAttribute).toHaveBeenCalledTimes(1);
    expect(onAddOperation).toHaveBeenCalledTimes(1);
  });
});
