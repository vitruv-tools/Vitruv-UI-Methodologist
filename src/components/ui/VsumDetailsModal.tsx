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
  background: 'rgba(0,0,0,0.35)',
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
      try {
        const res = await apiService.getVsumVersions(vsumId);
        setVersions(res.data || []);
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

  const renderVersionsContent = () => {
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
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th
              style={{
                border: '1px solid #e9ecef',
                padding: 8,
                textAlign: 'left',
                fontSize: 12,
              }}
            >
              #
            </th>
            <th
              style={{
                border: '1px solid #e9ecef',
                padding: 8,
                textAlign: 'left',
                fontSize: 12,
              }}
            >
              Versions
            </th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v, index) => (
            <tr key={v.id}>
              <td
                style={{
                  border: '1px solid #e9ecef',
                  padding: 8,
                  fontSize: 13,
                }}
              >
                {index + 1}
              </td>
              <td
                style={{
                  border: '1px solid #e9ecef',
                  padding: 8,
                  fontSize: 13,
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
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return ReactDOM.createPortal(
      <>
        <div style={overlay} onClick={onClose} role="dialog" aria-modal="true">
          <div style={dialog} onClick={(e) => e.stopPropagation()}>
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
              {activeTab === 'details' ? (
                  loading || !details ? (
                      <div style={{ fontStyle: 'italic', color: '#6c757d' }}>Loading…</div>
                  ) : (
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
                            <div
                                style={{
                                  fontSize: 12,
                                  color: '#6c757d',
                                  fontStyle: 'italic',
                                }}
                            >
                              No meta models linked.
                            </div>
                        )}
                      </>
                  )
              ) : null}

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
        </div>

        {/* ===================== */}
        {/*    DELETE CONFIRM     */}
        {/* ===================== */}
        {confirmOpen && (
            <div style={confirmOverlay} onClick={() => (!deleting ? setConfirmOpen(false) : null)}>
              <div style={confirmBox} onClick={(e) => e.stopPropagation()}>
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
            </div>
        )}
      </>,
      document.body
  );
};