// src/components/ui/VsumUsersTab.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiService, VsumUserResponse, UserSearchItem } from '../../services/api';

interface Props {
  vsumId: number;
  onChanged?: () => void;
}

const wrap: React.CSSProperties = { display: 'grid', gap: 12 };
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const thtd: React.CSSProperties = { border: '1px solid #e9ecef', padding: '8px', fontSize: 13 };
const btn: React.CSSProperties = { padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 };
const dangerBtn: React.CSSProperties = { ...btn, border: '1px solid #ffc9c9', background: '#fff5f5', color: '#e03131' };
const primaryBtn: React.CSSProperties = { ...btn, border: 'none', background: '#3498db', color: '#fff' };
const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid #dee2e6', fontSize: 13, flex: 1 };

// role helpers (non-hooks; ok at top level)
const isOwnerRole = (role?: string) => role === 'OWNER';
const prettyRole  = (role?: string) => role === 'OWNER' ? 'Owner' : 'Member';

export const VsumUsersTab: React.FC<Props> = ({ vsumId, onChanged }) => {
  const [members, setMembers] = useState<VsumUserResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // search/add UI
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<UserSearchItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchItem | null>(null);

  // --- caching objects MUST be inside the component (hooks rule) ---
  const searchTimer = useRef<number | undefined>(undefined);
  const usersCacheRef = useRef<{ at: number; data: UserSearchItem[] } | null>(null);
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // ---------- Fetch members ----------
  const fetchMembers = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      const res = await apiService.getVsumMembers(vsumId);              // [FETCH_MEMBERS]
      setMembers(res.data || []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [vsumId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // ---------- Load users for search (cached with TTL) ----------
  const loadUsersForSearch = useCallback(async () => {
    const now = Date.now();
    if (usersCacheRef.current && now - usersCacheRef.current.at < CACHE_TTL_MS) {
      return usersCacheRef.current.data;
    }
    const res = await apiService.searchUsers({ pageNumber: 0, pageSize: 200 }); // cached backend list
    const data = res.data || [];
    usersCacheRef.current = { at: now, data };
    return data;
  }, []);

  // ---------- Debounced user search (client-side filtering + cache) ----------
  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);

    const q = query.trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      setSelectedUser(null);
      return;
    }

    setSearching(true);
    searchTimer.current = window.setTimeout(async () => {
      try {
        setErr('');
        const all = await loadUsersForSearch(); // uses cache + TTL
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
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [query, loadUsersForSearch]);

  // ---------- Add member (server defaults to MEMBER) ----------
  const addMember = async () => {
    if (!selectedUser) return;
    try {
      setErr('');
      await apiService.addVsumMember(vsumId, { userId: Number(selectedUser.id) }); // [ADD_MEMBER]
      setSelectedUser(null);
      setQuery('');
      setSearchResults([]);
      await fetchMembers();
      onChanged?.();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Add member failed');
    }
  };

  // ---------- Remove member (only for MEMBER) ----------
  const removeMember = async (vsumUserId: number) => {
    if (!window.confirm('Remove this member from the vSUM?')) return;
    try {
      setErr('');
      await apiService.removeVsumMember(vsumUserId);                     // [REMOVE_MEMBER]
      await fetchMembers();
      onChanged?.();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Remove member failed');
    }
  };

  const canAdd = useMemo(() => Boolean(selectedUser), [selectedUser]);

  const userDisplayName = (u: UserSearchItem) => {
    const nameFromFields = [u.firstName, u.lastName].filter(Boolean).join(' ');
    return (('name' in (u as any) ? (u as any).name : undefined) ?? nameFromFields) || u.email;
  };

  return (
      <div style={wrap}>
        {err && (
            <div style={{ padding: 10, border: '1px solid #f5c6cb', background: '#f8d7da', color: '#721c24', borderRadius: 6, fontSize: 12 }}>
              {err}
            </div>
        )}

        {/* Add member (no role selector) */}
        <div style={{ ...row, flexWrap: 'wrap' }}>
          <input
              placeholder="Search user by name or email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ ...input, minWidth: 280 }}
          />
          <button
              onClick={addMember}
              disabled={!canAdd}
              style={{ ...primaryBtn, opacity: canAdd ? 1 : 0.6 }}
              title={!canAdd ? 'Pick a user from search first' : 'Add member'}
          >
            Add member
          </button>
        </div>

        {/* Search dropdown */}
        {query && (
            <div style={{ border: '1px solid #e9ecef', borderRadius: 6, overflow: 'hidden' }}>
              {searching ? (
                  <div style={{ padding: 8, fontStyle: 'italic', color: '#6c757d' }}>Searching…</div>
              ) : searchResults.length === 0 ? (
                  <div style={{ padding: 8, fontStyle: 'italic', color: '#6c757d' }}>No users found</div>
              ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 220, overflowY: 'auto' }}>
                    {searchResults.map(u => (
                        <li
                            key={u.id}
                            onClick={() => setSelectedUser(u)}
                            style={{
                              padding: '8px 10px',
                              cursor: 'pointer',
                              background: selectedUser?.id === u.id ? '#e7f5ff' : '#fff',
                              borderBottom: '1px solid #f1f3f5'
                            }}
                            title="Click to select this user"
                        >
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{userDisplayName(u)}</div>
                          <div style={{ fontSize: 12, color: '#6c757d' }}>{u.email}</div>
                        </li>
                    ))}
                  </ul>
              )}
            </div>
        )}

        {/* Selected preview */}
        {selectedUser && (
            <div style={{ fontSize: 12, color: '#6c757d' }}>
              Selected: <strong>{userDisplayName(selectedUser)}</strong> ({selectedUser.email})
            </div>
        )}

        {/* Members table */}
        <div style={{ marginTop: 8 }}>
          <table style={table}>
            <thead>
            <tr>
              <th style={{ ...thtd, textAlign: 'left' }}>Name</th>
              <th style={{ ...thtd, textAlign: 'left' }}>Email</th>
              <th style={{ ...thtd, textAlign: 'left' }}>Role</th>
              <th style={{ ...thtd, width: 120 }}>Actions</th>
            </tr>
            </thead>
            <tbody>
            {loading ? (
                <tr><td colSpan={4} style={{ ...thtd, fontStyle: 'italic', color: '#6c757d' }}>Loading…</td></tr>
            ) : members.length === 0 ? (
                <tr><td colSpan={4} style={{ ...thtd, fontStyle: 'italic', color: '#6c757d' }}>No members yet.</td></tr>
            ) : (
                members.map(m => {
                  const fullName = [m.firstName, m.lastName].filter(Boolean).join(' ') || '—';
                  const owner = isOwnerRole(m.role);
                  return (
                      <tr key={m.id}>
                        <td style={thtd}>{fullName}</td>
                        <td style={thtd}>{m.email}</td>
                        <td style={thtd}>{prettyRole(m.role)}</td>
                        <td style={{ ...thtd, textAlign: 'center' }}>
                          {!owner && (
                              <button style={dangerBtn} onClick={() => removeMember(m.id)}>
                                Remove
                              </button>
                          )}
                        </td>
                      </tr>
                  );
                })
            )}
            </tbody>
          </table>
        </div>
      </div>
  );
};