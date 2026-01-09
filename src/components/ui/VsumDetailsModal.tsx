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
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100%',
  background: 'rgba(0,0,0,0.4)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  margin: 0,
  padding: 0,
  border: 'none',
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
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100%',
  background: 'rgba(0,0,0,0.4)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
  margin: 0,
  padding: 0,
  border: 'none',
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
  const [restoringVersionId, setRestoringVersionId] = useState<number | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState<number | null>(null);
  const [restoreError, setRestoreError] = useState('');

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

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    
    return date.toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFullDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString([], {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleRestoreVersion = async (versionId: number) => {
    if (!vsumId) return;
    setRestoreError('');
    setRestoringVersionId(versionId);
    try {
      await apiService.restoreVsumVersion(vsumId, versionId);
      setRestoreConfirmOpen(null);
      onSaved?.();
      // Reload versions to reflect the change
      const res = await apiService.getVsumVersions(vsumId);
      setVersions(res.data || []);
    } catch (e: any) {
      setRestoreError(e?.response?.data?.message || e?.message || 'Failed to restore version');
    } finally {
      setRestoringVersionId(null);
    }
  };

  const renderVersionsContent = () => {
    if (versionsLoading) {
      return (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '40px 20px',
          color: '#6c757d' 
        }}>
          <div style={{ 
            width: 40, 
            height: 40, 
            border: '3px solid #e9ecef', 
            borderTop: '3px solid #3498db', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite',
            marginBottom: 12
          }} />
          <div style={{ fontStyle: 'italic', fontSize: 14 }}>Loading versions…</div>
        </div>
      );
    }

    if (versionsError) {
      return (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            border: '1px solid #f5c6cb',
            background: '#f8d7da',
            color: '#721c24',
            borderRadius: 8,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span>{versionsError}</span>
        </div>
      );
    }

    if (versions.length === 0) {
      return (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '40px 20px',
          color: '#6c757d',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#495057' }}>No versions found</div>
          <div style={{ fontSize: 13 }}>Version history will appear here once versions are created.</div>
        </div>
      );
    }

    // Sort versions by date (newest first)
    const sortedVersions = [...versions].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const currentVersionId = sortedVersions[0]?.id;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {restoreError && (
          <div
            style={{
              padding: 12,
              border: '1px solid #f5c6cb',
              background: '#f8d7da',
              color: '#721c24',
              borderRadius: 8,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span>{restoreError}</span>
            <button
              onClick={() => setRestoreError('')}
              style={{
                marginLeft: 'auto',
                border: 'none',
                background: 'transparent',
                color: '#721c24',
                cursor: 'pointer',
                fontSize: 18,
                lineHeight: 1,
                padding: 0,
                width: 20,
                height: 20,
              }}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        <div style={{ 
          fontSize: 12, 
          color: '#6c757d', 
          marginBottom: 8,
          padding: '8px 12px',
          background: '#f8f9fa',
          borderRadius: 6,
          border: '1px solid #e9ecef'
        }}>
          <strong>Total versions:</strong> {versions.length} • <strong>Current:</strong> Version #{currentVersionId}
        </div>

        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 10,
          maxHeight: '60vh',
          overflowY: 'auto',
          paddingRight: 4,
        }}>
          {sortedVersions.map((v, index) => {
            const isCurrent = v.id === currentVersionId;
            const isRestoring = restoringVersionId === v.id;
            
            return (
              <div
                key={v.id}
                className={isCurrent ? 'version-card-current' : 'version-card-hover'}
                style={{
                  border: isCurrent 
                    ? '2px solid #3498db' 
                    : '1px solid #e9ecef',
                  borderRadius: 10,
                  padding: 16,
                  background: isCurrent 
                    ? '#f0f7ff' 
                    : '#ffffff',
                  boxShadow: isCurrent
                    ? '0 2px 8px rgba(52, 152, 219, 0.15)'
                    : '0 1px 3px rgba(0, 0, 0, 0.08)',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: isCurrent ? '#3498db' : '#6c757d',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 14,
                      }}>
                        {versions.length - index}
                      </div>
                      <div>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 6,
                          marginBottom: 4 
                        }}>
                          <span style={{ 
                            fontWeight: 700, 
                            fontSize: 15, 
                            color: '#2c3e50' 
                          }}>
                            Version #{v.id}
                          </span>
                          {isCurrent && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 8px',
                              borderRadius: 12,
                              background: '#3498db',
                              color: '#fff',
                              fontSize: 11,
                              fontWeight: 600,
                            }}>
                              Current
                            </span>
                          )}
                        </div>
                        <div style={{ 
                          fontSize: 13, 
                          color: '#6c757d',
                          marginBottom: 4
                        }}>
                          {formatRelativeTime(v.createdAt)}
                        </div>
                        <div style={{ 
                          fontSize: 12, 
                          color: '#9ca3af',
                          fontFamily: 'monospace'
                        }}>
                          {formatFullDate(v.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {!isCurrent && (
                    <button
                      onClick={() => setRestoreConfirmOpen(v.id)}
                      disabled={isRestoring || restoringVersionId !== null}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 6,
                        border: '1px solid #3498db',
                        background: isRestoring ? '#bfdbfe' : '#3498db',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: isRestoring || restoringVersionId !== null ? 'not-allowed' : 'pointer',
                        opacity: isRestoring || restoringVersionId !== null ? 0.6 : 1,
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={(e) => {
                        if (!isRestoring && restoringVersionId === null) {
                          e.currentTarget.style.background = '#2980b9';
                          e.currentTarget.style.borderColor = '#2980b9';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isRestoring && restoringVersionId === null) {
                          e.currentTarget.style.background = '#3498db';
                          e.currentTarget.style.borderColor = '#3498db';
                        }
                      }}
                    >
                      {isRestoring ? 'Restoring…' : 'Restore'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return ReactDOM.createPortal(
      <>
        <style>{`
          .version-card-hover:not(.version-card-current):hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12) !important;
            transform: translateY(-2px);
          }
        `}</style>
        <dialog open style={overlay} onClose={onClose} onCancel={onClose}>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              zIndex: 0,
            }}
          />
          <div style={{ ...dialog, position: 'relative', zIndex: 1 }} onClick={(e) => e.stopPropagation()}>
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
            <dialog open style={confirmOverlay} onClose={() => setConfirmOpen(false)} onCancel={() => setConfirmOpen(false)}>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => { if (!deleting) setConfirmOpen(false); }}
                disabled={deleting}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  background: 'transparent',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  zIndex: 0,
                }}
              />
              <div style={{ ...confirmBox, position: 'relative', zIndex: 1 }} onClick={(e) => e.stopPropagation()}>
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

        {/* ===================== */}
        {/*   RESTORE CONFIRM     */}
        {/* ===================== */}
        {restoreConfirmOpen !== null && (
            <dialog open style={confirmOverlay} onClose={() => setRestoreConfirmOpen(null)} onCancel={() => setRestoreConfirmOpen(null)}>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => { if (!restoringVersionId) setRestoreConfirmOpen(null); }}
                disabled={restoringVersionId !== null}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  background: 'transparent',
                  cursor: restoringVersionId !== null ? 'not-allowed' : 'pointer',
                  zIndex: 0,
                }}
              />
              <div style={{ ...confirmBox, position: 'relative', zIndex: 1 }} onClick={(e) => e.stopPropagation()}>
                <div style={confirmHeader}>Restore to this version?</div>

                <div style={confirmBody}>
                  This will restore the VSUM to the selected version. The current version will be saved as a new version in the history.
                  {restoreError && (
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
                        {restoreError}
                      </div>
                  )}
                </div>

                <div style={confirmFooter}>
                  <button
                      onClick={() => {
                        setRestoreConfirmOpen(null);
                        setRestoreError('');
                      }}
                      disabled={restoringVersionId !== null}
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
                      onClick={() => handleRestoreVersion(restoreConfirmOpen)}
                      disabled={restoringVersionId !== null}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 6,
                        border: 'none',
                        background: '#3498db',
                        color: '#fff',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                  >
                    {restoringVersionId === restoreConfirmOpen ? 'Restoring…' : 'Restore'}
                  </button>
                </div>
              </div>
            </dialog>
        )}
      </>,
      document.body
  );
};