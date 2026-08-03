import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CanvasProjectControls } from '../../../components/canvas/CanvasProjectControls';

interface MockProjectPickerMenuProps {
  currentProjectName: string;
  currentProjectId?: number;
  activeProjectId?: number;
  openProjectIds?: number[];
  disabled?: boolean;
  onSelectProject: (project: { id: number; name: string; role?: string }) => void;
}

const mockProjectPickerMenu = jest.fn();

jest.mock('../../../components/canvas/ProjectPickerMenu', () => {
  const { createElement } = require('react');
  return {
    ProjectPickerMenu: (props: MockProjectPickerMenuProps) => {
      mockProjectPickerMenu(props);
      return createElement(
        'button',
        {
          type: 'button',
          disabled: props.disabled,
          onClick: () => props.onSelectProject({
            id: 7,
            name: 'Selected project',
            role: 'VIEWER',
          }),
        },
        'Project picker',
      );
    },
  };
});

const createProps = () => ({
  projectName: 'Current project',
  projectId: 3,
  openProjectIds: [3, 5],
  editingName: false,
  nameInput: 'Current project',
  savingName: false,
  onBack: jest.fn(),
  onRefresh: jest.fn(),
  onSelectProject: jest.fn(),
  onStartRename: jest.fn(),
  onNameInputChange: jest.fn(),
  onConfirmRename: jest.fn(),
  onCancelRename: jest.fn(),
  loading: false,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CanvasProjectControls', () => {
  it('forwards back and refresh actions', () => {
    const props = createProps();
    render(<CanvasProjectControls {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back to overview' }));
    fireEvent.click(screen.getByTitle('Reload'));

    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onRefresh).toHaveBeenCalledTimes(1);
  });

  it('forwards the selected project id, name, and access role', () => {
    const props = createProps();
    render(<CanvasProjectControls {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Project picker' }));

    expect(props.onSelectProject).toHaveBeenCalledWith(7, 'Selected project', 'VIEWER');
    expect(mockProjectPickerMenu).toHaveBeenCalledWith(expect.objectContaining({
      currentProjectId: 3,
      activeProjectId: 3,
      openProjectIds: [3, 5],
      currentProjectName: 'Current project',
    }));
  });

  it('forwards name changes and keyboard rename actions', () => {
    const props = { ...createProps(), editingName: true };
    render(<CanvasProjectControls {...props} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'Renamed project' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(props.onNameInputChange).toHaveBeenCalledWith('Renamed project');
    expect(props.onConfirmRename).toHaveBeenCalledTimes(1);
    expect(props.onCancelRename).toHaveBeenCalledTimes(1);
  });

  it('forwards save and cancel controls while editing', () => {
    const props = { ...createProps(), editingName: true };
    render(<CanvasProjectControls {...props} />);

    fireEvent.click(screen.getByTitle('Save'));
    fireEvent.click(screen.getByTitle('Cancel'));

    expect(props.onConfirmRename).toHaveBeenCalledTimes(1);
    expect(props.onCancelRename).toHaveBeenCalledTimes(1);
  });

  it('hides rename and preserves the shared-by indicator for view-only access', () => {
    render(
      <CanvasProjectControls
        {...createProps()}
        readOnly
        sharedByLabel="Ada Lovelace"
      />,
    );

    expect(screen.queryByTitle('Edit project name')).not.toBeInTheDocument();
    expect(screen.getByText('Shared by Ada Lovelace')).toHaveAttribute(
      'title',
      'View-only access — shared by Ada Lovelace',
    );
    expect(screen.getByTitle('Reload latest changes from owner')).toBeInTheDocument();
  });

  it('disables the project picker while loading', () => {
    render(<CanvasProjectControls {...createProps()} loading />);

    expect(screen.getByRole('button', { name: 'Project picker' })).toBeDisabled();
  });

  it('disables the rename input while saving', () => {
    render(<CanvasProjectControls {...createProps()} editingName savingName />);

    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
