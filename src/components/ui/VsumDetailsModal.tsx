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

// Helper Components
interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    style={{
      border: isActive ? 'none' : '1px solid #dee2e6',
      background: isActive ? '#049484' : '#fff',
      color: isActive ? '#fff' : '#495057',
      borderRadius: 8,
      padding: '8px 16px',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: 13,
      fontFamily: 'Georgia, serif',
      transition: 'all 0.2s ease',
      boxShadow: isActive ? '0 2px 8px rgba(4, 148, 132, 0.3)' : 'none',
    }}
  >
    {label}
  </button>
);

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  variant: 'primary' | 'secondary' | 'danger' | 'success';
  disabled?: boolean;
  onDoubleClick?: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({ 
  label, 
  onClick, 
  variant, 
  disabled = false,
  onDoubleClick 
}) => {
  const getVariantStyles = () => {
    const baseStyle = {
      padding: '10px 20px',
      borderRadius: 8,
      fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: 14,
      fontFamily: 'Georgia, serif',
      transition: 'all 0.2s ease',
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          border: 'none',
          background: 'linear-gradient(135deg, #049484 0%, #037368 100%)',
          color: '#fff',
          boxShadow: '0 2px 8px rgba(4, 148, 132, 0.3)',
          padding: '10px 24px',
        };
      case 'danger':
        return {
          ...baseStyle,
          border: '1px solid #dc2626',
          background: '#fef2f2',
          color: '#dc2626',
        };
      case 'success':
        return {
          ...baseStyle,
          border: '1px solid #10b981',
          background: disabled ? '#d1fae5' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#fff',
          boxShadow: disabled ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.3)',
        };
      case 'secondary':
      default:
        return {
          ...baseStyle,
          border: '1px solid #dee2e6',
          background: '#fff',
          color: '#495057',
        };
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    
    switch (variant) {
      case 'primary':
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(4, 148, 132, 0.4)';
        break;
      case 'danger':
        e.currentTarget.style.background = '#dc2626';
        e.currentTarget.style.color = '#fff';
        break;
      case 'secondary':
        e.currentTarget.style.background = '#f8f9fa';
        e.currentTarget.style.borderColor = '#adb5bd';
        break;
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    
    switch (variant) {
      case 'primary':
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(4, 148, 132, 0.3)';
        break;
      case 'danger':
        e.currentTarget.style.background = '#fef2f2';
        e.currentTarget.style.color = '#dc2626';
        break;
      case 'secondary':
        e.currentTarget.style.background = '#fff';
        e.currentTarget.style.borderColor = '#dee2e6';
        break;
    }
  };

  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      disabled={disabled}
      style={getVariantStyles()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {label}
    </button>
  );
};

interface ConfirmButtonProps {
  label: string;
  onClick: () => void;
  variant: 'confirm' | 'cancel';
  disabled?: boolean;
  accent: {
    disabledBg: string;
    gradient: string;
    shadow: string;
    shadowHover: string;
  };
}

const ConfirmButton: React.FC<ConfirmButtonProps> = ({ label, onClick, variant, disabled = false, accent }) => {
  const isConfirm = variant === 'confirm';
  
  const getBackgroundColor = () => {
    if (!isConfirm) return '#fff';
    return disabled ? accent.disabledBg : accent.gradient;
  };

  const getBoxShadow = () => {
    if (!isConfirm) return 'none';
    return disabled ? 'none' : accent.shadow;
  };

  const style: React.CSSProperties = {
    padding: '10px 24px',
    borderRadius: 8,
    border: isConfirm ? 'none' : '1px solid #dee2e6',
    background: getBackgroundColor(),
    color: isConfirm ? '#fff' : '#495057',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 14,
    fontFamily: 'Georgia, serif',
    transition: 'all 0.2s ease',
    boxShadow: getBoxShadow(),
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (isConfirm) {
      e.currentTarget.style.transform = 'translateY(-1px)';
      e.currentTarget.style.boxShadow = accent.shadowHover;
    } else {
      e.currentTarget.style.background = '#f8f9fa';
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isConfirm) {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = accent.shadow;
    } else {
      e.currentTarget.style.background = '#fff';
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {label}
    </button>
  );
};

const dangerAccent = {
  disabledBg: '#fca5a5',
  gradient: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
  shadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
  shadowHover: '0 4px 12px rgba(220, 38, 38, 0.4)',
};

const successAccent = {
  disabledBg: '#a5d6d3',
  gradient: 'linear-gradient(135deg, #049484 0%, #037368 100%)',
  shadow: '0 2px 8px rgba(4, 148, 132, 0.3)',
  shadowHover: '0 4px 12px rgba(4, 148, 132, 0.4)',
};

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
  boxShadow: '0 20px 60px rgba(4, 148, 132, 0.15), 0 10px 30px rgba(0, 0, 0, 0.1)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'Georgia, serif',
  border: '1px solid #e3f2fd',
};
const header: React.CSSProperties = {
  padding: '20px 24px',
  borderBottom: '2px solid #049484',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: 'linear-gradient(135deg, #f8fcff 0%, #e8f4f8 100%)',
};
const title: React.CSSProperties = { margin: 0, fontSize: 20, fontWeight: 700, color: '#2c3e50', letterSpacing: '0.01em' };
const closeBtn: React.CSSProperties = { border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: '#6c757d' };
const body: React.CSSProperties = { padding: 20, overflowY: 'auto' };
const footer: React.CSSProperties = { padding: '12px 20px', borderTop: '1px solid #e9ecef', display: 'flex', justifyContent: 'space-between', gap: 8 };
const label: React.CSSProperties = { 
  fontSize: 13, 
  fontWeight: 700, 
  color: '#2c3e50', 
  marginTop: 16, 
  marginBottom: 8,
  fontFamily: 'Georgia, serif',
  letterSpacing: '0.01em',
};
const textInput: React.CSSProperties = { 
  width: '100%', 
  padding: '12px 14px', 
  border: '2px solid #e9ecef', 
  borderRadius: 8, 
  fontSize: 14,
  outline: 'none',
  transition: 'all 0.2s ease',
  fontFamily: 'Georgia, serif',
  background: '#f8f9fa',
};

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
  width: 460,
  maxWidth: '90vw',
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 20px 60px rgba(4, 148, 132, 0.15), 0 10px 30px rgba(0, 0, 0, 0.1)',
  overflow: 'hidden',
  fontFamily: 'Georgia, serif',
  border: '1px solid #e3f2fd',
};
const confirmHeader: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: '2px solid #049484',
  fontWeight: 700,
  color: '#2c3e50',
  fontSize: 18,
  background: 'linear-gradient(135deg, #f8fcff 0%, #e8f4f8 100%)',
};
const confirmBody: React.CSSProperties = {
  padding: '20px',
  color: '#495057',
  fontSize: 14,
  lineHeight: 1.6,
};
const confirmFooter: React.CSSProperties = {
  padding: '16px 20px',
  borderTop: '1px solid #e9ecef',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  background: '#f8f9fa',
};

// Error Message Component
interface ErrorMessageProps {
  message: string;
  onDismiss?: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onDismiss }) => (
  <div
    style={{
      marginBottom: 12,
      padding: onDismiss ? 12 : 10,
      border: '1px solid #f5c6cb',
      background: '#f8d7da',
      color: '#721c24',
      borderRadius: 8,
      fontSize: onDismiss ? 13 : 12,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}
  >
    {onDismiss && <span style={{ fontSize: 16 }}>⚠️</span>}
    <span>{message}</span>
    {onDismiss && (
      <button
        onClick={onDismiss}
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
    )}
  </div>
);

// Version Restore Button Component
interface VersionRestoreButtonProps {
  versionId: number;
  isRestoring: boolean;
  isAnyRestoring: boolean;
  onClick: () => void;
}

const VersionRestoreButton: React.FC<VersionRestoreButtonProps> = ({ 
  versionId, 
  isRestoring, 
  isAnyRestoring, 
  onClick 
}) => {
  const isDisabled = isRestoring || isAnyRestoring;
  
  const style: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid #049484',
    background: isRestoring ? '#bfdbfe' : '#049484',
    color: '#fff',
    fontWeight: 600,
    fontSize: 13,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.6 : 1,
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isDisabled) {
      e.currentTarget.style.background = '#2980b9';
      e.currentTarget.style.borderColor = '#2980b9';
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isDisabled) {
      e.currentTarget.style.background = '#049484';
      e.currentTarget.style.borderColor = '#049484';
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isRestoring ? 'Restoring…' : 'Restore'}
    </button>
  );
};

// Helper functions for date formatting
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

// Version Card Component
interface VersionCardProps {
  version: { id: number; createdAt: string };
  index: number;
  totalVersions: number;
  isCurrent: boolean;
  isRestoring: boolean;
  restoringVersionId: number | null;
  onRestore: (versionId: number) => void;
}

const VersionCard: React.FC<VersionCardProps> = ({
  version,
  index,
  totalVersions,
  isCurrent,
  isRestoring,
  restoringVersionId,
  onRestore,
}) => {
  return (
    <div
      className={isCurrent ? 'version-card-current' : 'version-card-hover'}
      style={{
        border: isCurrent ? '2px solid #049484' : '1px solid #e9ecef',
        borderRadius: 10,
        padding: 16,
        background: isCurrent ? '#f0f7ff' : '#ffffff',
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
              background: isCurrent ? '#049484' : '#6c757d',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
            }}>
              {totalVersions - index}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#2c3e50' }}>
                  Version #{version.id}
                </span>
                {isCurrent && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: '#049484',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 600,
                  }}>
                    Current
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: '#6c757d', marginBottom: 4 }}>
                {formatRelativeTime(version.createdAt)}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>
                {formatFullDate(version.createdAt)}
              </div>
            </div>
          </div>
        </div>
        {!isCurrent && (
          <VersionRestoreButton
            versionId={version.id}
            isRestoring={isRestoring}
            isAnyRestoring={restoringVersionId !== null}
            onClick={() => onRestore(version.id)}
          />
        )}
      </div>
    </div>
  );
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
      // Notify that VSUM was deleted so open tabs can be closed
      globalThis.dispatchEvent(new CustomEvent('vitruv.vsumDeleted', { detail: { id: vsumId } }));
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
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#049484';
            e.currentTarget.style.background = '#ffffff';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(4, 148, 132, 0.1)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#e9ecef';
            e.currentTarget.style.background = '#f8f9fa';
            e.currentTarget.style.boxShadow = 'none';
          }}
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

  const handleRestoreVersion = async (versionId: number) => {
    if (!vsumId) return;
    setRestoreError('');
    setRestoringVersionId(versionId);
    try {
      await apiService.restoreVsumVersion(vsumId, versionId);
      setRestoreConfirmOpen(null);
      onSaved?.();
      
      // Reload both details and versions to reflect the change
      const [detailsRes, versionsRes] = await Promise.all([
        apiService.getVsumDetails(vsumId),
        apiService.getVsumVersions(vsumId)
      ]);
      
      setDetails(detailsRes.data);
      setName(detailsRes.data.name ?? '');
      setVersions(versionsRes.data || []);
      
      // Notify workspace to reload if this VSUM is currently open
      globalThis.dispatchEvent(new CustomEvent('vitruv.vsumRestored', { detail: { id: vsumId } }));
    } catch (e: any) {
      setRestoreError(e?.response?.data?.message || e?.message || 'Failed to restore version');
    } finally {
      setRestoringVersionId(null);
    }
  };

  const renderFooterActions = () => {
    const showRecover = details?.removedAt;
    const showDelete = activeTab === 'details' && !details?.removedAt;
    const showSave = activeTab === 'details';

    return (
      <>
        {showRecover && (
          <ActionButton
            label={recovering ? 'Recovering…' : 'Recover (double-click)'}
            onClick={() => {}}
            onDoubleClick={recover}
            variant="success"
            disabled={recovering}
          />
        )}
        {showDelete && (
          <ActionButton
            label="Delete"
            onClick={() => setConfirmOpen(true)}
            variant="danger"
            disabled={!vsumId}
          />
        )}
        {showSave && (
          <ActionButton
            label={saving ? 'Saving…' : 'Save'}
            onClick={save}
            variant="primary"
            disabled={saving}
          />
        )}
      </>
    );
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
            borderTop: '3px solid #049484', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite',
            marginBottom: 12
          }} />
          <div style={{ fontStyle: 'italic', fontSize: 14 }}>Loading versions…</div>
        </div>
      );
    }

    if (versionsError) {
      return <ErrorMessage message={versionsError} onDismiss={() => setVersionsError('')} />;
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
        {restoreError && <ErrorMessage message={restoreError} onDismiss={() => setRestoreError('')} />}

        <div style={{ 
          fontSize: 12, 
          color: '#6c757d', 
          marginBottom: 8,
          padding: '8px 12px',
          background: '#f8f9fa',
          borderRadius: 8,
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
          {sortedVersions.map((v, index) => (
            <VersionCard
              key={v.id}
              version={v}
              index={index}
              totalVersions={versions.length}
              isCurrent={v.id === currentVersionId}
              isRestoring={restoringVersionId === v.id}
              restoringVersionId={restoringVersionId}
              onRestore={setRestoreConfirmOpen}
            />
          ))}
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
          <div style={{ ...dialog, position: 'relative', zIndex: 1 }}>
            <div style={header}>
              <h3 style={title}>{details?.name ?? 'VSUM Details'}</h3>

              <div style={{ display: 'flex', gap: 8 }}>
                <TabButton
                  label="Details"
                  isActive={activeTab === 'details'}
                  onClick={() => setActiveTab('details')}
                />
                <TabButton
                  label="Manage Users"
                  isActive={activeTab === 'users'}
                  onClick={() => setActiveTab('users')}
                />
                <TabButton
                  label="Versions"
                  isActive={activeTab === 'versions'}
                  onClick={() => setActiveTab('versions')}
                />
                <button aria-label="Close" style={closeBtn} onClick={onClose}>
                  ×
                </button>
              </div>
            </div>

            <div style={body}>
              {error && <ErrorMessage message={error} />}
              {recoverError && <ErrorMessage message={recoverError} />}

              {activeTab === 'details' && renderDetailsContent()}
              {activeTab === 'users' && vsumId && <VsumUsersTab vsumId={vsumId} onChanged={onSaved} />}
              {activeTab === 'versions' && renderVersionsContent()}
            </div>

            <div style={footer}>
              <ActionButton
                label="Close"
                onClick={onClose}
                variant="secondary"
              />
              <div style={{ display: 'flex', gap: 8 }}>
                {renderFooterActions()}
              </div>
            </div>
          </div>
        </dialog>

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
              <div style={{ ...confirmBox, position: 'relative', zIndex: 1 }}>
                <div style={confirmHeader}>Are you sure?</div>
                <div style={confirmBody}>
                  This action will permanently delete this VSUM and cannot be undone.
                  {deleteError && <ErrorMessage message={deleteError} />}
                </div>
                <div style={confirmFooter}>
                  <ConfirmButton
                    label="Cancel"
                    onClick={() => setConfirmOpen(false)}
                    variant="cancel"
                    disabled={deleting}
                    accent={dangerAccent}
                  />
                  <ConfirmButton
                    label={deleting ? 'Deleting…' : 'Delete'}
                    onClick={confirmDelete}
                    variant="confirm"
                    disabled={deleting}
                    accent={dangerAccent}
                  />
                </div>
              </div>
            </dialog>
        )}

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
                  cursor: restoringVersionId === null ? 'pointer' : 'not-allowed',
                  zIndex: 0,
                }}
              />
              <div style={{ ...confirmBox, position: 'relative', zIndex: 1 }}>
                <div style={confirmHeader}>Restore to this version?</div>
                <div style={confirmBody}>
                  This will restore the VSUM to the selected version. The current version will be saved as a new version in the history.
                  {restoreError && <ErrorMessage message={restoreError} />}
                </div>
                <div style={confirmFooter}>
                  <ConfirmButton
                    label="Cancel"
                    onClick={() => {
                      setRestoreConfirmOpen(null);
                      setRestoreError('');
                    }}
                    variant="cancel"
                    disabled={restoringVersionId !== null}
                    accent={successAccent}
                  />
                  <ConfirmButton
                    label={restoringVersionId === restoreConfirmOpen ? 'Restoring…' : 'Restore'}
                    onClick={() => handleRestoreVersion(restoreConfirmOpen)}
                    variant="confirm"
                    disabled={restoringVersionId !== null}
                    accent={successAccent}
                  />
                </div>
              </div>
            </dialog>
        )}
      </>,
      document.body
  );
};