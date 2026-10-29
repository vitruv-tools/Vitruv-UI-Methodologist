import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { CanvasProjectControls } from '../../../components/canvas/CanvasProjectControls';

interface MockProjectPickerMenuProps {
  currentProjectName: string;
  currentProjectId?: number;
  activeProjectId?: number;
  openProjectIds?: number[];
  disabled?: boolean;
  onSelectProject: (project: { id: number; name: string; role?: string }) => void;
}

const mockProjectPickerMenu = vi.fn();

vi.mock('../../../components/canvas/ProjectPickerMenu', async () => {
  const { createElement } = (await import('react'));
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
  onBack: vi.fn(),
  onRefresh: vi.fn(),
  onSelectProject: vi.fn(),
  onStartRename: vi.fn(),
  onNameInputChange: vi.fn(),
  onConfirmRename: vi.fn(),
  onCancelRename: vi.fn(),
  loading: false,
});

beforeEach(() => {
  vi.clearAllMocks();
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

  const renderWithLineStyle = (overrides: Partial<React.ComponentProps<typeof CanvasProjectControls>> = {}) => {
    const props = {
      ...createProps(),
      onToggleReactionMode: vi.fn(),
      reactionLineStyle: 'dashed' as const,
      onReactionLineStyleChange: vi.fn(),
      ...overrides,
    };
    render(<CanvasProjectControls {...props} />);
    return props;
  };

  it('shows the line-style dropdown when hovering VSUM without entering Reactions mode', () => {
    const props = renderWithLineStyle();
    const vsum = screen.getByRole('button', { name: 'VSUM' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(vsum).toHaveAttribute('aria-expanded', 'false');

    fireEvent.mouseEnter(vsum);

    expect(screen.getByRole('menu', { name: 'Reaction arrow style' })).toBeInTheDocument();
    expect(vsum).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Dashed' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Solid' })).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Solid' }));

    expect(props.onReactionLineStyleChange).toHaveBeenCalledWith('solid');
    expect(props.onToggleReactionMode).not.toHaveBeenCalled();
  });

  it('marks the current line style as selected', () => {
    renderWithLineStyle({ reactionLineStyle: 'solid' });
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'VSUM' }));

    expect(screen.getByRole('menuitemradio', { name: 'Solid' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Dashed' })).toHaveAttribute('aria-checked', 'false');
  });

  it('closes the dropdown when the pointer leaves the VSUM area', () => {
    renderWithLineStyle();
    const vsum = screen.getByRole('button', { name: 'VSUM' });

    fireEvent.mouseEnter(vsum);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.mouseLeave(vsum);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('supports keyboard navigation and Escape to close', () => {
    const props = renderWithLineStyle();
    const vsum = screen.getByRole('button', { name: 'VSUM' });
    vsum.focus();

    fireEvent.keyDown(vsum, { key: 'ArrowDown' });
    const dashed = screen.getByRole('menuitemradio', { name: 'Dashed' });
    const solid = screen.getByRole('menuitemradio', { name: 'Solid' });
    expect(dashed).toHaveFocus();

    fireEvent.keyDown(dashed, { key: 'ArrowDown' });
    expect(solid).toHaveFocus();
    fireEvent.keyDown(solid, { key: 'ArrowDown' });
    expect(dashed).toHaveFocus();
    fireEvent.keyDown(dashed, { key: 'ArrowUp' });
    expect(solid).toHaveFocus();

    fireEvent.click(solid);
    expect(props.onReactionLineStyleChange).toHaveBeenCalledWith('solid');

    fireEvent.keyDown(solid, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(vsum).toHaveFocus();
  });

  it('keeps the dropdown open while the pointer moves from VSUM into the menu', () => {
    renderWithLineStyle();
    const vsum = screen.getByRole('button', { name: 'VSUM' });

    fireEvent.mouseOver(vsum);
    const solid = screen.getByRole('menuitemradio', { name: 'Solid' });
    fireEvent.mouseOut(vsum, { relatedTarget: solid });
    fireEvent.mouseOver(solid, { relatedTarget: vsum });

    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.mouseOut(solid, { relatedTarget: document.body });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it.each(['Enter', ' '])('opens the dropdown with %j when VSUM mode is active', (key) => {
    const props = renderWithLineStyle();
    const vsum = screen.getByRole('button', { name: 'VSUM' });
    vsum.focus();

    fireEvent.keyDown(vsum, { key });

    expect(screen.getByRole('menuitemradio', { name: 'Dashed' })).toHaveFocus();
    expect(props.onToggleReactionMode).not.toHaveBeenCalled();
  });

  it('keeps Enter on VSUM as a mode switch while Reactions mode is active', () => {
    renderWithLineStyle({ addReactionMode: true });
    const vsum = screen.getByRole('button', { name: 'VSUM' });
    vsum.focus();

    fireEvent.keyDown(vsum, { key: 'Enter' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(vsum).toHaveFocus();
  });

  it('returns focus to VSUM when the pointer leaves while a menu item is focused', () => {
    renderWithLineStyle();
    const vsum = screen.getByRole('button', { name: 'VSUM' });
    fireEvent.mouseEnter(vsum);
    const solid = screen.getByRole('menuitemradio', { name: 'Solid' });
    act(() => solid.focus());

    fireEvent.mouseLeave(solid);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(vsum).toHaveFocus();
  });

  it('leaves focus alone when the pointer leaves without focus in the menu', () => {
    renderWithLineStyle();
    const reactions = screen.getByRole('button', { name: 'Reactions' });
    reactions.focus();

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'VSUM' }));
    fireEvent.mouseLeave(screen.getByRole('button', { name: 'VSUM' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(reactions).toHaveFocus();
  });

  it('closes a hover-opened dropdown on Escape without moving focus', () => {
    renderWithLineStyle();
    const reactions = screen.getByRole('button', { name: 'Reactions' });
    reactions.focus();

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'VSUM' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(reactions).toHaveFocus();
  });

  it('closes on Escape from the VSUM button and keeps focus there', () => {
    renderWithLineStyle();
    const vsum = screen.getByRole('button', { name: 'VSUM' });
    vsum.focus();
    fireEvent.mouseEnter(vsum);

    fireEvent.keyDown(vsum, { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(vsum).toHaveFocus();
  });

  it('closes the dropdown when focus leaves the menu', () => {
    renderWithLineStyle();
    const vsum = screen.getByRole('button', { name: 'VSUM' });
    vsum.focus();
    fireEvent.keyDown(vsum, { key: 'ArrowDown' });
    expect(screen.getByRole('menu')).toBeInTheDocument();

    act(() => screen.getByRole('button', { name: 'Reactions' }).focus());
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('preserves VSUM/Reactions switching', () => {
    const props = renderWithLineStyle();

    fireEvent.click(screen.getByRole('button', { name: 'VSUM' }));
    expect(props.onToggleReactionMode).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Reactions' }));
    expect(props.onToggleReactionMode).toHaveBeenCalledTimes(1);
  });

  it('switches back to VSUM from Reactions mode and no longer shows inline style buttons', () => {
    const props = renderWithLineStyle({ addReactionMode: true });

    expect(screen.queryByRole('button', { name: 'Dashed' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'VSUM' }));
    expect(props.onToggleReactionMode).toHaveBeenCalledTimes(1);
  });

  it('does not render a dropdown when no line-style handler is provided', () => {
    render(<CanvasProjectControls {...createProps()} onToggleReactionMode={vi.fn()} />);
    const vsum = screen.getByRole('button', { name: 'VSUM' });

    fireEvent.mouseEnter(vsum);
    expect(vsum).not.toHaveAttribute('aria-haspopup');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
