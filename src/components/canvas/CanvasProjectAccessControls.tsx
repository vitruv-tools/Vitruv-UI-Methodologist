import React, { useCallback, useRef, useState } from 'react';
import type { VsumUserResponse } from '../../services/api';
import { getUserInitials } from '../../utils/userInitials';
import {
  formatProjectMemberStackLabel,
  mergeSharerWithMembers,
} from '../../utils/vsumMemberUtils';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ThemeToggle } from '../ui/ThemeToggle';
import {
  CanvasAccountMenu,
  type CanvasAccountDisplay,
} from './CanvasAccountMenu';
import { CanvasPeopleAccessPanel } from './CanvasPeopleAccessPanel';
import { CanvasUserAvatar } from './CanvasUserAvatar';
import {
  buildCanvasCollaborators,
  buildCanvasPanelMembers,
  getCanvasCollaboratorStackTitle,
  getCanvasPanelMemberName,
  selectCanvasStackAvatars,
  type CanvasCollaborator,
} from './canvasMemberPresentation';

interface CollaboratorStackButtonProps {
  members: Array<{ id: string; initials: string; color: string; ringColor?: string }>;
  stackLabel: string;
  open: boolean;
  onClick: () => void;
  title?: string;
}

const CollaboratorStackButton: React.FC<CollaboratorStackButtonProps> = ({
  members,
  stackLabel,
  open,
  onClick,
  title = 'People with access',
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    aria-expanded={open}
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      cursor: 'pointer',
      padding: '4px 10px 4px 6px',
      border: 'none',
      borderRadius: 8,
      background: open ? 'var(--v-chrome-hover)' : 'transparent',
      transition: 'background 0.15s',
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center' }}>
      {members.map((member, index) => (
        <span
          key={member.id}
          style={{ marginLeft: index === 0 ? 0 : -7, zIndex: members.length - index, display: 'inline-flex' }}
        >
          <CanvasUserAvatar
            initials={member.initials}
            bg={member.color}
            size={24}
            ring={member.ringColor}
          />
        </span>
      ))}
    </span>
    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--v-text-secondary)', whiteSpace: 'nowrap' }}>
      {stackLabel}
    </span>
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--v-chrome-icon)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </button>
);

export interface CanvasProjectAccessControlsProps {
  projectMembers: VsumUserResponse[];
  projectSharer: VsumUserResponse | null;
  canShare: boolean;
  isViewOnly?: boolean;
  isSharedAccess?: boolean;
  membersLoading?: boolean;
  currentUserEmail?: string;
  currentUserName?: string;
  onRefreshMembers: () => void;
  onRemoveMember?: (vsumUserId: number) => void | Promise<void>;
  onShareClick: () => void;
}

export const CanvasProjectAccessControls: React.FC<CanvasProjectAccessControlsProps> = ({
  projectMembers,
  projectSharer,
  canShare,
  isViewOnly = false,
  isSharedAccess = false,
  membersLoading = false,
  currentUserEmail,
  currentUserName,
  onRefreshMembers,
  onRemoveMember,
  onShareClick,
}) => {
  const [showAccounts, setShowAccounts] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [removeConfirmMember, setRemoveConfirmMember] = useState<VsumUserResponse | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const displayName = currentUserName ?? 'Me';
  const initials = getUserInitials(displayName, currentUserEmail);

  const myAccount: CanvasCollaborator = {
    id: 'me',
    initials,
    name: displayName,
    color: 'linear-gradient(135deg, #049484, #06b89e)',
    ringColor: '#049484',
  };
  const accountDisplay: CanvasAccountDisplay = {
    initials: myAccount.initials,
    displayName: myAccount.name,
    avatarBackground: myAccount.color,
    ringColor: myAccount.ringColor,
  };

  const panelMembers = buildCanvasPanelMembers(
    projectMembers,
    projectSharer,
    isSharedAccess,
    currentUserEmail,
    currentUserName,
  );
  const collaborators = buildCanvasCollaborators(
    mergeSharerWithMembers(projectSharer, projectMembers),
  );
  const memberCount = panelMembers.length;
  const stackAvatars = selectCanvasStackAvatars(isSharedAccess, projectSharer, collaborators, myAccount);
  const stackTitle = getCanvasCollaboratorStackTitle(isSharedAccess, projectSharer);
  const stackLabel = formatProjectMemberStackLabel(memberCount, {
    isSharedAccess,
    isSoloOwner: canShare && memberCount === 1,
  });

  const toggleMembersPanel = useCallback(() => {
    setShowAccounts(current => {
      const next = !current;
      if (next) onRefreshMembers();
      return next;
    });
  }, [onRefreshMembers]);

  const closeMembersPanel = useCallback(() => setShowAccounts(false), []);

  return (
    <div ref={wrapRef} style={{ ...rightPillStyle, padding: '0 10px', gap: 0, position: 'absolute' }}>
      <CollaboratorStackButton
        members={stackAvatars.map(member => ({
          id: member.id,
          initials: member.initials,
          color: member.color,
          ringColor: 'ringColor' in member ? (member as typeof myAccount).ringColor : undefined,
        }))}
        stackLabel={stackLabel}
        open={showAccounts}
        onClick={toggleMembersPanel}
        title={stackTitle}
      />

      <Divider />

      <ThemeToggle />

      <Divider />

      <CanvasAccountMenu
        account={accountDisplay}
        dismissalBoundaryRef={wrapRef}
        siblingMenuOpen={showAccounts}
        onCloseSiblingMenu={closeMembersPanel}
      />

      <Divider />

      {canShare && <ShareBtn onClick={onShareClick} />}

      {showAccounts && (
        <CanvasPeopleAccessPanel
          isSharedAccess={isSharedAccess}
          isViewOnly={isViewOnly}
          canShare={canShare}
          membersLoading={membersLoading}
          memberCount={memberCount}
          panelMembers={panelMembers}
          projectSharer={projectSharer}
          currentUserEmail={currentUserEmail}
          removingMemberId={removingMemberId}
          canRemoveMembers={canShare && Boolean(onRemoveMember)}
          onRefreshMembers={onRefreshMembers}
          onRequestRemove={setRemoveConfirmMember}
          onShareClick={onShareClick}
          onClose={closeMembersPanel}
        />
      )}

      <ConfirmDialog
        isOpen={removeConfirmMember !== null}
        title="Remove access"
        message={removeConfirmMember
          ? `Remove access for ${getCanvasPanelMemberName(removeConfirmMember)}? They will no longer be able to open this project.`
          : 'Remove this person\'s access to the project?'}
        confirmText="Remove access"
        cancelText="Cancel"
        variant="danger"
        onConfirm={async () => {
          if (!removeConfirmMember || !onRemoveMember) return;
          const id = removeConfirmMember.id;
          setRemoveConfirmMember(null);
          setRemovingMemberId(id);
          try {
            await onRemoveMember(id);
          } finally {
            setRemovingMemberId(null);
          }
        }}
        onCancel={() => setRemoveConfirmMember(null)}
      />
    </div>
  );
};

const ShareBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      title="Share project — invite viewers by email"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 30, padding: '0 12px', border: 'none', borderRadius: 6,
        background: hov ? '#038472' : '#049484',
        color: '#ffffff', fontSize: 12, fontWeight: 700,
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
        whiteSpace: 'nowrap', transition: 'background 0.15s', flexShrink: 0,
      }}
    >
      <ShareIcon />
      Share
    </button>
  );
};

const rightPillStyle: React.CSSProperties = {
  position: 'absolute',
  top: 14,
  right: 14,
  borderRadius: 8,
  zIndex: 400,
  background: 'var(--v-chrome-bg)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.13), 0 0 0 1px rgba(0,0,0,0.07)',
  display: 'flex',
  alignItems: 'center',
  height: 44,
  padding: '0 6px',
  gap: 2,
};

const Divider = () => (
  <div style={{ width: 1, height: 22, background: 'var(--v-chrome-divider)', margin: '0 5px', flexShrink: 0 }} />
);

const ShareIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);
