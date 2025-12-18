import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { apiService } from '../../services/api';
import { VsumDetails } from '../../types';
import { VsumUsersTab } from './VsumUsersTab';

interface Props {
  isOpen: boolean;
  vsumId: number | null;
  onClose: () => void;
  onSaved?: () => void;
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  // Dim + blur the entire page behind the modal
  background: 'rgba(0,0,0,0.5)',
  backdropFilter: 'blur(3px)',
  width: '100%',
  height: '100%',
  margin: 0,
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};
const dialog: React.CSSProperties = {
  width: 900,
  maxWidth: '95vw',
  maxHeight: '90vh',
  background: '#fff',
  borderRadius: 12,
  // Add a subtle dark edge so the white card is clearly visible on white background
  border: '1px solid #111827',
  boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'Georgia, serif',
};
const header: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: '1px solid #e9ecef',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};
const title: React.CSSProperties = { margin: 0, fontSize: 18, fontWeight: 700, color: '#2c3e50' };
const closeBtn: React.CSSProperties = { border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: '#6c757d' };
const body: React.CSSProperties = { padding: 20, overflowY: 'auto' };
const footer: React.CSSProperties = { padding: '12px 20px', borderTop: '1px solid #e9ecef', display: 'flex', justifyContent: 'space-between', gap: 8 };
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#495057', marginTop: 12, marginBottom: 6 };
const textInput: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13 };

const confirmOverlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
};
const confirmBox: React.CSSProperties = {
  width: 420,
  maxWidth: '90vw',
  background: '#fff',
  borderRadius: 10,
  boxShadow: '0 14px 34px rgba(0,0,0,0.25)',
  overflow: 'hidden',
  fontFamily: 'Georgia, serif',
};
const confirmHeader: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid #f0f0f0',
  fontWeight: 700,
  color: '#1f2937',
};
const confirmBody: React.CSSProperties = {
  padding: '16px',
  color: '#4b5563',
  fontSize: 14,
};
const confirmFooter: React.CSSProperties = {
  padding: '12px 16px',
  borderTop: '1px solid #f0f0f0',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
};

export const VsumDetailsModal: React.FC<Props> = ({ isOpen, vsumId, onClose, onSaved }) => {
  const [details, setDetails] = useState<VsumDetails | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'users' | 'versions'>('details');
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState('');
  const [versions, setVersions] = useState<Array<{ id: number; createdAt: string }>>([]);
  const [recovering, setRecovering] = useState(false);
  const [recoverError, setRecoverError] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = orig;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !vsumId) return;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiService.getVsumDetails(vsumId);
        const d = res.data;
        setDetails(d);
        setName(d.name ?? '');
      } catch (e: any) {
        setError(e?.message || 'Failed to load details');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, vsumId]);

  useEffect(() => {
    if (!isOpen || !vsumId || activeTab !== 'versions') return;
    const loadVersions = async () => {
      setVersionsLoading(true);
      setVersionsError('');
      setSelectedVersionId(null);
      try {
        const res = await apiService.getVsumVersions(vsumId);
        const data = res.data || [];
        setVersions(data);
        if (data.length > 0) {
          // By default, preselect the most recent version (first in list)
          setSelectedVersionId(data[0].id);
        }
      } catch (e: any) {
        setVersionsError(e?.message || 'Failed to load versions');
      } finally {
        setVersionsLoading(false);
      }
    };
    loadVersions();
  }, [isOpen, vsumId, activeTab]);

  const save = async () => {
    if (!vsumId || !details) return;
    setSaving(true);
    setError('');
    try {
      await apiService.renameVsum(vsumId, { name: name.trim() });
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const recover = async () => {
    if (!vsumId) return;
    setRecoverError('');
    setRecovering(true);
    try {
      await apiService.recoverVsum(vsumId);
      onSaved?.();
      onClose();
    } catch (e: any) {
      setRecoverError(e?.response?.data?.message || e?.message || 'Recover failed');
    } finally {
      setRecovering(false);
    }
  };

  const confirmDelete = async () => {
    if (!vsumId) return;
    setDeleteError('');
    setDeleting(true);
    try {
      await apiService.deleteVsum(vsumId);
      setDeleting(false);
      setConfirmOpen(false);
      onSaved?.();
      onClose();
    } catch (e: any) {
      setDeleting(false);
      setDeleteError(e?.response?.data?.message || e?.message || 'Delete failed');
    }
  };

  if (!isOpen) return null;

  const updatedDateOnly = details?.updatedAt
      ? new Date(details.updatedAt).toLocaleDateString()
      : '';

  const renderDetailsContent = (): React.ReactNode => {
    if (loading || !details) {
      return <div style={{ fontStyle: 'italic', color: '#6c757d' }}>Loading…</div>;
    }

    return (
      <>
        <div style={{ fontSize: 12, color: '#6c757d', marginBottom: 10 }}>
          <strong>Updated:</strong> {updatedDateOnly}
        </div>

        <div style={label}>Name</div>
        <input
          style={textInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div style={label}>Meta Models</div>
        {details.metaModels && details.metaModels.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {details.metaModels.map((mm) => (
              <li key={mm.id} style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: '#2c3e50' }}>
                  {mm.name}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ fontSize: 12, color: '#6c757d', fontStyle: 'italic' }}>
            No meta models linked.
          </div>
        )}
      </>
    );
  };

  const renderVersionsContent = () => {
    const selectedVersion = versions.find((v) => v.id === selectedVersionId) ?? null;

    if (versionsLoading) {
      return (
        <div style={{ fontStyle: 'italic', color: '#6c757d' }}>
          Loading versions…
        </div>
      );
    }

    if (versionsError) {
      return (
        <div
          style={{
            marginBottom: 12,
            padding: 10,
            border: '1px solid #f5c6cb',
            background: '#f8d7da',
            color: '#721c24',
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          {versionsError}
        </div>
      );
    }

    if (versions.length === 0) {
      return (
        <div style={{ fontStyle: 'italic', color: '#6c757d' }}>
          No versions found.
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            padding: 10,
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            background: '#f9fafb',
            fontSize: 12,
            color: '#4b5563',
          }}
        >
          <strong style={{ color: '#111827' }}>Version history</strong>
          <div>
            Browse all saved versions of this vSUM. Select a row to quickly move back in time
            and understand how the model evolved.
          </div>
        </div>

        <div
          style={{
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <th
                style={{
                  padding: 8,
                  textAlign: 'left',
                  fontSize: 12,
                  color: '#6b7280',
                  borderBottom: '1px solid #e5e7eb',
                  width: 80,
                }}
              >
                Version #
              </th>
              <th
                style={{
                  padding: 8,
                  textAlign: 'left',
                  fontSize: 12,
                  color: '#6b7280',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                Created at
              </th>
              <th
                style={{
                  padding: 8,
                  textAlign: 'left',
                  fontSize: 12,
                  color: '#6b7280',
                  borderBottom: '1px solid #e5e7eb',
                  width: 120,
                }}
              >
                Selection
              </th>
            </tr>
            </thead>
            <tbody>
            {versions.map((v, index) => {
              const isSelected = v.id === selectedVersionId;
              const isMostRecent = index === 0;
              return (
                <tr
                  key={v.id}
                  onClick={() => setSelectedVersionId(v.id)}
                  style={{
                    cursor: 'pointer',
                    background: isSelected ? '#eff6ff' : '#ffffff',
                    transition: 'background 0.12s ease-in-out',
                  }}
                >
                  <td
                    style={{
                      padding: 8,
                      fontSize: 13,
                      borderTop: '1px solid #e5e7eb',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>v{versions.length - index}</span>
                    {isMostRecent && (
                      <span
                        style={{
                          marginLeft: 6,
                          padding: '2px 6px',
                          borderRadius: 999,
                          background: '#dcfce7',
                          color: '#15803d',
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        Current
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: 8,
                      fontSize: 13,
                      borderTop: '1px solid #e5e7eb',
                    }}
                  >
                    {new Date(v.createdAt).toLocaleString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    })}
                  </td>
                  <td
                    style={{
                      padding: 8,
                      fontSize: 13,
                      borderTop: '1px solid #e5e7eb',
                    }}
                  >
                    <button
                      type="button"
                      style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        border: isSelected ? '1px solid #2563eb' : '1px solid #d1d5db',
                        background: isSelected ? '#2563eb' : '#ffffff',
                        color: isSelected ? '#ffffff' : '#374151',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </button>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>

        {selectedVersion && (
          <div
            style={{
              marginTop: 4,
              padding: 10,
              borderRadius: 8,
              background: '#f9fafb',
              border: '1px dashed #d1d5db',
              fontSize: 12,
              color: '#4b5563',
            }}
          >
            <div style={{ fontWeight: 700, color: '#111827', marginBottom: 4 }}>
              You are looking at version v{versions.length - versions.indexOf(selectedVersion)}.
            </div>
          </div>
        )}
      </div>
    );
  };

  return ReactDOM.createPortal(
      <>
        <dialog open style={overlay} onClose={onClose} onCancel={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <div style={dialog}>
            <div style={header}>
              <h3 style={title}>{details?.name ?? 'VSUM Details'}</h3>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                    onClick={() => setActiveTab('details')}
                    style={{
                      border: '1px solid #dee2e6',
                      background: activeTab === 'details' ? '#e7f5ff' : '#fff',
                      borderRadius: 6,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                >
                  Details
                </button>

                <button
                    onClick={() => setActiveTab('users')}
                    style={{
                      border: '1px solid #dee2e6',
                      background: activeTab === 'users' ? '#e7f5ff' : '#fff',
                      borderRadius: 6,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                >
                  Manage Users
                </button>

                <button
                    onClick={() => setActiveTab('versions')}
                    style={{
                      border: '1px solid #dee2e6',
                      background: activeTab === 'versions' ? '#e7f5ff' : '#fff',
                      borderRadius: 6,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                >
                  Versions
                </button>

                <button aria-label="Close" style={closeBtn} onClick={onClose}>
                  ×
                </button>
              </div>
            </div>

            <div style={body}>
              {error && (
                  <div
                      style={{
                        marginBottom: 12,
                        padding: 10,
                        border: '1px solid #f5c6cb',
                        background: '#f8d7da',
                        color: '#721c24',
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                  >
                    {error}
                  </div>
              )}

              {recoverError && (
                  <div
                      style={{
                        marginBottom: 12,
                        padding: 10,
                        border: '1px solid #f5c6cb',
                        background: '#f8d7da',
                        color: '#721c24',
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                  >
                    {recoverError}
                  </div>
              )}

              {/* ===================== */}
              {/*     DETAILS TAB      */}
              {/* ===================== */}
              {activeTab === 'details' && renderDetailsContent()}

              {/* ===================== */}
              {/*     USERS TAB        */}
              {/* ===================== */}
              {activeTab === 'users' && vsumId && (
                  <VsumUsersTab vsumId={vsumId} onChanged={onSaved} />
              )}

              {/* ===================== */}
              {/*     VERSIONS TAB     */}
              {/* ===================== */}
              {activeTab === 'versions' && renderVersionsContent()}
            </div>

            {/* ===================== */}
            {/*        FOOTER        */}
            {/* ===================== */}
            <div style={footer}>
              <button
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: '1px solid #dee2e6',
                    background: '#fff',
                    color: '#495057',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  onClick={onClose}
              >
                Close
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                {details?.removedAt && (
                    <button
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid #10b981',
                          background: recovering ? '#d1fae5' : '#10b981',
                          color: '#fff',
                          fontWeight: 700,
                          cursor: recovering ? 'not-allowed' : 'pointer',
                          fontSize: 12,
                        }}
                        onDoubleClick={recover}
                        disabled={recovering}
                    >
                      {recovering ? 'Recovering…' : 'Recover (double-click)'}
                    </button>
                )}

                {activeTab === 'details' && !details?.removedAt && (
                    <button
                        style={{
                          padding: '8px 14px',
                          borderRadius: 6,
                          border: '1px solid #fecaca',
                          background: '#fef2f2',
                          color: '#dc2626',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        onClick={() => setConfirmOpen(true)}
                        disabled={!vsumId}
                    >
                      Delete
                    </button>
                )}

                {activeTab === 'details' && (
                    <button
                        style={{
                          padding: '8px 14px',
                          borderRadius: 6,
                          border: 'none',
                          background: '#3498db',
                          color: '#fff',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        onClick={save}
                        disabled={saving}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                )}
              </div>
            </div>
          </div>
        </dialog>

        {/* ===================== */}
        {/*    DELETE CONFIRM     */}
        {/* ===================== */}
        {confirmOpen && (
            <dialog open style={confirmOverlay} onClose={() => setConfirmOpen(false)} onCancel={() => setConfirmOpen(false)} onClick={(e) => { if (e.target === e.currentTarget && !deleting) setConfirmOpen(false); }}>
              <div style={confirmBox}>
                <div style={confirmHeader}>Are you sure?</div>

                <div style={confirmBody}>
                  This action will permanently delete this VSUM and cannot be undone.
                  {deleteError && (
                      <div
                          style={{
                            marginTop: 12,
                            padding: 10,
                            border: '1px solid #f5c6cb',
                            background: '#f8d7da',
                            color: '#721c24',
                            borderRadius: 6,
                            fontSize: 12,
                          }}
                      >
                        {deleteError}
                      </div>
                  )}
                </div>

                <div style={confirmFooter}>
                  <button
                      onClick={() => setConfirmOpen(false)}
                      disabled={deleting}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 6,
                        border: '1px solid #dee2e6',
                        background: '#fff',
                        color: '#374151',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                  >
                    Cancel
                  </button>

                  <button
                      onClick={confirmDelete}
                      disabled={deleting}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 6,
                        border: 'none',
                        background: '#dc2626',
                        color: '#fff',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </dialog>
        )}
      </>,
      document.body
  );
};