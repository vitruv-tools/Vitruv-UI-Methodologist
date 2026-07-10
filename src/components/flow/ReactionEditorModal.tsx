import React from 'react';
import { CodeEditorModal } from './CodeEditorModal';
import { CodeEditorState } from './flowCanvasTypes';

export type ReactionEditorState = CodeEditorState;

interface ReactionEditorModalProps {
  readonly state: ReactionEditorState | null;
  readonly onClose: () => void;
  readonly onSave: (code: string) => Promise<void> | void;
  readonly onDelete?: () => void;
  readonly vsumId?: string;
  readonly readOnly?: boolean;
}

/** Shared Reaction Editor shell — Monaco + LSP for `.reactions` files. */
export const ReactionEditorModal: React.FC<ReactionEditorModalProps> = ({
  state,
  onClose,
  onSave,
  onDelete,
  vsumId,
  readOnly,
}) => {
  if (!state) return null;

  return (
    <CodeEditorModal
      isOpen={state.isOpen}
      onClose={onClose}
      onSave={onSave}
      onDelete={onDelete}
      initialCode={state.initialCode}
      edgeId={state.edgeId || ''}
      sourceFileName={state.sourceFileName}
      targetFileName={state.targetFileName}
      vsumId={vsumId}
      lspEndpoint="/lsp"
      languageId="reactions"
      fileExtension=".reactions"
      title="Reaction Editor"
      readOnly={readOnly}
    />
  );
};
