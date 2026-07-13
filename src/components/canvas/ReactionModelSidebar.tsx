import React, { useCallback } from 'react';
import { ReactionsModel } from '../../types/reactions';

const V = {
  primary: '#049484',
  primarySoft: '#ecfdf5',
  primaryBorder: '#a7f3d0',
  primaryRing: 'rgba(4,148,132,0.15)',
  ink: '#0c436e',
  text: '#374151',
  textMuted: '#64748b',
  border: '#e2e8f0',
  surface: '#ffffff',
  surfaceHover: '#f0fdfa',
} as const;

interface ModelListActionProps {
  model: ReactionsModel;
  isAdded: boolean;
  canRemove: boolean;
  onAddModel: (model: ReactionsModel) => void;
  onRemoveModel?: (model: ReactionsModel) => void;
}

const ModelListAction: React.FC<ModelListActionProps> = ({
  model,
  isAdded,
  canRemove,
  onAddModel,
  onRemoveModel,
}) => {
  if (canRemove && onRemoveModel) {
    return (
      <button
        type="button"
        onClick={() => onRemoveModel(model)}
        style={{
          padding: '5px 10px',
          fontSize: 12,
          fontWeight: 600,
          border: '1px solid #fecaca',
          borderRadius: 6,
          background: '#fef2f2',
          color: '#dc2626',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.12s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = '#dc2626';
          e.currentTarget.style.color = '#fff';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = '#fef2f2';
          e.currentTarget.style.color = '#dc2626';
        }}
      >
        Remove
      </button>
    );
  }

  if (isAdded) {
    return (
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: V.primary,
        padding: '3px 8px',
        borderRadius: 4,
        background: V.primarySoft,
        border: `1px solid ${V.primaryBorder}`,
        flexShrink: 0,
      }}>
        Added
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onAddModel(model)}
      style={{
        padding: '5px 12px',
        fontSize: 12,
        fontWeight: 600,
        border: `1px solid ${V.primaryBorder}`,
        borderRadius: 6,
        background: V.primarySoft,
        color: V.primary,
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'all 0.12s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = V.primary;
        e.currentTarget.style.color = '#fff';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = V.primarySoft;
        e.currentTarget.style.color = V.primary;
      }}
    >
      + Add
    </button>
  );
};

interface ReactionModelSidebarProps {
  isOpen: boolean;
  allModels: ReactionsModel[];
  loadedModelIds: Set<number>;
  /** Primary model cannot be removed from the view. */
  primaryModelId: number;
  onAddModel: (model: ReactionsModel) => void;
  onRemoveModel?: (model: ReactionsModel) => void;
  onClose: () => void;
}

export const ReactionModelSidebar: React.FC<ReactionModelSidebarProps> = ({
  isOpen,
  allModels,
  loadedModelIds,
  primaryModelId,
  onAddModel,
  onRemoveModel,
  onClose,
}) => {
  const handleDragStart = useCallback((e: React.DragEvent, model: ReactionsModel) => {
    e.dataTransfer.setData('application/x-reactions-model-id', String(model.id));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        pointerEvents: 'auto',
      }}
    >
      <button
        type="button"
        aria-label="Close sidebar"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          margin: 0,
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'default',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 320,
          zIndex: 1,
          background: V.surface,
          borderLeft: `1px solid ${V.border}`,
          boxShadow: '-4px 0 16px rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideInRight 0.2s ease-out',
        }}
      >
        <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${V.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: V.ink }}>
            Add Meta Models
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              border: `1px solid ${V.border}`,
              borderRadius: 6,
              background: V.surface,
              color: V.textMuted,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              lineHeight: 1,
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = V.primaryBorder;
              e.currentTarget.style.color = V.primary;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = V.border;
              e.currentTarget.style.color = V.textMuted;
            }}
          >
            &times;
          </button>
        </div>

        {/* Drag hint */}
        <div style={{
          padding: '10px 20px',
          background: V.primarySoft,
          borderBottom: `1px solid ${V.primaryBorder}`,
          fontSize: 11,
          color: V.primary,
          fontWeight: 500,
        }}>
          Click "Add" or drag a model onto the canvas
        </div>

        {/* Model list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
          {allModels.length === 0 && (
            <p style={{ fontSize: 13, color: V.textMuted, textAlign: 'center', marginTop: 32 }}>
              No metamodels available in this project.
            </p>
          )}
          {allModels.map(model => {
            const isAdded = loadedModelIds.has(model.id);
            const canRemove = isAdded && model.id !== primaryModelId && onRemoveModel;
            return (
              <div
                key={model.id}
                draggable={!isAdded}
                onDragStart={e => handleDragStart(e, model)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: `1px solid ${isAdded ? V.primaryBorder : V.border}`,
                  background: isAdded ? V.primarySoft : V.surface,
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  transition: 'all 0.12s',
                  cursor: isAdded ? 'default' : 'grab',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: V.ink,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {model.name}
                  </div>
                  {model.ecoreFileId && (
                    <div style={{ fontSize: 11, color: V.textMuted, marginTop: 2 }}>
                      ID: {model.ecoreFileId}
                    </div>
                  )}
                </div>
                <ModelListAction
                  model={model}
                  isAdded={isAdded}
                  canRemove={Boolean(canRemove)}
                  onAddModel={onAddModel}
                  onRemoveModel={onRemoveModel}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
