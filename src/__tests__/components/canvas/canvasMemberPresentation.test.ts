import type { VsumUserResponse } from '../../../services/api';
import {
  CANVAS_MEMBER_AVATAR_COLORS,
  buildCanvasCollaborators,
  buildCanvasPanelMembers,
  formatCanvasPeopleCount,
  getCanvasCollaboratorStackTitle,
  getCanvasMembersPanelSubtitle,
  getCanvasPanelMemberName,
  getCanvasPanelMemberRole,
  getCanvasPanelRoleChipStyle,
  isCanvasPanelMemberPending,
  selectCanvasStackAvatars,
  type CanvasCollaborator,
} from '../../../components/canvas/canvasMemberPresentation';

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

describe('canvasMemberPresentation', () => {
  it('builds unique panel members for owned and shared projects', () => {
    const owner = createMember();
    const duplicateOwner = createMember({ id: 99 });
    const viewer = createMember({
      id: 2,
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      role: 'VIEWER',
    });

    expect(buildCanvasPanelMembers(
      [owner, duplicateOwner, viewer],
      null,
      false,
    )).toEqual([owner, viewer]);

    expect(buildCanvasPanelMembers(
      [viewer, owner],
      owner,
      true,
      viewer.email,
      'Grace Hopper',
    )).toEqual([owner, viewer]);
  });

  it('orders the shared-project owner and current user before other members', () => {
    const owner = createMember();
    const currentUser = createMember({
      id: 2,
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      role: 'VIEWER',
    });
    const otherMember = createMember({
      id: 3,
      firstName: 'Alan',
      lastName: 'Turing',
      email: 'alan@example.com',
      role: 'MEMBER',
    });

    expect(buildCanvasPanelMembers(
      [otherMember, currentUser],
      owner,
      true,
      currentUser.email,
      'Grace Hopper',
    )).toEqual([owner, currentUser, otherMember]);
  });

  it('adds a fallback current-user entry for shared projects', () => {
    const owner = createMember();
    const otherMember = createMember({
      id: 3,
      firstName: 'Alan',
      lastName: 'Turing',
      email: 'alan@example.com',
      role: 'MEMBER',
    });

    const members = buildCanvasPanelMembers(
      [otherMember],
      owner,
      true,
      'grace@example.com',
      'Grace Brewster Hopper',
    );

    expect(members).toEqual([
      owner,
      {
        id: -2,
        vsumId: 10,
        firstName: 'Grace',
        lastName: 'Brewster Hopper',
        email: 'grace@example.com',
        role: 'VIEWER',
        createdAt: '',
      },
      otherMember,
    ]);
  });

  it('builds collaborator initials with deterministic avatar colors', () => {
    const members = [
      createMember(),
      createMember({
        id: 2,
        firstName: 'Grace',
        lastName: 'Hopper',
        email: 'grace@example.com',
        role: 'VIEWER',
      }),
    ];

    expect(buildCanvasCollaborators(members)).toEqual([
      {
        id: '1',
        initials: 'AL',
        name: 'Ada Lovelace',
        color: CANVAS_MEMBER_AVATAR_COLORS[0],
      },
      {
        id: '2',
        initials: 'GH',
        name: 'Grace Hopper',
        color: CANVAS_MEMBER_AVATAR_COLORS[1],
      },
    ]);
  });

  it('resolves owner, member, and viewer labels and chip styles', () => {
    expect(getCanvasPanelMemberRole(createMember({ role: 'OWNER' }))).toBe('Owner');
    expect(getCanvasPanelMemberRole(createMember({ role: 'MEMBER' }))).toBe('Member');
    expect(getCanvasPanelMemberRole(createMember({ role: 'VIEWER' }))).toBe('Viewer');
    expect(getCanvasPanelRoleChipStyle('Owner')).toEqual({
      background: '#ecfdf5',
      color: '#065f46',
      border: '1px solid #a7f3d0',
    });
    expect(getCanvasPanelRoleChipStyle('Member')).toEqual({
      background: '#f3f4f6',
      color: '#374151',
      border: '1px solid #e5e7eb',
    });
    expect(getCanvasPanelRoleChipStyle('Viewer')).toEqual({
      background: '#eff6ff',
      color: '#1d4ed8',
      border: '1px solid #bfdbfe',
    });
  });

  it('resolves pending-invitation display names and state', () => {
    const pendingByStatus = createMember({
      firstName: '',
      lastName: '',
      email: '',
      role: 'VIEWER',
      status: 'PENDING',
    });
    const pendingByFlag = createMember({
      firstName: '',
      lastName: '',
      email: '',
      role: 'VIEWER',
      pending: true,
    });

    expect(getCanvasPanelMemberName(pendingByStatus)).toBe('Pending invite');
    expect(getCanvasPanelMemberName(pendingByFlag)).toBe('Pending invite');
    expect(isCanvasPanelMemberPending(pendingByStatus)).toBe(true);
    expect(isCanvasPanelMemberPending(pendingByFlag)).toBe(true);
    expect(isCanvasPanelMemberPending(createMember())).toBe(false);
  });

  it('resolves collaborator stack titles and fallback account avatars', () => {
    const owner = createMember();
    const account: CanvasCollaborator = {
      id: 'me',
      initials: 'ME',
      name: 'Current User',
      color: 'account-color',
      ringColor: 'account-ring',
    };
    const collaborators = buildCanvasCollaborators([
      createMember({ id: 2 }),
      createMember({ id: 3, email: 'grace@example.com' }),
      createMember({ id: 4, email: 'alan@example.com' }),
      createMember({ id: 5, email: 'barbara@example.com' }),
    ]);

    expect(getCanvasCollaboratorStackTitle(false, owner)).toBe('People with access');
    expect(getCanvasCollaboratorStackTitle(true, owner)).toBe('Shared by Ada Lovelace');
    expect(selectCanvasStackAvatars(false, null, [], account)).toEqual([account]);
    expect(selectCanvasStackAvatars(false, null, collaborators, account)).toEqual(
      collaborators.slice(0, 3),
    );
    expect(selectCanvasStackAvatars(true, owner, collaborators, account)).toEqual(
      buildCanvasCollaborators([owner]),
    );
  });

  it('formats singular and plural people counts', () => {
    expect(formatCanvasPeopleCount(1)).toBe('1 person');
    expect(formatCanvasPeopleCount(0)).toBe('0 people');
    expect(formatCanvasPeopleCount(3)).toBe('3 people');
  });

  it.each([
    [
      {
        isSharedAccess: true,
        projectSharer: createMember(),
        membersLoading: false,
        isViewOnly: true,
        memberCount: 0,
      },
      'Shared by Ada Lovelace',
    ],
    [
      {
        isSharedAccess: true,
        projectSharer: null,
        membersLoading: true,
        isViewOnly: true,
        memberCount: 0,
      },
      'Loading owner details…',
    ],
    [
      {
        isSharedAccess: true,
        projectSharer: null,
        membersLoading: false,
        isViewOnly: true,
        memberCount: 0,
      },
      'Shared with you by the project owner',
    ],
    [
      {
        isSharedAccess: false,
        projectSharer: null,
        membersLoading: false,
        isViewOnly: true,
        memberCount: 2,
      },
      'You have view-only access to this project',
    ],
    [
      {
        isSharedAccess: false,
        projectSharer: null,
        membersLoading: false,
        isViewOnly: false,
        memberCount: 1,
      },
      'You are the only person on this project. Invite viewers to share it.',
    ],
    [
      {
        isSharedAccess: false,
        projectSharer: null,
        membersLoading: false,
        isViewOnly: false,
        memberCount: 3,
      },
      '3 people can access this project',
    ],
    [
      {
        isSharedAccess: false,
        projectSharer: null,
        membersLoading: false,
        isViewOnly: false,
        memberCount: 0,
      },
      'No members loaded yet',
    ],
  ])('resolves members-panel subtitle branch %#', (options, expected) => {
    expect(getCanvasMembersPanelSubtitle(options)).toBe(expected);
  });
});
