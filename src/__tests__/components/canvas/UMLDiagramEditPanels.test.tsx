import { fireEvent, render, screen } from '@testing-library/react';
import {
  ClassEditPanel,
  RelationshipEditPanel,
  type ClassEditPanelProps,
  type RelationshipEditPanelProps,
} from '../../../components/canvas/UMLDiagramEditPanels';
import type { UmlDiagramClass } from '../../../components/canvas/umlDiagramTypes';
import type { UMLRelationship } from '../../../utils/ecoreToUml';

const classes: UmlDiagramClass[] = [
  {
    id: 'employee',
    name: 'Employee',
    isAbstract: false,
    isInterface: false,
    attributes: [],
    operations: [],
    x: 10,
    y: 20,
  },
  {
    id: 'department',
    name: 'Department',
    isAbstract: false,
    isInterface: false,
    attributes: [],
    operations: [],
    x: 260,
    y: 20,
  },
  {
    id: 'company',
    name: 'Company',
    isAbstract: false,
    isInterface: false,
    attributes: [],
    operations: [],
    x: 510,
    y: 20,
  },
];

const association: UMLRelationship = {
  id: 'employee-department',
  sourceId: 'employee',
  targetId: 'department',
  type: 'association',
  label: 'assignedTo',
  sourceMultiplicity: '0..*',
  targetMultiplicity: '1',
};

function createClassPanelProps(
  overrides: Partial<ClassEditPanelProps> = {},
): ClassEditPanelProps {
  return {
    cls: classes[0],
    classes,
    parentId: 'department',
    onUpdate: jest.fn(),
    onSetParent: jest.fn(),
    onDelete: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
}

function createRelationshipPanelProps(
  overrides: Partial<RelationshipEditPanelProps> = {},
): RelationshipEditPanelProps {
  return {
    rel: association,
    classes,
    onUpdate: jest.fn(),
    onSwapEndpoints: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
}

describe('UMLDiagramEditPanels', () => {
  it('renders the class controls and forwards update, parent, delete, and close actions', () => {
    const props = createClassPanelProps();

    render(<ClassEditPanel {...props} />);

    const dialog = screen.getByRole('dialog', { name: 'Edit class Employee' });
    expect(dialog).toHaveAttribute('data-class-edit-panel', 'true');
    expect(screen.getByLabelText('Class name')).toHaveValue('Employee');
    expect(screen.getByLabelText('Abstract class')).not.toBeChecked();
    expect(screen.getByLabelText('Interface')).not.toBeChecked();
    expect(screen.getByLabelText('Superclass (inheritance)')).toHaveValue('department');

    fireEvent.change(screen.getByLabelText('Class name'), { target: { value: 'Manager' } });
    fireEvent.click(screen.getByLabelText('Abstract class'));
    fireEvent.click(screen.getByLabelText('Interface'));
    fireEvent.change(screen.getByLabelText('Superclass (inheritance)'), {
      target: { value: 'company' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete class' }));
    fireEvent.click(screen.getByTitle('Close panel'));

    expect(props.onUpdate).toHaveBeenNthCalledWith(1, { name: 'Manager' });
    expect(props.onUpdate).toHaveBeenNthCalledWith(2, { isAbstract: true });
    expect(props.onUpdate).toHaveBeenNthCalledWith(3, { isInterface: true });
    expect(props.onSetParent).toHaveBeenCalledWith('company');
    expect(props.onDelete).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('renders relationship controls and forwards endpoint, label, type, multiplicity, swap, and close actions', () => {
    const props = createRelationshipPanelProps();

    render(<RelationshipEditPanel {...props} />);

    const dialog = screen.getByRole('dialog', {
      name: 'Edit association connection: assignedTo',
    });
    expect(dialog).toHaveAttribute('data-rel-edit-panel', 'true');
    expect(screen.getByLabelText('From class')).toHaveValue('employee');
    expect(screen.getByLabelText('To class')).toHaveValue('department');
    expect(screen.getByLabelText('Connection name')).toHaveValue('assignedTo');
    expect(screen.getByLabelText('Type')).toHaveValue('association');
    expect(screen.getByLabelText('Source multiplicity')).toHaveValue('0..*');
    expect(screen.getByLabelText('Target multiplicity')).toHaveValue('1');

    fireEvent.change(screen.getByLabelText('From class'), { target: { value: 'company' } });
    fireEvent.change(screen.getByLabelText('To class'), { target: { value: 'company' } });
    fireEvent.change(screen.getByLabelText('Connection name'), { target: { value: 'contains' } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'composition' } });
    fireEvent.change(screen.getByLabelText('Source multiplicity'), { target: { value: '1..*' } });
    fireEvent.change(screen.getByLabelText('Target multiplicity'), { target: { value: '0..1' } });
    fireEvent.click(screen.getByTitle('Swap direction'));
    fireEvent.click(screen.getByTitle('Close panel'));

    expect(props.onUpdate).toHaveBeenNthCalledWith(1, { sourceId: 'company' });
    expect(props.onUpdate).toHaveBeenNthCalledWith(2, { targetId: 'company' });
    expect(props.onUpdate).toHaveBeenNthCalledWith(3, { label: 'contains' });
    expect(props.onUpdate).toHaveBeenNthCalledWith(4, { type: 'composition' });
    expect(props.onUpdate).toHaveBeenNthCalledWith(5, { sourceMultiplicity: '1..*' });
    expect(props.onUpdate).toHaveBeenNthCalledWith(6, { targetMultiplicity: '0..1' });
    expect(props.onSwapEndpoints).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('hides multiplicity controls for inheritance relationships', () => {
    render(
      <RelationshipEditPanel
        {...createRelationshipPanelProps({
          rel: {
            ...association,
            type: 'inheritance',
            label: undefined,
          },
        })}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Edit inheritance connection' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Source multiplicity')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Target multiplicity')).not.toBeInTheDocument();
  });

  it('focuses each dialog when it opens', () => {
    const focusSpy = jest.spyOn(HTMLElement.prototype, 'focus');
    const view = render(<ClassEditPanel {...createClassPanelProps()} />);
    const classDialog = screen.getByRole('dialog');

    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(focusSpy.mock.instances[0]).toBe(classDialog);

    view.unmount();
    render(<RelationshipEditPanel {...createRelationshipPanelProps()} />);
    const relationshipDialog = screen.getByRole('dialog');

    expect(focusSpy).toHaveBeenCalledTimes(2);
    expect(focusSpy.mock.instances[1]).toBe(relationshipDialog);

    focusSpy.mockRestore();
  });

  it('closes each panel with Escape', () => {
    const classClose = jest.fn();
    const view = render(
      <ClassEditPanel {...createClassPanelProps({ onClose: classClose })} />,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(classClose).toHaveBeenCalledTimes(1);

    view.unmount();

    const relationshipClose = jest.fn();
    render(
      <RelationshipEditPanel
        {...createRelationshipPanelProps({ onClose: relationshipClose })}
      />,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(relationshipClose).toHaveBeenCalledTimes(1);
  });

  it('prevents panel interaction events from bubbling to canvas handlers', () => {
    const onClick = jest.fn();
    const onMouseDown = jest.fn();
    const onKeyDown = jest.fn();
    const onKeyUp = jest.fn();

    render(
      <div
        onClick={onClick}
        onMouseDown={onMouseDown}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      >
        <ClassEditPanel {...createClassPanelProps()} />
      </div>,
    );

    const classNameInput = screen.getByLabelText('Class name');
    fireEvent.click(classNameInput);
    fireEvent.mouseDown(classNameInput);
    fireEvent.keyDown(classNameInput, { key: 'A' });
    fireEvent.keyUp(classNameInput, { key: 'A' });

    expect(onClick).not.toHaveBeenCalled();
    expect(onMouseDown).not.toHaveBeenCalled();
    expect(onKeyDown).not.toHaveBeenCalled();
    expect(onKeyUp).not.toHaveBeenCalled();
  });
});
