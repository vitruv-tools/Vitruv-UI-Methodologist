import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { apiService, VsumUserResponse } from '../../services/api';
import { memberDisplayName, parseVsumMembersResponse } from '../../utils/vsumMemberUtils';
import { ActionButton } from './ActionButton';
import { ConfirmDialog } from './ConfirmDialog';
import { MODAL_Z_INDEX, modalBackdropStyle, modalDialogShellStyle, useModalBodyLock } from './modalUtils';
import { APP_FONT, errorMessageStyle, inputStyle, labelStyle, successMessageStyle } from './sharedStyles';

interface ShareProjectModalProps {
  isOpen: boolean;
  vsumId?: number;
  projectName?: string;
  onClose: () => void;
  onInvited?: () => void;
}

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

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
    return { background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' };
  }
  if (role === 'Viewer') {
    return { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' };
  }
  return { background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' };
};

const removeBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 11,
  border: '1px solid #fecaca',
  background: '#fff5f5',
  color: '#dc2626',
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
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
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
    setEmail('');
    setErr('');
    setSuccess('');
    void loadMembers();
  }, [isOpen, vsumId, loadMembers]);

  if (!isOpen || !vsumId) return null;

  const canInvite = isValidEmail(email) && !inviting;

  const invite = async () => {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setErr('Please enter a valid email address.');
      setSuccess('');
      return;
    }

    try {
      setErr('');
      setInviting(true);
      const res = await apiService.inviteVsumViewer(vsumId, { email: trimmed });
      setEmail('');
      setSuccess(res.message || `Invitation sent to ${trimmed}.`);
      await loadMembers();
      onInvited?.();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Invite failed');
      setSuccess('');
    } finally {
      setInviting(false);
    }
  };

  const removeAccess = async (member: VsumUserResponse) => {
    const label = memberDisplayName(member);
    const display = label !== 'Member' ? label : (member.email || 'this user');

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
            background: '#fff',
            borderRadius: 14,
            boxShadow: '0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.08)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '20px 22px 12px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
              Share project
            </h2>
            {projectName && (
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>
                Manage access to <strong style={{ color: '#334155' }}>{projectName}</strong>
              </p>
            )}
          </div>

          <div style={{ padding: '18px 22px', display: 'grid', gap: 16, overflowY: 'auto', flex: 1 }}>
            {err && <div style={errorMessageStyle}>{err}</div>}
            {success && <div style={successMessageStyle}>{success}</div>}

            <section style={{ display: 'grid', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Invite viewer</h3>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                  Send a read-only invite by email. Viewers can open and explore the project but cannot
                  edit or invite others. Pending users get access once they register.
                </p>
              </div>

              <label style={{ ...labelStyle, marginBottom: 0 }} htmlFor="share-invite-email">
                Email address
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  id="share-invite-email"
                  type="email"
                  placeholder="viewer@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && canInvite) invite(); }}
                  style={{ ...inputStyle, flex: 1, minWidth: 200, margin: 0 }}
                  disabled={inviting}
                  autoFocus
                />
                <ActionButton variant="primary" size="sm" onClick={invite} disabled={!canInvite}>
                  {inviting ? 'Sending…' : 'Invite viewer'}
                </ActionButton>
              </div>
            </section>

            <section style={{ display: 'grid', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>People with access</h3>

              {membersLoading && members.length === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>Loading…</p>
              )}

              {!membersLoading && members.length === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>No members yet.</p>
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
                          border: '1px solid #f1f5f9',
                          background: '#fafafa',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#0f172a',
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
                                background: '#fff7ed',
                                color: '#c2410c',
                                border: '1px solid #fed7aa',
                              }}>
                                Pending
                              </span>
                            )}
                          </div>
                          <div style={{
                            fontSize: 11,
                            color: '#64748b',
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
            borderTop: '1px solid #f1f5f9',
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
      return name !== 'Member' ? name : (memberToRemove.email || 'this user');
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
