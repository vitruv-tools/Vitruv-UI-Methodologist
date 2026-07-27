import React from 'react';
import type { VsumUserResponse } from '../../services/api';
import { getUserInitials } from '../../utils/userInitials';
import { CanvasUserAvatar } from './CanvasUserAvatar';
import {
  CANVAS_MEMBER_AVATAR_COLORS,
  getCanvasMembersPanelSubtitle,
  getCanvasPanelMemberName,
  getCanvasPanelMemberRole,
  getCanvasPanelRoleChipStyle,
  isCanvasPanelMemberPending,
} from './canvasMemberPresentation';

interface PeoplePanelMemberRowProps {
  member: VsumUserResponse;
  index: number;
  projectSharer: VsumUserResponse | null;
  isSharedAccess: boolean;
  isViewOnly: boolean;
  canRemoveMembers: boolean;
  currentUserEmail?: string;
  removingMemberId: number | null;
  onRequestRemove: (member: VsumUserResponse) => void;
}

const PeoplePanelMemberRow: React.FC<PeoplePanelMemberRowProps> = ({
  member,
  index,
  projectSharer,
  isSharedAccess,
  isViewOnly,
  canRemoveMembers,
  currentUserEmail,
  removingMemberId,
  onRequestRemove,
}) => {
  const name = getCanvasPanelMemberName(member);
  const role = getCanvasPanelMemberRole(member);
  const pending = isCanvasPanelMemberPending(member);
  const isSelf = currentUserEmail
    ? member.email?.toLowerCase() === currentUserEmail.toLowerCase()
    : false;
  const isSharer = projectSharer?.id === member.id
    || projectSharer?.email?.toLowerCase() === member.email?.toLowerCase();
  const color = CANVAS_MEMBER_AVATAR_COLORS[index % CANVAS_MEMBER_AVATAR_COLORS.length];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 8px',
        borderRadius: 8,
        background: isSharer && isSharedAccess ? '#f8fafc' : 'transparent',
      }}
    >
      <CanvasUserAvatar
        initials={getUserInitials(name, member.email)}
        bg={color}
        size={36}
        title={name}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          title={name}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#0f172a',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {isSelf ? `${name} (you)` : name}
        </div>
        <div
          title={member.email}
          style={{
            fontSize: 11,
            color: '#64748b',
            marginTop: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {isSharer && isSharedAccess ? 'Project owner' : member.email}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 20,
          fontSize: 10,
          fontWeight: 700,
          ...getCanvasPanelRoleChipStyle(role),
        }}>
          {isSelf && isViewOnly ? 'Viewer' : role}
        </span>
        {pending && (
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#c2410c',
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: 20,
            padding: '1px 7px',
          }}>
            Pending
          </span>
        )}
        {canRemoveMembers && role !== 'Owner' && !isSelf && (
          <button
            type="button"
            disabled={removingMemberId === member.id}
            onClick={() => onRequestRemove(member)}
            style={{
              padding: '2px 8px',
              borderRadius: 6,
              border: '1px solid #fecaca',
              background: '#fff5f5',
              color: '#dc2626',
              fontSize: 10,
              fontWeight: 700,
              cursor: removingMemberId === member.id ? 'wait' : 'pointer',
              opacity: removingMemberId === member.id ? 0.6 : 1,
            }}
          >
            {removingMemberId === member.id ? 'Removing…' : 'Remove access'}
          </button>
        )}
      </div>
    </div>
  );
};

export interface CanvasPeopleAccessPanelProps {
  isSharedAccess: boolean;
  isViewOnly: boolean;
  canShare: boolean;
  membersLoading: boolean;
  memberCount: number;
  panelMembers: VsumUserResponse[];
  projectSharer: VsumUserResponse | null;
  currentUserEmail?: string;
  removingMemberId: number | null;
  canRemoveMembers: boolean;
  onRefreshMembers: () => void;
  onRequestRemove: (member: VsumUserResponse) => void;
  onShareClick: () => void;
  onClose: () => void;
}

export const CanvasPeopleAccessPanel: React.FC<CanvasPeopleAccessPanelProps> = ({
  isSharedAccess,
  isViewOnly,
  canShare,
  membersLoading,
  memberCount,
  panelMembers,
  projectSharer,
  currentUserEmail,
  removingMemberId,
  canRemoveMembers,
  onRefreshMembers,
  onRequestRemove,
  onShareClick,
  onClose,
}) => (
  <div style={{
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: 340,
    maxWidth: '92vw',
    background: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 12px 40px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    zIndex: 500,
  }}>
    <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
        {isSharedAccess ? 'Shared with you' : 'People with access'}
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 1.4 }}>
        {getCanvasMembersPanelSubtitle({
          isSharedAccess,
          projectSharer,
          membersLoading,
          isViewOnly,
          memberCount,
        })}
      </div>
    </div>

    {canShare && memberCount === 1 && !isSharedAccess && !membersLoading && (
      <div style={{
        padding: '10px 14px',
        background: '#f0fdfa',
        borderBottom: '1px solid #ccfbf1',
        fontSize: 12,
        color: '#047857',
        lineHeight: 1.45,
      }}>
        You are working alone. Share this project to invite viewers by email.
      </div>
    )}

    <div style={{
      padding: '6px 8px',
      maxHeight: 280,
      overflowY: 'auto',
      scrollbarWidth: 'thin',
    }}>
      {membersLoading && panelMembers.length === 0 && (
        <div style={{ padding: '12px 8px', fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>
          Loading…
        </div>
      )}
      {!membersLoading && panelMembers.map((member, index) => (
        <PeoplePanelMemberRow
          key={`${member.id}-${member.email}`}
          member={member}
          index={index}
          projectSharer={projectSharer}
          isSharedAccess={isSharedAccess}
          isViewOnly={isViewOnly}
          canRemoveMembers={canRemoveMembers}
          currentUserEmail={currentUserEmail}
          removingMemberId={removingMemberId}
          onRequestRemove={onRequestRemove}
        />
      ))}
      {!membersLoading && panelMembers.length === 0 && (
        <div style={{ padding: '12px 8px', display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            {isSharedAccess
              ? 'Member list is not available for viewers. You can still view this project.'
              : 'Could not load project members.'}
          </div>
          <button
            type="button"
            onClick={onRefreshMembers}
            style={{
              justifySelf: 'start',
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: '#fff',
              color: '#334155',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>

    {canShare && (
      <div style={{ padding: '10px 12px 12px', borderTop: '1px solid #f1f5f9' }}>
        <button
          type="button"
          onClick={() => { onClose(); onShareClick(); }}
          style={{
            width: '100%',
            padding: '9px 12px',
            border: 'none',
            borderRadius: 8,
            background: '#049484',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Invite viewer
        </button>
      </div>
    )}
  </div>
);
