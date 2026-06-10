import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasProjectTabs } from '../../../components/canvas/CanvasProjectTabs';

jest.mock('../../../components/canvas/ProjectPickerMenu', () => ({
  ProjectPickerMenu: ({ onSelectProject }: { onSelectProject: (p: { id: number; name: string }) => void }) => (
    <button type="button" onClick={() => onSelectProject({ id: 99, name: 'New' })}>
      Add project
    </button>
  ),
}));

const tabs = [
  { instanceId: 'inst-1', projectId: 1, name: 'Alpha' },
  { instanceId: 'inst-2', projectId: 2, name: 'Beta' },
];

describe('CanvasProjectTabs', () => {
  it('returns null when there are no tabs', () => {
    const { container } = render(
      <CanvasProjectTabs
        tabs={[]}
        activeInstanceId={null}
        onActivate={jest.fn()}
        onRequestClose={jest.fn()}
        onSelectProject={jest.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders tab labels and activates on click', () => {
    const onActivate = jest.fn();
    render(
      <CanvasProjectTabs
        tabs={tabs}
        activeInstanceId="inst-1"
        dirtyInstanceIds={new Set(['inst-2'])}
        onActivate={onActivate}
        onRequestClose={jest.fn()}
        onSelectProject={jest.fn()}
      />,
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Beta'));
    expect(onActivate).toHaveBeenCalledWith('inst-2');
  });

  it('requests close when the tab close control is clicked', () => {
    const onRequestClose = jest.fn();
    render(
      <CanvasProjectTabs
        tabs={[tabs[0]]}
        activeInstanceId="inst-1"
        onActivate={jest.fn()}
        onRequestClose={onRequestClose}
        onSelectProject={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close Alpha' }));
    expect(onRequestClose).toHaveBeenCalledWith('inst-1');
  });

  it('forwards project selection from the picker', () => {
    const onSelectProject = jest.fn();
    render(
      <CanvasProjectTabs
        tabs={tabs}
        activeInstanceId="inst-1"
        onActivate={jest.fn()}
        onRequestClose={jest.fn()}
        onSelectProject={onSelectProject}
      />,
    );
    fireEvent.click(screen.getByText('Add project'));
    expect(onSelectProject).toHaveBeenCalledWith(99, 'New');
  });

  it('enables horizontal scroll and trackpad hint when more than four tabs are open', () => {
    const manyTabs = Array.from({ length: 5 }, (_, i) => ({
      instanceId: `inst-${i + 1}`,
      projectId: i + 1,
      name: `Project ${i + 1}`,
    }));

    render(
      <CanvasProjectTabs
        tabs={manyTabs}
        activeInstanceId="inst-1"
        openProjectIds={manyTabs.map(t => t.projectId)}
        onActivate={jest.fn()}
        onRequestClose={jest.fn()}
        onSelectProject={jest.fn()}
      />,
    );

    const tabList = screen.getByRole('tablist');
    expect(tabList).toHaveStyle({ overflowX: 'scroll' });
    expect(tabList).toHaveAttribute(
      'title',
      'Scroll with two fingers on your trackpad to see more tabs',
    );
  });
});
