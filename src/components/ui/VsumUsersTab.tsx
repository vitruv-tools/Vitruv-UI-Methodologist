// src/components/ui/VsumUsersTab.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiService, VsumUserResponse, UserSearchItem } from '../../services/api';
import { ActionButton } from './ActionButton';
import {
  APP_FONT,
  errorMessageStyle,
  inputStyle,
  labelStyle,
  successMessageStyle,
} from './sharedStyles';

interface Props {
  vsumId: number;
  onChanged?: () => void;
  /** When false, show member list only (no invite, add, or remove). */
  canManage?: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

const wrap: React.CSSProperties = { display: 'grid', gap: 16, fontFamily: APP_FONT };
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', userSelect: 'text' };
const thtdBase: React.CSSProperties = { border: '1px solid #e9ecef', padding: '8px 10px', fontSize: 13 };
const th: React.CSSProperties = { ...thtdBase, fontWeight: 700, textAlign: 'left', background: '#f8fafc' };
const td: React.CSSProperties = { ...thtdBase, userSelect: 'text' };
const tdCenter: React.CSSProperties = { ...td, textAlign: 'center', userSelect: 'none' };
const dangerBtn: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 12,
  border: '1.5px solid #fecaca',
  background: '#fff5f5',
  color: '#dc2626',
  fontFamily: APP_FONT,
};
const sectionCard: React.CSSProperties = {
  padding: 14,
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  background: '#fafafa',
  display: 'grid',
  gap: 10,
};
const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 700,
  color: '#0f172a',
};
const sectionHint: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: '#64748b',
  lineHeight: 1.45,
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
  background: '#fff7ed',
  color: '#c2410c',
  border: '1px solid #fed7aa',
  verticalAlign: 'middle',
};
const roleBadge = (role: string): React.CSSProperties => {
  if (role === 'Owner') {
    return { background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' };
  }
  if (role === 'Viewer') {
    return { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' };
  }
  return { background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' };
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

const isValidEmail = (email: string): boolean => {
  const trimmed = email.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  const at = trimmed.indexOf('@');
  if (at <= 0 || at !== trimmed.lastIndexOf('@')) return false;
  const domain = trimmed.slice(at + 1);
  const dot = domain.indexOf('.');
  return dot > 0 && dot < domain.length - 1;
};

export const VsumUsersTab: React.FC<Props> = ({ vsumId, onChanged, canManage = true }) => {
  const [members, setMembers] = useState<VsumUserResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<UserSearchItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchItem | null>(null);
  const [adding, setAdding] = useState(false);

  const searchTimer = useRef<number | undefined>(undefined);
  const usersCacheRef = useRef<{ at: number; data: UserSearchItem[] } | null>(null);

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

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const loadUsersForSearch = useCallback(async () => {
    const now = Date.now();
    if (usersCacheRef.current && now - usersCacheRef.current.at < CACHE_TTL_MS) {
      return usersCacheRef.current.data;
    }
    const res = await apiService.searchUsers({ pageNumber: 0, pageSize: 200 });
    const data = res.data || [];
    usersCacheRef.current = { at: now, data };
    return data;
  }, []);

  useEffect(() => {
    if (searchTimer.current) globalThis.clearTimeout(searchTimer.current);

    const q = query.trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      setSelectedUser(null);
      return;
    }

    setSearching(true);
    searchTimer.current = globalThis.setTimeout(async () => {
      try {
        clearMessages();
        const all = await loadUsersForSearch();
        const filtered = all.filter(u => {
          const name = [u.firstName, u.lastName].filter(Boolean).join(' ').toLowerCase();
          const email = (u.email || '').toLowerCase();
          return name.includes(q) || email.includes(q);
        });
        setSearchResults(filtered);
      } catch (e: any) {
        setErr(e?.message || 'Search failed');
      } finally {
        setSearching(false);
      }
    }, 250) as unknown as number;

    return () => {
      if (searchTimer.current) globalThis.clearTimeout(searchTimer.current);
    };
  }, [query, loadUsersForSearch]);

  const inviteViewer = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    if (!isValidEmail(email)) {
      setErr('Please enter a valid email address.');
      setSuccess('');
      return;
    }

    try {
      clearMessages();
      setInviting(true);
      const res = await apiService.inviteVsumViewer(vsumId, { email });
      setInviteEmail('');
      setSuccess(res.message || `Invitation sent to ${email}.`);
      await fetchMembers();
      onChanged?.();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Invite failed');
    } finally {
      setInviting(false);
    }
  };

  const addMember = async () => {
    if (!selectedUser) return;
    try {
      clearMessages();
      setAdding(true);
      await apiService.addVsumMember(vsumId, { userId: Number(selectedUser.id) });
      setSelectedUser(null);
      setQuery('');
      setSearchResults([]);
      setSuccess('Member added successfully.');
      await fetchMembers();
      onChanged?.();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Add member failed');
    } finally {
      setAdding(false);
    }
  };

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

  const canInvite = useMemo(
    () => isValidEmail(inviteEmail) && !inviting,
    [inviteEmail, inviting],
  );
  const canAdd = useMemo(() => Boolean(selectedUser) && !adding, [selectedUser, adding]);

  const userDisplayName = (u: UserSearchItem) => {
    const nameFromFields = [u.firstName, u.lastName].filter(Boolean).join(' ');
    return (('name' in (u as any) ? (u as any).name : undefined) ?? nameFromFields) || u.email;
  };

  return (
    <div style={wrap}>
      {err && <div style={errorMessageStyle}>{err}</div>}
      {success && <div style={successMessageStyle}>{success}</div>}

      {/* Invite viewer */}
      {canManage && <section style={sectionCard}>
        <div>
          <h4 style={sectionTitle}>Invite viewer</h4>
          <p style={sectionHint}>
            Grant read-only access by email. Viewers can open and explore the project but cannot
            edit models, save changes, or invite others. Pending users receive access once they register.
          </p>
        </div>
        <div style={row}>
          <input
            type="email"
            placeholder="viewer@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canInvite) inviteViewer(); }}
            style={{ ...inputStyle, flex: 1, minWidth: 220, margin: 0 }}
            disabled={inviting}
          />
          <ActionButton
            variant="primary"
            size="sm"
            onClick={inviteViewer}
            disabled={!canInvite}
          >
            {inviting ? 'Sending…' : 'Invite viewer'}
          </ActionButton>
        </div>
      </section>}

      {/* Add member */}
      {canManage && <section style={sectionCard}>
        <div>
          <h4 style={sectionTitle}>Add member</h4>
          <p style={sectionHint}>
            Search registered users to grant full member access (edit and collaborate).
          </p>
        </div>
        <label style={{ ...labelStyle, marginBottom: 0 }} htmlFor="vsum-user-search">
          Search by name or email
        </label>
        <div style={row}>
          <input
            id="vsum-user-search"
            placeholder="Search user by name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 220, margin: 0 }}
          />
          <ActionButton
            variant="secondary"
            size="sm"
            onClick={addMember}
            disabled={!canAdd}
          >
            {adding ? 'Adding…' : 'Add member'}
          </ActionButton>
        </div>

        {query && (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
            {searching && (
              <div style={{ padding: 10, fontStyle: 'italic', color: '#64748b', fontSize: 13 }}>Searching…</div>
            )}
            {!searching && searchResults.length === 0 && (
              <div style={{ padding: 10, fontStyle: 'italic', color: '#64748b', fontSize: 13 }}>No users found</div>
            )}
            {!searching && searchResults.length > 0 && (
              <select
                size={Math.min(6, searchResults.length)}
                value={selectedUser ? String(selectedUser.id) : ''}
                onChange={(e) => {
                  const next = searchResults.find(u => String(u.id) === e.target.value) || null;
                  setSelectedUser(next);
                }}
                aria-label="Search results"
                style={{
                  width: '100%',
                  border: 0,
                  padding: 0,
                  maxHeight: 220,
                  overflowY: 'auto',
                  fontSize: 13,
                  fontFamily: APP_FONT,
                }}
              >
                {searchResults.map(u => (
                  <option key={u.id} value={String(u.id)}>
                    {userDisplayName(u)} — {u.email}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {selectedUser && (
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Selected: <strong style={{ color: '#0f172a' }}>{userDisplayName(selectedUser)}</strong> ({selectedUser.email})
          </div>
        )}
      </section>}

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
              <tr><td colSpan={canManage ? 4 : 3} style={{ ...td, fontStyle: 'italic', color: '#64748b' }}>Loading…</td></tr>
            )}
            {!loading && members.length === 0 && (
              <tr><td colSpan={canManage ? 4 : 3} style={{ ...td, fontStyle: 'italic', color: '#64748b' }}>No members yet.</td></tr>
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
