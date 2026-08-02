import React, { useState } from 'react';
import { downloadMetaModelArtifact } from '../../utils/metaModelPreview';

interface MetaModelFileDownloadsProps {
  modelName: string;
  ecoreFileId?: number;
  genModelFileId?: number;
  /** Optional label style hook for sidebar sections */
  labelStyle?: React.CSSProperties;
}

const btnBase: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  transition: 'background 0.12s, border-color 0.12s',
};

// ── DownloadButton ────────────────────────────────────────────────────────────

interface DownloadButtonProps {
  kind: 'ecore' | 'genmodel';
  downloading: 'ecore' | 'genmodel' | null;
  onDownload: () => void;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({ kind, downloading, onDownload }) => (
  <button
    type="button"
    disabled={!!downloading}
    onClick={onDownload}
    style={{
      ...btnBase,
      border: '1px solid #e2e8f0',
      background: downloading === kind ? '#f8fafc' : '#fff',
      color: '#374151',
      cursor: downloading ? 'wait' : 'pointer',
    }}
  >
    {downloading === kind ? 'Downloading…' : `Download .${kind}`}
  </button>
);

// ── MetaModelFileDownloads ────────────────────────────────────────────────────

export const MetaModelFileDownloads: React.FC<MetaModelFileDownloadsProps> = ({
  modelName,
  ecoreFileId,
  genModelFileId,
  labelStyle,
}) => {
  const [downloading, setDownloading] = useState<'ecore' | 'genmodel' | null>(null);
  const [error, setError] = useState('');

  if (!ecoreFileId && !genModelFileId) return null;

  const handleDownload = async (kind: 'ecore' | 'genmodel', fileId?: number) => {
    if (!fileId) return;
    setError('');
    setDownloading(kind);
    try {
      await downloadMetaModelArtifact(kind, fileId, modelName);
    } catch {
      setError('Download failed. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const label = labelStyle ?? {
    fontSize: 11,
    fontWeight: 700,
    color: '#374151',
    marginBottom: 8,
    letterSpacing: '0.01em',
  };

  return (
    <div>
      <div style={label}>Downloads</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ecoreFileId ? (
          <DownloadButton kind="ecore" downloading={downloading} onDownload={() => handleDownload('ecore', ecoreFileId)} />
        ) : null}
        {genModelFileId ? (
          <DownloadButton kind="genmodel" downloading={downloading} onDownload={() => handleDownload('genmodel', genModelFileId)} />
        ) : null}
      </div>
      {error ? (
        <div style={{ marginTop: 6, fontSize: 11, color: '#dc2626' }}>{error}</div>
      ) : null}
    </div>
  );
};
