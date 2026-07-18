import React, { useEffect, useRef, useState } from 'react';
import { apiService } from '../../services/api';
import { VsumMetaModelRef, VsumMetaModelRelation } from '../../types';

interface MetaModelOption {
  id: number;
  name: string;
}

interface Props {
  vsumId: number;
  existingMetaModels: VsumMetaModelRef[];
  existingRelations: VsumMetaModelRelation[];
  onLinked: () => void;
}

const sectionLabel: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#2c3e50',
  marginTop: 16,
  marginBottom: 8,
  fontFamily: 'Georgia, serif',
  letterSpacing: '0.01em',
};

const relationRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #e9ecef',
  background: '#f8f9fa',
  fontSize: 13,
  marginBottom: 6,
};

const addButton: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  border: '1px dashed #049484',
  background: '#f0faf8',
  color: '#049484',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'Georgia, serif',
};

const formBox: React.CSSProperties = {
  marginTop: 12,
  padding: 16,
  borderRadius: 10,
  border: '2px dashed #049484',
  background: '#f8fcff',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '2px solid #e9ecef',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'Georgia, serif',
  background: '#fff',
  marginBottom: 12,
};

const fileButton: React.CSSProperties = {
  padding: '10px 14px',
  border: '2px solid #049484',
  borderRadius: 8,
  background: '#fff',
  color: '#2c3e50',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'Georgia, serif',
};

export const LinkMetaModelsPanel: React.FC<Props> = ({
  vsumId,
  existingMetaModels,
  existingRelations,
  onLinked,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [options, setOptions] = useState<MetaModelOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState('');
  const [sourceId, setSourceId] = useState<number | ''>('');
  const [targetId, setTargetId] = useState<number | ''>('');
  const [reactionFile, setReactionFile] = useState<File | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showForm) return;
    let cancelled = false;
    const load = async () => {
      setOptionsLoading(true);
      setOptionsError('');
      try {
        const res = await apiService.findMetaModels({ pageSize: 200 });
        if (!cancelled) {
          setOptions((res.data || []).map((m: any) => ({ id: m.id, name: m.name })));
        }
      } catch (e: any) {
        if (!cancelled) setOptionsError(e?.message || 'Failed to load meta models');
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [showForm]);

  // existingMetaModels[].id is the VSUM-scoped clone id created when the metamodel was linked
  // (see VsumMetaModelService#create on the backend); relations and the catalog (findMetaModels,
  // the select options below) all speak in terms of the original metamodel's id, exposed here as
  // sourceId. Matching must go through sourceId, not id.
  const nameFor = (id: number): string =>
    existingMetaModels.find((m) => m.sourceId === id)?.name ?? `#${id}`;

  const resetForm = () => {
    setSourceId('');
    setTargetId('');
    setReactionFile(null);
    setLinkError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLink = async () => {
    if (!sourceId || !targetId) {
      setLinkError('Please select both a source and a target meta model.');
      return;
    }
    if (sourceId === targetId) {
      setLinkError('Source and target meta models must be different.');
      return;
    }
    if (!reactionFile) {
      setLinkError('Please upload a .reactions file.');
      return;
    }

    setLinking(true);
    setLinkError('');
    try {
      const uploadRes = await apiService.uploadFile(reactionFile, 'REACTION');
      const rawData: any = uploadRes.data;
      const reactionFileId =
        rawData && typeof rawData === 'object' && 'id' in rawData
          ? Number(rawData.id)
          : Number(rawData);
      if (!Number.isFinite(reactionFileId)) {
        throw new TypeError('Reaction file upload did not return a valid file id.');
      }

      // sync-changes expects catalog metamodel ids (the same ones the select options above use),
      // not the VSUM-scoped clone ids in existingMetaModels[].id -- see the note on nameFor above.
      const metaModelIds = Array.from(
        new Set([...existingMetaModels.map((m) => m.sourceId), sourceId, targetId])
      );
      const metaModelRelationRequests = [
        ...existingRelations.map((r) => ({
          sourceId: r.sourceId,
          targetId: r.targetId,
          reactionFileId: (r.reactionFileId ?? r.reactionFileStorageId) as number,
        })),
        { sourceId, targetId, reactionFileId },
      ];

      await apiService.syncVsumChanges(vsumId, { metaModelIds, metaModelRelationRequests });

      resetForm();
      setShowForm(false);
      onLinked();
    } catch (e: any) {
      setLinkError(e?.response?.data?.message || e?.message || 'Failed to link meta models');
    } finally {
      setLinking(false);
    }
  };

  return (
    <div>
      {existingRelations.length > 0 && (
        <>
          <div style={sectionLabel}>Meta Model Relations</div>
          {existingRelations.map((r) => (
            <div key={r.id} style={relationRow}>
              <span style={{ fontWeight: 700, color: '#2c3e50' }}>{nameFor(r.sourceId)}</span>
              <span style={{ color: '#049484' }}>→</span>
              <span style={{ fontWeight: 700, color: '#2c3e50' }}>{nameFor(r.targetId)}</span>
              {(r.reactionFileId ?? r.reactionFileStorageId) && (
                <span style={{ marginLeft: 'auto', color: '#6c757d', fontStyle: 'italic' }}>
                  reactions linked
                </span>
              )}
            </div>
          ))}
        </>
      )}

      {!showForm && (
        <button type="button" style={addButton} onClick={() => setShowForm(true)}>
          + Link Meta Models
        </button>
      )}

      {showForm && (
        <div style={formBox}>
          {optionsLoading && (
            <div style={{ fontSize: 13, color: '#6c757d', fontStyle: 'italic', marginBottom: 12 }}>
              Loading meta models…
            </div>
          )}
          {optionsError && (
            <div style={{ fontSize: 13, color: '#721c24', marginBottom: 12 }}>{optionsError}</div>
          )}

          <div style={sectionLabel}>Source Meta Model</div>
          <select
            style={selectStyle}
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Select source meta model…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>

          <div style={sectionLabel}>Target Meta Model</div>
          <select
            style={selectStyle}
            value={targetId}
            onChange={(e) => setTargetId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Select target meta model…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>

          <div style={sectionLabel}>Reactions File</div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".reactions"
            style={{ display: 'none' }}
            onChange={(e) => setReactionFile(e.target.files?.[0] ?? null)}
          />
          <button type="button" style={fileButton} onClick={() => fileInputRef.current?.click()}>
            {reactionFile ? `✓ ${reactionFile.name}` : 'Upload .reactions'}
          </button>

          {linkError && (
            <div style={{ marginTop: 12, fontSize: 13, color: '#721c24' }}>{linkError}</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              type="button"
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: linking
                  ? '#a5d6d3'
                  : 'linear-gradient(135deg, #049484 0%, #037368 100%)',
                color: '#fff',
                fontWeight: 600,
                fontSize: 14,
                cursor: linking ? 'not-allowed' : 'pointer',
                fontFamily: 'Georgia, serif',
              }}
              onClick={handleLink}
              disabled={linking}
            >
              {linking ? 'Linking…' : 'Link'}
            </button>
            <button
              type="button"
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: '1px solid #dee2e6',
                background: '#fff',
                color: '#495057',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                fontFamily: 'Georgia, serif',
              }}
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              disabled={linking}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
