import React, { useCallback, useEffect } from 'react';
import { ReactionConfig, ReactionEdge } from '../../types/reactions';

const V = {
  primary: '#7c3aed',
  primarySoft: '#f5f3ff',
  primaryBorder: '#ddd6fe',
  ink: '#4c1d95',
  text: '#374151',
  textMuted: '#64748b',
  border: '#e2e8f0',
  surface: '#ffffff',
} as const;

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: V.textMuted,
  marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '7px 10px',
  borderRadius: 8,
  border: `1px solid ${V.border}`,
  fontSize: 12,
  fontFamily: 'inherit',
  color: V.text,
  background: V.surface,
  marginBottom: 12,
};

interface ReactionConfigPopupProps {
  edge: ReactionEdge;
  onUpdate: (config: ReactionConfig) => void;
  onDelete: () => void;
  onClose: () => void;
}

export const ReactionConfigPopup: React.FC<ReactionConfigPopupProps> = ({
  edge,
  onUpdate,
  onDelete,
  onClose,
}) => {
  const setField = useCallback(<K extends keyof ReactionConfig>(key: K, value: ReactionConfig[K]) => {
    onUpdate({ ...edge.config, [key]: value });
  }, [edge.config, onUpdate]);

  const stopBubble = (e: React.MouseEvent) => e.stopPropagation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <dialog
      data-reaction-edit-panel
      open
      aria-label="Edit reaction"
      style={{
        position: 'absolute',
        top: 56,
        right: 12,
        bottom: 12,
        zIndex: 36,
        width: 300,
        margin: 0,
        padding: 0,
        background: V.surface,
        border: `1px solid ${V.primaryBorder}`,
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(124,58,237,0.18), 0 0 0 1px rgba(124,58,237,0.05)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div
        onMouseDown={stopBubble}
        style={{
        padding: '10px 14px',
        borderBottom: `1px solid ${V.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
        background: `linear-gradient(180deg, ${V.primarySoft} 0%, ${V.surface} 100%)`,
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: V.primary, textTransform: 'uppercase' }}>
            Reaction
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: V.ink, marginTop: 3 }}>
            {edge.sourceClassName} → {edge.targetClassName}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close panel"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: V.textMuted, padding: 2, fontSize: 14, lineHeight: 1 }}
        >
          ✕
        </button>
      </div>

      <div onMouseDown={stopBubble} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', fontSize: 12 }}>
          <input
            type="checkbox"
            checked={edge.config.bidirectional}
            onChange={e => setField('bidirectional', e.target.checked)}
          />
          <span>Bidirectional</span>
        </label>

        <label htmlFor="reaction-name" style={labelStyle}>Reaction name</label>
        <input
          id="reaction-name"
          value={edge.config.reactionName}
          onChange={e => setField('reactionName', e.target.value)}
          style={inputStyle}
        />

        <label htmlFor="model1-url" style={labelStyle}>Model 1 URL</label>
        <input
          id="model1-url"
          value={edge.config.model1Url}
          onChange={e => setField('model1Url', e.target.value)}
          style={inputStyle}
        />

        <label htmlFor="model2-url" style={labelStyle}>Model 2 URL</label>
        <input
          id="model2-url"
          value={edge.config.model2Url}
          onChange={e => setField('model2Url', e.target.value)}
          style={inputStyle}
        />

        <label htmlFor="model1-alias" style={labelStyle}>Model 1 alias</label>
        <input
          id="model1-alias"
          value={edge.config.model1Alias}
          onChange={e => setField('model1Alias', e.target.value)}
          style={inputStyle}
        />

        <label htmlFor="model2-alias" style={labelStyle}>Model 2 alias</label>
        <input
          id="model2-alias"
          value={edge.config.model2Alias}
          onChange={e => setField('model2Alias', e.target.value)}
          style={inputStyle}
        />

        <label htmlFor="model1-root-type" style={labelStyle}>Model 1 root type</label>
        <input
          id="model1-root-type"
          value={edge.config.model1RootType}
          onChange={e => setField('model1RootType', e.target.value)}
          style={inputStyle}
        />

        <label htmlFor="model2-root-type" style={labelStyle}>Model 2 root type</label>
        <input
          id="model2-root-type"
          value={edge.config.model2RootType}
          onChange={e => setField('model2RootType', e.target.value)}
          style={inputStyle}
        />

        <label htmlFor="model1-root-val" style={labelStyle}>Model 1 root value</label>
        <input
          id="model1-root-val"
          value={edge.config.model1RootVal}
          onChange={e => setField('model1RootVal', e.target.value)}
          style={inputStyle}
        />
      </div>

      <div
        onMouseDown={stopBubble}
        style={{
        padding: '10px 14px',
        borderTop: `1px solid ${V.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <button
          type="button"
          onClick={onDelete}
          style={{
            border: '1px solid #fecaca',
            borderRadius: 8,
            background: '#fef2f2',
            color: '#dc2626',
            fontSize: 11,
            fontWeight: 600,
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          Delete reaction
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            border: `1px solid ${V.primaryBorder}`,
            borderRadius: 8,
            background: V.primarySoft,
            color: V.primary,
            fontSize: 11,
            fontWeight: 600,
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
      </div>
    </dialog>
  );
};
