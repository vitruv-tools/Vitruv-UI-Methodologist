import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { apiService, VsumUserResponse } from '../../services/api';
import { memberDisplayName, parseVsumMembersResponse } from '../../utils/vsumMemberUtils';
import { ActionButton } from './ActionButton';
import { AddPeopleSection } from './AddPeopleSection';
import { ConfirmDialog } from './ConfirmDialog';
import { MODAL_Z_INDEX, modalBackdropStyle, modalDialogShellStyle, useModalBodyLock } from './modalUtils';
import { APP_FONT, errorMessageStyle, successMessageStyle } from './sharedStyles';

interface ShareProjectModalProps {
  isOpen: boolean;
  vsumId?: number;
  projectName?: string;
  onClose: () => void;
  onInvited?: () => void;
}

const isOwnerRole = (role?: string, roleEn?: string) =>
  role === 'OWNER' || (!!roleEn && roleEn.toLowerCase().includes('owner'));

const isViewerRole = (role?: string, roleEn?: string) =>
  role === 'VIEWER' || (!!roleEn && roleEn.toLowerCase().includes('viewer'));

const prettyRole = (role?: string, roleEn?: string) => {
  if (isOwnerRole(role, roleEn)) return 'Owner';
  if (isViewerRole(role, roleEn)) return 'Viewer';
  return 'Member';
};

const isPendingMember = (m: VsumUserResponse) =>
  m.status === 'PENDING'
  || m.pending === true
  || ((!m.firstName?.trim() && !m.lastName?.trim()) && isViewerRole(m.role, m.roleEn));

const roleBadge = (role: string): React.CSSProperties => {
  if (role === 'Owner') {
    return { background: 'var(--v-success-bg)', color: 'var(--v-success-text)', border: '1px solid var(--v-success-border)' };
  }
  if (role === 'Viewer') {
    return { background: 'var(--v-info-bg)', color: 'var(--v-info-text)', border: '1px solid var(--v-info-border)' };
  }
  return { background: 'var(--v-surface-hover)', color: 'var(--v-text-secondary)', border: '1px solid var(--v-border)' };
};

const removeBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 11,
  border: '1px solid var(--v-danger-border)',
  background: 'var(--v-danger-bg)',
  color: 'var(--v-danger-text)',
  fontFamily: APP_FONT,
  whiteSpace: 'nowrap',
};

export const ShareProjectModal: React.FC<ShareProjectModalProps> = ({
  isOpen,
  vsumId,
  projectName,
  onClose,
  onInvited,
}) => {
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');
  const [members, setMembers] = useState<VsumUserResponse[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<VsumUserResponse | null>(null);

  useModalBodyLock(isOpen);

  const loadMembers = useCallback(async () => {
    if (!vsumId) return;
    setMembersLoading(true);
    try {
      const res = await apiService.getVsumMembers(vsumId);
      const list = parseVsumMembersResponse(res);
      list.sort((a, b) => {
        const aOwner = isOwnerRole(a.role, a.roleEn) ? 0 : 1;
        const bOwner = isOwnerRole(b.role, b.roleEn) ? 0 : 1;
        if (aOwner !== bOwner) return aOwner - bOwner;
        return memberDisplayName(a).localeCompare(memberDisplayName(b));
      });
      setMembers(list);
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to load members');
    } finally {
      setMembersLoading(false);
    }
  }, [vsumId]);

  useEffect(() => {
    if (!isOpen || !vsumId) return;
    setErr('');
    setSuccess('');
    void loadMembers();
  }, [isOpen, vsumId, loadMembers]);

  if (!isOpen || !vsumId) return null;

  const removeAccess = async (member: VsumUserResponse) => {
    const label = memberDisplayName(member);
    const display = label === 'Member' ? (member.email || 'this user') : label;

    try {
      setErr('');
      setSuccess('');
      setRemovingId(member.id);
      await apiService.removeVsumMember(member.id);
      setSuccess(`Access removed for ${display}.`);
      globalThis.dispatchEvent(new CustomEvent('vitruv.refreshVsums'));
      await loadMembers();
      onInvited?.();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to remove access');
    } finally {
      setRemovingId(null);
      setMemberToRemove(null);
    }
  };

  const dialog = (
    <>
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        style={{ ...modalBackdropStyle, zIndex: MODAL_Z_INDEX }}
      />
      <div style={{ ...modalDialogShellStyle, zIndex: MODAL_Z_INDEX + 1, fontFamily: APP_FONT }}>
        <div
          style={{
            pointerEvents: 'auto',
            width: 'min(480px, 92vw)',
            maxHeight: 'min(85vh, 640px)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--v-surface)',
            borderRadius: 14,
            boxShadow: '0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.08)',
            border: '1px solid var(--v-border)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '20px 22px 12px', borderBottom: '1px solid var(--v-border-subtle)', flexShrink: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--v-text)' }}>
              Share project
            </h2>
            {projectName && (
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--v-text-muted)' }}>
                Manage access to <strong style={{ color: 'var(--v-text-secondary)' }}>{projectName}</strong>
              </p>
            )}
          </div>

          <div style={{ padding: '18px 22px', display: 'grid', gap: 16, overflowY: 'auto', flex: 1 }}>
            {err && <div style={errorMessageStyle}>{err}</div>}
            {success && <div style={successMessageStyle}>{success}</div>}

            <AddPeopleSection
              vsumId={vsumId}
              members={members}
              onAdded={async () => { await loadMembers(); onInvited?.(); }}
              onSuccess={setSuccess}
              onError={setErr}
              onClearMessages={() => { setErr(''); setSuccess(''); }}
              autoFocus
            />

            <section style={{ display: 'grid', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--v-text)' }}>People with access</h3>

              {membersLoading && members.length === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--v-text-muted)', fontStyle: 'italic' }}>Loading…</p>
              )}

              {!membersLoading && members.length === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--v-text-muted)', fontStyle: 'italic' }}>No members yet.</p>
              )}

              {members.length > 0 && (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
                  {members.map(m => {
                    const name = memberDisplayName(m);
                    const pending = isPendingMember(m);
                    const owner = isOwnerRole(m.role, m.roleEn);
                    const roleLabel = prettyRole(m.role, m.roleEn);
                    const badge = roleBadge(roleLabel);
                    const canRemove = !owner && removingId !== m.id;

                    return (
                      <li
                        key={m.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid var(--v-border-subtle)',
                          background: 'var(--v-surface-hover)',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--v-text)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {name}
                            {pending && (
                              <span style={{
                                marginLeft: 6,
                                padding: '1px 6px',
                                borderRadius: 20,
                                fontSize: 10,
                                fontWeight: 700,
                                background: 'var(--v-warning-bg)',
                                color: 'var(--v-warning-text)',
                                border: '1px solid var(--v-warning-border)',
                              }}>
                                Pending
                              </span>
                            )}
                          </div>
                          <div style={{
                            fontSize: 11,
                            color: 'var(--v-text-muted)',
                            marginTop: 2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {m.email}
                          </div>
                        </div>

                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                          ...badge,
                        }}>
                          {roleLabel}
                        </span>

                        {!owner && (
                          <button
                            type="button"
                            style={{
                              ...removeBtnStyle,
                              opacity: removingId === m.id ? 0.6 : 1,
                              cursor: canRemove ? 'pointer' : 'wait',
                            }}
                            disabled={!canRemove}
                            onClick={() => setMemberToRemove(m)}
                          >
                            {removingId === m.id ? 'Removing…' : 'Remove access'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <div style={{
            padding: '12px 22px 18px',
            borderTop: '1px solid var(--v-border-subtle)',
            display: 'flex',
            justifyContent: 'flex-end',
            flexShrink: 0,
          }}>
            <ActionButton variant="secondary" size="sm" onClick={onClose}>
              Close
            </ActionButton>
          </div>
        </div>
      </div>
    </>
  );

  const removeLabel = memberToRemove
    ? (() => {
      const name = memberDisplayName(memberToRemove);
      return name === 'Member' ? (memberToRemove.email || 'this user') : name;
    })()
    : '';

  return (
    <>
      {ReactDOM.createPortal(dialog, document.body)}
      <ConfirmDialog
        isOpen={memberToRemove !== null}
        title="Remove access"
        message={removeLabel
          ? `Remove access for ${removeLabel}? They will no longer be able to open this project.`
          : 'Remove this person\'s access to the project?'}
        confirmText="Remove access"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => { if (memberToRemove) void removeAccess(memberToRemove); }}
        onCancel={() => setMemberToRemove(null)}
      />
    </>
  );
};
