import type { CSSProperties } from 'react';
import type { VsumUserResponse } from '../../services/api';
import { getUserInitials } from '../../utils/userInitials';
import {
  findMembershipForEmail,
  memberDisplayName,
  uniqueVsumMembers,
} from '../../utils/vsumMemberUtils';

export interface CanvasCollaborator {
  id: string;
  initials: string;
  name: string;
  color: string;
  ringColor?: string;
}

export const CANVAS_MEMBER_AVATAR_COLORS = [
  'linear-gradient(135deg, #049484, #06b89e)',
  'linear-gradient(135deg, #3b82f6, #60a5fa)',
  'linear-gradient(135deg, #8b5cf6, #a78bfa)',
  'linear-gradient(135deg, #f59e0b, #fbbf24)',
  'linear-gradient(135deg, #ec4899, #f472b6)',
];

export function buildCanvasPanelMembers(
  projectMembers: VsumUserResponse[],
  projectSharer: VsumUserResponse | null,
  isSharedAccess: boolean,
  currentUserEmail?: string,
  currentUserName?: string,
): VsumUserResponse[] {
  const unique = uniqueVsumMembers(projectMembers);
  if (!isSharedAccess) return unique;

  const entries: VsumUserResponse[] = [];
  if (projectSharer) entries.push(projectSharer);

  const selfInList = findMembershipForEmail(unique, currentUserEmail);
  if (selfInList && !entries.some(entry => entry.id === selfInList.id)) {
    entries.push(selfInList);
  } else if (currentUserEmail && !entries.some(entry =>
    entry.email?.toLowerCase() === currentUserEmail.toLowerCase(),
  )) {
    const nameParts = (currentUserName ?? '').trim().split(/\s+/);
    entries.push({
      id: -2,
      vsumId: projectSharer?.vsumId ?? 0,
      firstName: nameParts[0] ?? '',
      lastName: nameParts.slice(1).join(' '),
      email: currentUserEmail,
      role: 'VIEWER',
      createdAt: '',
    });
  }

  unique.forEach(member => {
    if (!entries.some(entry => entry.id === member.id)) entries.push(member);
  });

  return entries;
}

export function buildCanvasCollaborators(
  members: VsumUserResponse[],
): CanvasCollaborator[] {
  return uniqueVsumMembers(members).map((member, index) => {
    const name = memberDisplayName(member);
    return {
      id: String(member.id),
      initials: getUserInitials(name, member.email),
      name,
      color: CANVAS_MEMBER_AVATAR_COLORS[index % CANVAS_MEMBER_AVATAR_COLORS.length],
    };
  });
}

export type CanvasPanelMemberRole = 'Owner' | 'Member' | 'Viewer';

export function getCanvasPanelMemberName(member: VsumUserResponse): string {
  const full = memberDisplayName(member);
  if (full !== 'Member') return full;
  if (member.status === 'PENDING' || member.pending) return 'Pending invite';
  return member.email || 'Member';
}

export function getCanvasPanelMemberRole(
  member: VsumUserResponse,
): CanvasPanelMemberRole {
  const role = (member.role ?? '').toUpperCase();
  if (role === 'OWNER') return 'Owner';
  if (role === 'VIEWER') return 'Viewer';
  return 'Member';
}

export function getCanvasPanelRoleChipStyle(
  role: CanvasPanelMemberRole,
): CSSProperties {
  if (role === 'Owner') return { background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' };
  if (role === 'Viewer') return { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' };
  return { background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' };
}

export function isCanvasPanelMemberPending(member: VsumUserResponse): boolean {
  return member.status === 'PENDING' || member.pending === true;
}

export function formatCanvasPeopleCount(count: number): string {
  if (count === 1) return '1 person';
  return `${count} people`;
}

export function getCanvasCollaboratorStackTitle(
  isSharedAccess: boolean,
  projectSharer: VsumUserResponse | null,
): string {
  if (isSharedAccess && projectSharer) {
    return `Shared by ${getCanvasPanelMemberName(projectSharer)}`;
  }
  return 'People with access';
}

export function selectCanvasStackAvatars(
  isSharedAccess: boolean,
  projectSharer: VsumUserResponse | null,
  collaborators: CanvasCollaborator[],
  myAccount: CanvasCollaborator,
): CanvasCollaborator[] {
  if (isSharedAccess && projectSharer) {
    return buildCanvasCollaborators([projectSharer]).slice(0, 3);
  }
  if (collaborators.length > 0) {
    return collaborators.slice(0, 3);
  }
  return [myAccount];
}

function getCanvasSharedAccessSubtitle(membersLoading: boolean): string {
  if (membersLoading) return 'Loading owner details…';
  return 'Shared with you by the project owner';
}

export function getCanvasMembersPanelSubtitle(options: {
  isSharedAccess: boolean;
  projectSharer: VsumUserResponse | null;
  membersLoading: boolean;
  isViewOnly: boolean;
  memberCount: number;
}): string {
  const { isSharedAccess, projectSharer, membersLoading, isViewOnly, memberCount } = options;
  if (isSharedAccess && projectSharer) {
    return `Shared by ${getCanvasPanelMemberName(projectSharer)}`;
  }
  if (isSharedAccess) {
    return getCanvasSharedAccessSubtitle(membersLoading);
  }
  if (isViewOnly) {
    return 'You have view-only access to this project';
  }
  if (memberCount === 1) {
    return 'You are the only person on this project. Invite viewers to share it.';
  }
  if (memberCount > 0) {
    return `${formatCanvasPeopleCount(memberCount)} can access this project`;
  }
  return 'No members loaded yet';
}
