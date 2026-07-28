import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ModelDetailModal } from '../../ui/ModelLibraryTable';

export interface ModelDetailOverlayProps {
  model: any;
  ecoreContent: string;
  onClose: () => void;
}

/**
 * Model detail panel, portalled to `document.body` so it escapes the canvas
 * stacking context.
 *
 * Dismissal is handled here rather than by a backdrop click target: the
 * backdrop is `pointer-events: none` so the canvas stays visible through it,
 * so we listen on the document in the capture phase instead and ignore clicks
 * that land on the modal or on any interactive element.
 */
export const ModelDetailOverlay: React.FC<ModelDetailOverlayProps> = ({
  model,
  ecoreContent,
  onClose,
}) => {
  useEffect(() => {
    const handleOutsideDetail = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-model-detail-modal]')) return;
      if (target.closest('button, input, textarea, select, a, [role="dialog"]')) return;
      onClose();
    };
    document.addEventListener('pointerdown', handleOutsideDetail, true);
    document.addEventListener('mousedown', handleOutsideDetail, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideDetail, true);
      document.removeEventListener('mousedown', handleOutsideDetail, true);
    };
  }, [onClose]);

  return ReactDOM.createPortal(
    <>
      <div
        aria-hidden="true"
        data-model-detail-dismiss
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto' }} data-model-detail-modal>
          <ModelDetailModal
            model={model}
            ecoreContent={ecoreContent}
            onClose={onClose}
            onUpdated={onClose}
            embedded
          />
        </div>
      </div>
    </>,
    document.body,
  );
};
