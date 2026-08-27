import React from 'react';
import ReactDOM from 'react-dom';
import { DrawerModel, ModelDrawer } from './ModelDrawer';
import { MODAL_Z_INDEX, modalBackdropStyle } from '../ui/modalUtils';

interface ModelDrawerModalProps {
  models: DrawerModel[];
  addedModelIds: Set<number>;
  loading: boolean;
  myLibraryModels: DrawerModel[];
  publicLibraryModels: DrawerModel[];
  onClose: () => void;
  onAddModel: (model: DrawerModel) => void;
  onDeleteModel?: (model: DrawerModel) => Promise<void>;
  onFetchFile: (fileId: number) => Promise<string>;
}

export const ModelDrawerModal: React.FC<ModelDrawerModalProps> = ({
  models,
  addedModelIds,
  loading,
  myLibraryModels,
  publicLibraryModels,
  onClose,
  onAddModel,
  onDeleteModel,
  onFetchFile,
}) => ReactDOM.createPortal(
  <>
    <button
      type="button"
      aria-hidden="true"
      tabIndex={-1}
      onClick={onClose}
      style={{ ...modalBackdropStyle, zIndex: MODAL_Z_INDEX }}
    />
    <div style={{
      position: 'fixed',
      top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      width: 'min(800px, 92vw)',
      height: 'min(700px, 88vh)',
      zIndex: MODAL_Z_INDEX + 1,
      pointerEvents: 'auto',
      background: 'var(--v-surface)',
      borderRadius: 10,
      boxShadow: 'var(--v-card-shadow)',
      border: '1px solid var(--v-border)',
      overflow: 'hidden',
    }}>
      <ModelDrawer
        models={models}
        addedModelIds={addedModelIds}
        loading={loading}
        onClose={onClose}
        onAddModel={onAddModel}
        onDeleteModel={onDeleteModel}
        myLibraryModels={myLibraryModels}
        publicLibraryModels={publicLibraryModels}
        onFetchFile={onFetchFile}
      />
    </div>
  </>,
  document.body,
);
