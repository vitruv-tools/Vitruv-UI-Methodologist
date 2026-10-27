import React, { useEffect, useId, useRef, useState } from 'react';
import { apiService, UserSearchItem, VsumUserResponse } from '../../services/api';
import { ActionButton } from './ActionButton';
import { APP_FONT, inputStyle, labelStyle } from './sharedStyles';

/** Role a person is added with. */
type AddPeopleRole = 'VIEWER' | 'MEMBER';

interface AddPeopleSectionProps {
  vsumId: number;
  /** People who already have access; they are not suggested as members. */
  members: VsumUserResponse[];
  /** Called after someone was invited or added, e.g. to reload the member list. */
  onAdded: () => void | Promise<void>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  /** Called before a new action, so old messages can be cleared. */
  onClearMessages: () => void;
  autoFocus?: boolean;
  /** Style of the surrounding section, e.g. a card. */
  style?: React.CSSProperties;
}

const isValidEmail = (email: string): boolean => {
  const trimmed = email.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  const at = trimmed.indexOf('@');
  if (at <= 0 || at !== trimmed.lastIndexOf('@')) return false;
  const domain = trimmed.slice(at + 1);
  const dot = domain.indexOf('.');
  return dot > 0 && dot < domain.length - 1;
};

const userDisplayName = (u: UserSearchItem) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email;

const mutedText: React.CSSProperties = {
  margin: 0,
  padding: 10,
  fontSize: 13,
  color: 'var(--v-text-muted)',
  fontStyle: 'italic',
};

/**
 * "Add people" form shared by the Share dialog and the project details: invite a viewer by
 * email, or search a registered user and add them as a member.
 */
export const AddPeopleSection: React.FC<AddPeopleSectionProps> = ({
  vsumId,
  members,
  onAdded,
  onSuccess,
  onError,
  onClearMessages,
  autoFocus = false,
  style,
}) => {
  const id = useId();
  const [role, setRole] = useState<AddPeopleRole>('VIEWER');
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<UserSearchItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchItem | null>(null);
  const [adding, setAdding] = useState(false);
  /** Registered users, loaded once while the section is shown. */
  const usersRef = useRef<UserSearchItem[] | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Search registered users for "Member"; people who already have access are left out.
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (role !== 'MEMBER' || !q) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    setSearching(true);
    const timer = globalThis.setTimeout(async () => {
      try {
        if (!usersRef.current) {
          const res = await apiService.searchUsers({ pageNumber: 0, pageSize: 200 });
          usersRef.current = res.data || [];
        }
        if (cancelled) return;
        const withAccess = new Set(members.map(m => (m.email || '').toLowerCase()));
        setSearchResults(usersRef.current.filter(u => {
          const userEmail = (u.email || '').toLowerCase();
          if (withAccess.has(userEmail)) return false;
          return userDisplayName(u).toLowerCase().includes(q) || userEmail.includes(q);
        }));
      } catch (e: any) {
        if (!cancelled) onErrorRef.current(e?.response?.data?.message || e?.message || 'Search failed');
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, [role, query, members]);

  const canInvite = isValidEmail(email) && !inviting;
  const canAddMember = selectedUser !== null && !adding;

  const changeRole = (next: AddPeopleRole) => {
    setRole(next);
    onClearMessages();
  };

  const invite = async () => {
    const trimmed = email.trim();
    onClearMessages();
    if (!isValidEmail(trimmed)) {
      onError('Please enter a valid email address.');
      return;
    }

    try {
      setInviting(true);
      const res = await apiService.inviteVsumViewer(vsumId, { email: trimmed });
      setEmail('');
      onSuccess(res.message || `Invitation sent to ${trimmed}.`);
      await onAdded();
    } catch (e: any) {
      onError(e?.response?.data?.message || e?.message || 'Invite failed');
    } finally {
      setInviting(false);
    }
  };

  const addMember = async () => {
    if (!selectedUser) return;
    const name = userDisplayName(selectedUser);
    onClearMessages();

    try {
      setAdding(true);
      await apiService.addVsumMember(vsumId, { userId: Number(selectedUser.id) });
      setQuery('');
      setSelectedUser(null);
      onSuccess(`${name} was added as a member.`);
      await onAdded();
    } catch (e: any) {
      onError(e?.response?.data?.message || e?.message || 'Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  const inputId = `${id}-${role === 'VIEWER' ? 'email' : 'search'}`;

  return (
    <section style={{ display: 'grid', gap: 10, ...style }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--v-text)' }}>Add people</h3>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--v-text-muted)', lineHeight: 1.5 }}>
          {role === 'VIEWER'
            ? 'Send a read-only invite by email. Viewers can open and explore the project but cannot edit or invite others. Pending users get access once they register.'
            : 'Add a registered user as a member. Members can edit the project and collaborate on it.'}
        </p>
      </div>

      <label style={{ ...labelStyle, marginBottom: 0 }} htmlFor={inputId}>
        {role === 'VIEWER' ? 'Email address' : 'Search by name or email'}
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <select
            aria-label="Add as"
            value={role}
            onChange={e => changeRole(e.target.value as AddPeopleRole)}
            disabled={inviting || adding}
            style={{
              ...inputStyle,
              width: 'auto',
              margin: 0,
              paddingRight: 34,
              cursor: 'pointer',
              appearance: 'none',
              WebkitAppearance: 'none',
            }}
          >
            <option value="VIEWER">Viewer</option>
            <option value="MEMBER">Member</option>
          </select>
          {/* Own chevron: the native arrow sits right at the border. 12px from the
              edge, like the text's left padding. */}
          <svg
            aria-hidden="true"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: 'var(--v-text-muted)',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        {role === 'VIEWER' ? (
          <>
            <input
              id={inputId}
              type="email"
              placeholder="viewer@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canInvite) void invite(); }}
              style={{ ...inputStyle, flex: 1, minWidth: 180, margin: 0 }}
              disabled={inviting}
              autoFocus={autoFocus}
            />
            <ActionButton variant="primary" size="sm" onClick={invite} disabled={!canInvite}>
              {inviting ? 'Sending…' : 'Invite viewer'}
            </ActionButton>
          </>
        ) : (
          <>
            <input
              id={inputId}
              placeholder="Name or email…"
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedUser(null); }}
              style={{ ...inputStyle, flex: 1, minWidth: 180, margin: 0 }}
              disabled={adding}
              autoFocus={autoFocus}
            />
            <ActionButton variant="primary" size="sm" onClick={addMember} disabled={!canAddMember}>
              {adding ? 'Adding…' : 'Add member'}
            </ActionButton>
          </>
        )}
      </div>

      {role === 'MEMBER' && query.trim() && (
        <div style={{ border: '1px solid var(--v-border)', borderRadius: 8, overflow: 'hidden' }}>
          {searching && <p style={mutedText}>Searching…</p>}
          {!searching && searchResults.length === 0 && <p style={mutedText}>No matching users</p>}
          {!searching && searchResults.length > 0 && (
            <div role="listbox" aria-label="Matching users" style={{ maxHeight: 200, overflowY: 'auto' }}>
              {searchResults.map(u => {
                const selected = selectedUser?.id === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => setSelectedUser(u)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      border: 0,
                      borderBottom: '1px solid var(--v-border-subtle)',
                      background: selected ? 'var(--v-info-bg)' : 'var(--v-surface)',
                      cursor: 'pointer',
                      fontFamily: APP_FONT,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v-text)' }}>{userDisplayName(u)}</div>
                    <div style={{ fontSize: 11, color: 'var(--v-text-muted)', marginTop: 2 }}>{u.email}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
