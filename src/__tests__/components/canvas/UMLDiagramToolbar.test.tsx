import { fireEvent, render, screen } from '@testing-library/react';
import {
  UMLDiagramToolbar,
  type UMLDiagramToolbarProps,
} from '../../../components/canvas/UMLDiagramToolbar';

function createProps(
  overrides: Partial<UMLDiagramToolbarProps> = {},
): UMLDiagramToolbarProps {
  return {
    reactionsMode: 'uml',
    connectMode: false,
    canUndo: true,
    canRedo: true,
    canDelete: true,
    showSave: true,
    hasUnsavedChanges: true,
    saving: false,
    saveButtonTitle: 'Save metamodel changes',
    onAddClass: jest.fn(),
    onUndo: jest.fn(),
    onRedo: jest.fn(),
    onToggleConnect: jest.fn(),
    onDelete: jest.fn(),
    onSave: jest.fn(),
    ...overrides,
  };
}

describe('UMLDiagramToolbar', () => {
  it('renders controls in order with existing labels and titles and forwards clicks', () => {
    const props = createProps();

    render(<UMLDiagramToolbar {...props} />);

    expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual([
      'Class',
      'Undo',
      'Redo',
      'Connect',
      'Delete',
      'Save',
    ]);

    const addButton = screen.getByRole('button', { name: 'Class' });
    const undoButton = screen.getByRole('button', { name: 'Undo' });
    const redoButton = screen.getByRole('button', { name: 'Redo' });
    const connectButton = screen.getByRole('button', { name: 'Connect' });
    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    const saveButton = screen.getByRole('button', { name: 'Save' });

    expect(addButton).toHaveAttribute('title', 'Add class');
    expect(undoButton).toHaveAttribute('title', 'Undo (Ctrl+Z)');
    expect(redoButton).toHaveAttribute('title', 'Redo (Ctrl+Shift+Z)');
    expect(connectButton).toHaveAttribute('title', 'Connect two classes in the same model');
    expect(deleteButton).toHaveAttribute('title', 'Delete selected class or connection');
    expect(saveButton).toHaveAttribute('title', 'Save metamodel changes');

    fireEvent.click(addButton);
    fireEvent.click(undoButton);
    fireEvent.click(redoButton);
    fireEvent.click(connectButton);
    fireEvent.click(deleteButton);
    fireEvent.click(saveButton);

    expect(props.onAddClass).toHaveBeenCalledTimes(1);
    expect(props.onUndo).toHaveBeenCalledTimes(1);
    expect(props.onRedo).toHaveBeenCalledTimes(1);
    expect(props.onToggleConnect).toHaveBeenCalledTimes(1);
    expect(props.onDelete).toHaveBeenCalledTimes(1);
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it('hides Connect in reactions mode', () => {
    render(
      <UMLDiagramToolbar
        {...createProps({ reactionsMode: 'reactions' })}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();
  });

  it('does not invoke disabled undo, redo, or delete callbacks', () => {
    const props = createProps({
      canUndo: false,
      canRedo: false,
      canDelete: false,
    });

    render(<UMLDiagramToolbar {...props} />);

    const undoButton = screen.getByRole('button', { name: 'Undo' });
    const redoButton = screen.getByRole('button', { name: 'Redo' });
    const deleteButton = screen.getByRole('button', { name: 'Delete' });

    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();

    fireEvent.click(undoButton);
    fireEvent.click(redoButton);
    fireEvent.click(deleteButton);

    expect(props.onUndo).not.toHaveBeenCalled();
    expect(props.onRedo).not.toHaveBeenCalled();
    expect(props.onDelete).not.toHaveBeenCalled();
  });

  it('presents active connect state and forwards the toggle callback', () => {
    const onToggleConnect = jest.fn();

    render(
      <UMLDiagramToolbar
        {...createProps({ connectMode: true, onToggleConnect })}
      />,
    );

    const connectButton = screen.getByRole('button', { name: 'Connect' });
    expect(connectButton).toHaveAttribute('title', 'Cancel connect mode (Esc)');
    expect(connectButton).toHaveStyle({
      background: '#ecfdf5',
      border: '1px solid #049484',
      color: '#049484',
    });

    fireEvent.click(connectButton);

    expect(onToggleConnect).toHaveBeenCalledTimes(1);
  });

  it('preserves save visibility, disabled, active, and saving behavior', () => {
    const onSave = jest.fn();
    const props = createProps({
      showSave: false,
      hasUnsavedChanges: false,
      saveButtonTitle: 'No unsaved changes',
      onSave,
    });
    const { rerender } = render(<UMLDiagramToolbar {...props} />);

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    rerender(<UMLDiagramToolbar {...props} showSave />);
    const disabledSaveButton = screen.getByRole('button', { name: 'Save' });
    expect(disabledSaveButton).toBeDisabled();
    expect(disabledSaveButton).toHaveAttribute('title', 'No unsaved changes');
    fireEvent.click(disabledSaveButton);
    expect(onSave).not.toHaveBeenCalled();

    rerender(
      <UMLDiagramToolbar
        {...props}
        showSave
        hasUnsavedChanges
        saveButtonTitle="Save changes to project"
      />,
    );
    const activeSaveButton = screen.getByRole('button', { name: 'Save' });
    expect(activeSaveButton).toBeEnabled();
    expect(activeSaveButton).toHaveAttribute('title', 'Save changes to project');
    expect(activeSaveButton).toHaveStyle({
      background: '#ecfdf5',
      border: '1px solid #049484',
      color: '#049484',
    });
    fireEvent.click(activeSaveButton);
    expect(onSave).toHaveBeenCalledTimes(1);

    rerender(
      <UMLDiagramToolbar
        {...props}
        showSave
        hasUnsavedChanges
        saving
        saveButtonTitle="Save changes to project"
      />,
    );
    const savingButton = screen.getByRole('button', { name: '… Save' });
    expect(savingButton).toBeDisabled();
    expect(savingButton).toHaveTextContent('…Save');
    fireEvent.click(savingButton);
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
