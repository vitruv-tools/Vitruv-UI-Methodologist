// src/components/ui/VsumUsersTab.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { apiService, VsumUserResponse } from '../../services/api';
import { AddPeopleSection } from './AddPeopleSection';
import {
  APP_FONT,
  errorMessageStyle,
  successMessageStyle,
} from './sharedStyles';

interface Props {
  vsumId: number;
  onChanged?: () => void;
  /** When false, show member list only (no invite, add, or remove). */
  canManage?: boolean;
}

const wrap: React.CSSProperties = { display: 'grid', gap: 16, fontFamily: APP_FONT };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', userSelect: 'text' };
const thtdBase: React.CSSProperties = { border: '1px solid var(--v-border)', padding: '8px 10px', fontSize: 13, color: 'var(--v-text)' };
const th: React.CSSProperties = { ...thtdBase, fontWeight: 700, textAlign: 'left', background: 'var(--v-table-header)' };
const td: React.CSSProperties = { ...thtdBase, userSelect: 'text' };
const tdCenter: React.CSSProperties = { ...td, textAlign: 'center', userSelect: 'none' };
const dangerBtn: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 12,
  border: '1.5px solid var(--v-danger-border)',
  background: 'var(--v-danger-bg)',
  color: 'var(--v-danger-text)',
  fontFamily: APP_FONT,
};
const sectionCard: React.CSSProperties = {
  padding: 14,
  borderRadius: 10,
  border: '1px solid var(--v-border)',
  background: 'var(--v-surface-muted)',
  display: 'grid',
  gap: 10,
};
const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--v-text)',
};
const pendingBadge: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  marginLeft: 6,
  padding: '2px 7px',
  borderRadius: 20,
  fontSize: 10,
  fontWeight: 700,
  background: 'var(--v-warning-bg)',
  color: 'var(--v-warning-text)',
  border: '1px solid var(--v-warning-border)',
  verticalAlign: 'middle',
};
const roleBadge = (role: string): React.CSSProperties => {
  if (role === 'Owner') {
    return { background: 'var(--v-success-bg)', color: 'var(--v-success-text)', border: '1px solid var(--v-success-border)' };
  }
  if (role === 'Viewer') {
    return { background: 'var(--v-info-bg)', color: 'var(--v-info-text)', border: '1px solid var(--v-info-border)' };
  }
  return { background: 'var(--v-surface-hover)', color: 'var(--v-text-secondary)', border: '1px solid var(--v-border)' };
};

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

const memberDisplayName = (m: VsumUserResponse) => {
  const fullName = [m.firstName, m.lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (isPendingMember(m)) return 'Pending invite';
  return '—';
};

export const VsumUsersTab: React.FC<Props> = ({ vsumId, onChanged, canManage = true }) => {
  const [members, setMembers] = useState<VsumUserResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');

  const clearMessages = () => {
    setErr('');
    setSuccess('');
  };

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getVsumMembers(vsumId);
      setMembers(res.data || []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [vsumId]);

  useEffect(() => { void fetchMembers(); }, [fetchMembers]);

  const removeMember = async (vsumUserId: number) => {
    if (!globalThis.confirm('Remove this user from the VSUM?')) return;
    try {
      clearMessages();
      await apiService.removeVsumMember(vsumUserId);
      await fetchMembers();
      onChanged?.();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Remove member failed');
    }
  };

  return (
    <div style={wrap}>
      {err && <div style={errorMessageStyle}>{err}</div>}
      {success && <div style={successMessageStyle}>{success}</div>}

      {canManage && (
        <AddPeopleSection
          vsumId={vsumId}
          members={members}
          onAdded={async () => { await fetchMembers(); onChanged?.(); }}
          onSuccess={setSuccess}
          onError={setErr}
          onClearMessages={clearMessages}
          style={sectionCard}
        />
      )}

      {/* Members table */}
      <div>
        <h4 style={{ ...sectionTitle, marginBottom: 10 }}>Project access</h4>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Email</th>
              <th style={th}>Role</th>
              {canManage && <th style={{ ...th, width: 120, textAlign: 'center' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={canManage ? 4 : 3} style={{ ...td, fontStyle: 'italic', color: 'var(--v-text-muted)' }}>Loading…</td></tr>
            )}
            {!loading && members.length === 0 && (
              <tr><td colSpan={canManage ? 4 : 3} style={{ ...td, fontStyle: 'italic', color: 'var(--v-text-muted)' }}>No members yet.</td></tr>
            )}
            {!loading && members.length > 0 && members.map(m => {
              const displayName = memberDisplayName(m);
              const pending = isPendingMember(m);
              const owner = isOwnerRole(m.role, m.roleEn);
              const roleLabel = prettyRole(m.role, m.roleEn);
              const badge = roleBadge(roleLabel);
              return (
                <tr key={m.id}>
                  <td style={td} title={displayName}>
                    {displayName}
                    {pending && <span style={pendingBadge}>Pending</span>}
                  </td>
                  <td style={td} title={m.email}>{m.email}</td>
                  <td style={td}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      ...badge,
                    }}>
                      {roleLabel}
                    </span>
                  </td>
                  {canManage && (
                    <td style={tdCenter}>
                      {!owner && (
                        <button type="button" style={dangerBtn} onClick={() => removeMember(m.id)}>
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
