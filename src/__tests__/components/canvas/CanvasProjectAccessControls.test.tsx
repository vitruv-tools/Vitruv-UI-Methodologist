import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  CanvasProjectAccessControls,
  type CanvasProjectAccessControlsProps,
} from '../../../components/canvas/CanvasProjectAccessControls';
import type { CanvasAccountDisplay } from '../../../components/canvas/CanvasAccountMenu';
import type { CanvasPeopleAccessPanelProps } from '../../../components/canvas/CanvasPeopleAccessPanel';
import type { VsumUserResponse } from '../../../services/api';

interface MockCanvasAccountMenuProps {
  account: CanvasAccountDisplay;
  dismissalBoundaryRef: React.RefObject<HTMLDivElement | null>;
  siblingMenuOpen: boolean;
  onCloseSiblingMenu: () => void;
}

const mockAccountMenuProps = jest.fn();
const mockPeopleAccessPanelProps = jest.fn();

jest.mock('../../../components/canvas/CanvasAccountMenu', () => ({
  CanvasAccountMenu: (props: MockCanvasAccountMenuProps) => {
    mockAccountMenuProps(props);
    return (
      <button type="button" onClick={props.onCloseSiblingMenu}>
        Mock account menu
      </button>
    );
  },
}));

jest.mock('../../../components/canvas/CanvasPeopleAccessPanel', () => ({
  CanvasPeopleAccessPanel: (props: CanvasPeopleAccessPanelProps) => {
    mockPeopleAccessPanelProps(props);
    const removableMember = props.panelMembers.find(member => member.role !== 'OWNER')
      ?? props.panelMembers[0];

    return (
      <div data-testid="people-access-panel">
        <span>Removing member: {props.removingMemberId ?? 'none'}</span>
        <button type="button" onClick={props.onClose}>Close people panel</button>
        {removableMember && (
          <button type="button" onClick={() => props.onRequestRemove(removableMember)}>
            Request removal
          </button>
        )}
      </div>
    );
  },
}));

const createMember = (
  overrides: Partial<VsumUserResponse> = {},
): VsumUserResponse => ({
  id: 1,
  vsumId: 10,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  role: 'OWNER',
  createdAt: '',
  ...overrides,
});

const owner = createMember();
const member = createMember({
  id: 2,
  firstName: 'Alan',
  lastName: 'Turing',
  email: 'alan@example.com',
  role: 'MEMBER',
});

const renderControls = (
  overrides: Partial<CanvasProjectAccessControlsProps> = {},
) => {
  const props: CanvasProjectAccessControlsProps = {
    projectMembers: [owner],
    projectSharer: null,
    canShare: true,
    isViewOnly: false,
    isSharedAccess: false,
    membersLoading: false,
    currentUserEmail: 'ahmed@example.com',
    currentUserName: 'Ahmed Ibrahim',
    onRefreshMembers: jest.fn(),
    onRemoveMember: jest.fn(),
    onShareClick: jest.fn(),
    ...overrides,
  };

  return {
    ...render(<CanvasProjectAccessControls {...props} />),
    props,
  };
};

const latestAccountMenuProps = (): MockCanvasAccountMenuProps => {
  const calls = mockAccountMenuProps.mock.calls;
  return calls[calls.length - 1][0] as MockCanvasAccountMenuProps;
};

const latestPeoplePanelProps = (): CanvasPeopleAccessPanelProps => {
  const calls = mockPeopleAccessPanelProps.mock.calls;
  return calls[calls.length - 1][0] as CanvasPeopleAccessPanelProps;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CanvasProjectAccessControls', () => {
  it('renders collaborator stack labels, titles, and fallback account avatar', () => {
    const { rerender, props } = renderControls({
      projectMembers: [],
    });

    const fallbackStack = screen.getByRole('button', { name: 'People with access' });
    expect(fallbackStack).toHaveTextContent('People');
    expect(fallbackStack).toHaveTextContent('AI');
    expect(fallbackStack).toHaveAttribute('title', 'People with access');
    expect(fallbackStack).toHaveAttribute('aria-expanded', 'false');

    rerender(
      <CanvasProjectAccessControls
        {...props}
        projectMembers={[owner]}
      />,
    );

    expect(screen.getByRole('button', { name: 'People with access' })).toHaveTextContent('Only you');

    rerender(
      <CanvasProjectAccessControls
        {...props}
        projectMembers={[member]}
        projectSharer={owner}
        isSharedAccess
        canShare={false}
        currentUserEmail={member.email}
        currentUserName="Alan Turing"
      />,
    );

    const sharedStack = screen.getByRole('button', { name: 'Shared by Ada Lovelace' });
    expect(sharedStack).toHaveTextContent('2 people');
    expect(sharedStack).toHaveTextContent('AL');
  });

  it('opens the people panel, refreshes members, and forwards panel close', () => {
    const onRefreshMembers = jest.fn();
    renderControls({ onRefreshMembers });

    const stackButton = screen.getByRole('button', { name: 'People with access' });
    fireEvent.click(stackButton);

    expect(onRefreshMembers).toHaveBeenCalledTimes(1);
    expect(stackButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('people-access-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close people panel' }));

    expect(screen.queryByTestId('people-access-panel')).not.toBeInTheDocument();
    expect(stackButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the share button only when allowed and forwards share clicks', () => {
    const onShareClick = jest.fn();
    const { rerender, props } = renderControls({
      canShare: false,
      onShareClick,
    });

    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();

    rerender(
      <CanvasProjectAccessControls
        {...props}
        canShare
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(onShareClick).toHaveBeenCalledTimes(1);
  });

  it('forwards expected project data and callbacks to the people panel', () => {
    const onRefreshMembers = jest.fn();
    const onRemoveMember = jest.fn();
    const onShareClick = jest.fn();
    renderControls({
      projectMembers: [owner, member],
      projectSharer: owner,
      canShare: true,
      isViewOnly: true,
      isSharedAccess: true,
      membersLoading: true,
      currentUserEmail: 'alan@example.com',
      currentUserName: 'Alan Turing',
      onRefreshMembers,
      onRemoveMember,
      onShareClick,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Shared by Ada Lovelace' }));

    const panelProps = latestPeoplePanelProps();
    expect(panelProps).toMatchObject({
      isSharedAccess: true,
      isViewOnly: true,
      canShare: true,
      membersLoading: true,
      memberCount: 2,
      projectSharer: owner,
      currentUserEmail: 'alan@example.com',
      removingMemberId: null,
      canRemoveMembers: true,
      onRefreshMembers,
      onShareClick,
    });
    expect(panelProps.panelMembers).toEqual([owner, member]);
    expect(panelProps.onRequestRemove).toEqual(expect.any(Function));
    expect(panelProps.onClose).toEqual(expect.any(Function));
  });

  it('opens confirmation and completes removal through the supplied callback', async () => {
    let resolveRemoval: (() => void) | undefined;
    const removalPromise = new Promise<void>(resolve => {
      resolveRemoval = resolve;
    });
    const onRemoveMember = jest.fn(() => removalPromise);
    renderControls({
      projectMembers: [owner, member],
      onRemoveMember,
    });

    fireEvent.click(screen.getByRole('button', { name: 'People with access' }));
    fireEvent.click(screen.getByRole('button', { name: 'Request removal' }));

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Remove access');
    expect(screen.getByText(
      'Remove access for Alan Turing? They will no longer be able to open this project.',
    )).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove access' }));

    expect(onRemoveMember).toHaveBeenCalledTimes(1);
    expect(onRemoveMember).toHaveBeenCalledWith(member.id);
    expect(latestPeoplePanelProps().removingMemberId).toBe(member.id);

    await act(async () => {
      resolveRemoval?.();
      await removalPromise;
    });

    await waitFor(() => {
      expect(latestPeoplePanelProps().removingMemberId).toBeNull();
    });
  });

  it('cancels removal without invoking the supplied callback', () => {
    const onRemoveMember = jest.fn();
    renderControls({
      projectMembers: [owner, member],
      onRemoveMember,
    });

    fireEvent.click(screen.getByRole('button', { name: 'People with access' }));
    fireEvent.click(screen.getByRole('button', { name: 'Request removal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onRemoveMember).not.toHaveBeenCalled();
  });

  it('supplies the account menu with the current display identity', () => {
    renderControls({
      currentUserEmail: 'grace@example.com',
      currentUserName: 'Grace Hopper',
    });

    const accountProps = latestAccountMenuProps();
    expect(accountProps.account).toEqual({
      initials: 'GH',
      displayName: 'Grace Hopper',
      avatarBackground: 'linear-gradient(135deg, #049484, #06b89e)',
      ringColor: '#049484',
    });
    expect(accountProps.siblingMenuOpen).toBe(false);
    expect(accountProps.dismissalBoundaryRef.current).toBeInstanceOf(HTMLDivElement);
    expect(accountProps.onCloseSiblingMenu).toEqual(expect.any(Function));
  });

  it('renders a dark mode toggle next to the account menu', () => {
    renderControls();
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
  });
});
