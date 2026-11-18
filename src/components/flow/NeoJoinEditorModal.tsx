import React from 'react';
import { CodeEditorModal } from './CodeEditorModal';
import { CodeEditorState } from './flowCanvasTypes';
import { neoJoinLanguageConfig, neoJoinMonarch } from './NeoJoinMonarchGrammar';

export interface NeoJoinEditorState extends CodeEditorState {
  readonly viewTypeId: string;
  readonly label: string;
  readonly fileId?: number | null;
}

interface NeoJoinEditorModalProps {
  readonly state: NeoJoinEditorState | null;
  readonly onClose: () => void;
  readonly onSave: (code: string) => Promise<void> | void;
  readonly vsumId?: string;
  readonly readOnly?: boolean;
}

/** Monaco + the NeoJoin language server for one view type's `.nj` definition. */
export const NeoJoinEditorModal: React.FC<NeoJoinEditorModalProps> = ({
  state,
  onClose,
  onSave,
  vsumId,
  readOnly,
}) => {
  if (!state) return null;

  return (
    <CodeEditorModal
      isOpen={state.isOpen}
      onClose={onClose}
      onSave={onSave}
      initialCode={state.initialCode}
      edgeId={state.viewTypeId}
      vsumId={vsumId}
      lspEndpoint="/neojoin-lsp"
      languageId="neojoin"
      fileExtension=".nj"
      monarchGrammar={neoJoinMonarch}
      languageConfig={neoJoinLanguageConfig}
      title={`NeoJoin: ${state.label}`}
      readOnly={readOnly}
      initialPosition={state.initialPosition}
    />
  );
};
