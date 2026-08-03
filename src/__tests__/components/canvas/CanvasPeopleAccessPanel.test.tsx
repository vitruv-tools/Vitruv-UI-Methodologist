import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  CanvasPeopleAccessPanel,
  type CanvasPeopleAccessPanelProps,
} from '../../../components/canvas/CanvasPeopleAccessPanel';
import type { VsumUserResponse } from '../../../services/api';

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
const currentUser = createMember({
  id: 3,
  firstName: 'Grace',
  lastName: 'Hopper',
  email: 'grace@example.com',
  role: 'VIEWER',
});
const pendingViewer = createMember({
  id: 4,
  firstName: '',
  lastName: '',
  email: '',
  role: 'VIEWER',
  status: 'PENDING',
});

const renderPanel = (
  overrides: Partial<CanvasPeopleAccessPanelProps> = {},
) => {
  const panelMembers = overrides.panelMembers ?? [owner];
  const props: CanvasPeopleAccessPanelProps = {
    isSharedAccess: false,
    isViewOnly: false,
    canShare: true,
    membersLoading: false,
    memberCount: overrides.memberCount ?? panelMembers.length,
    panelMembers,
    projectSharer: null,
    currentUserEmail: 'owner@example.com',
    removingMemberId: null,
    canRemoveMembers: true,
    onRefreshMembers: jest.fn(),
    onRequestRemove: jest.fn(),
    onShareClick: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };

  return {
    ...render(<CanvasPeopleAccessPanel {...props} />),
    props,
  };
};

describe('CanvasPeopleAccessPanel', () => {
  it('renders owned-project heading and subtitle content', () => {
    renderPanel({
      panelMembers: [owner, member],
      memberCount: 2,
    });

    expect(screen.getByText('People with access')).toBeInTheDocument();
    expect(screen.getByText('2 people can access this project')).toBeInTheDocument();
  });

  it('renders shared-project heading, subtitle, and project-owner labeling', () => {
    renderPanel({
      isSharedAccess: true,
      isViewOnly: true,
      canShare: false,
      panelMembers: [owner, currentUser],
      memberCount: 2,
      projectSharer: owner,
      currentUserEmail: currentUser.email,
      canRemoveMembers: false,
    });

    expect(screen.getByText('Shared with you')).toBeInTheDocument();
    expect(screen.getByText('Shared by Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Project owner')).toBeInTheDocument();
  });

  it('renders member names, roles, pending status, and current-user annotation', () => {
    renderPanel({
      panelMembers: [owner, member, currentUser, pendingViewer],
      memberCount: 4,
      currentUserEmail: currentUser.email,
    });

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Alan Turing')).toBeInTheDocument();
    expect(screen.getByText('Grace Hopper (you)')).toBeInTheDocument();
    expect(screen.getByText('Pending invite')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(screen.getAllByText('Viewer')).toHaveLength(2);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('hides removal for owners and the current user and requests removal for an eligible member', () => {
    const onRequestRemove = jest.fn();
    renderPanel({
      panelMembers: [owner, member, currentUser],
      memberCount: 3,
      currentUserEmail: currentUser.email,
      onRequestRemove,
    });

    const removeButtons = screen.getAllByRole('button', { name: 'Remove access' });
    expect(removeButtons).toHaveLength(1);

    fireEvent.click(removeButtons[0]);
    expect(onRequestRemove).toHaveBeenCalledTimes(1);
    expect(onRequestRemove).toHaveBeenCalledWith(member);
  });

  it('shows and disables the existing removing state', () => {
    const onRequestRemove = jest.fn();
    renderPanel({
      panelMembers: [member],
      removingMemberId: member.id,
      onRequestRemove,
    });

    const removingButton = screen.getByRole('button', { name: 'Removing…' });
    expect(removingButton).toBeDisabled();

    fireEvent.click(removingButton);
    expect(onRequestRemove).not.toHaveBeenCalled();
  });

  it('fires refresh, share, and close callbacks', () => {
    const onRefreshMembers = jest.fn();
    const onShareClick = jest.fn();
    const onClose = jest.fn();
    renderPanel({
      panelMembers: [],
      memberCount: 0,
      onRefreshMembers,
      onShareClick,
      onClose,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRefreshMembers).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Invite viewer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onShareClick).toHaveBeenCalledTimes(1);
  });

  it('preserves loading and owned-project empty rendering', () => {
    const { rerender, props } = renderPanel({
      canShare: false,
      membersLoading: true,
      panelMembers: [],
      memberCount: 0,
      canRemoveMembers: false,
    });

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();

    rerender(
      <CanvasPeopleAccessPanel
        {...props}
        membersLoading={false}
      />,
    );

    expect(screen.getByText('Could not load project members.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('preserves shared-project empty rendering', () => {
    renderPanel({
      isSharedAccess: true,
      isViewOnly: true,
      canShare: false,
      panelMembers: [],
      memberCount: 0,
      canRemoveMembers: false,
    });

    expect(screen.getByText(
      'Member list is not available for viewers. You can still view this project.',
    )).toBeInTheDocument();
  });
});
