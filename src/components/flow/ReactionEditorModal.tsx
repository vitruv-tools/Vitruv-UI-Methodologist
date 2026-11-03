import React, { useMemo } from 'react';
import { CodeEditorModal } from './CodeEditorModal';
import { CodeEditorState } from './flowCanvasTypes';
import { ensureUtilityImport } from '../../utils/reactionImports';

export type ReactionEditorState = CodeEditorState;

interface ReactionEditorModalProps {
  readonly state: ReactionEditorState | null;
  readonly onClose: () => void;
  readonly onSave: (code: string) => Promise<void> | void;
  readonly onDelete?: () => void;
  readonly vsumId?: string;
  readonly readOnly?: boolean;
}

/**
 * Shared Reaction Editor shell — Monaco + LSP for `.reactions` files. Reactions that do not import
 * the project's utility class get the import added, as an unsaved change.
 */
export const ReactionEditorModal: React.FC<ReactionEditorModalProps> = ({
  state,
  onClose,
  onSave,
  onDelete,
  vsumId,
  readOnly,
}) => {
  const initialCode = state?.initialCode;
  const initialDraft = useMemo(
    () => (readOnly || initialCode === undefined ? undefined : ensureUtilityImport(initialCode)),
    [initialCode, readOnly],
  );

  if (!state) return null;

  return (
    <CodeEditorModal
      isOpen={state.isOpen}
      onClose={onClose}
      onSave={onSave}
      onDelete={onDelete}
      initialCode={state.initialCode}
      initialDraft={initialDraft}
      edgeId={state.edgeId || ''}
      sourceFileName={state.sourceFileName}
      targetFileName={state.targetFileName}
      vsumId={vsumId}
      lspEndpoint="/lsp"
      languageId="reactions"
      fileExtension=".reactions"
      title="Reaction Editor"
      readOnly={readOnly}
      initialPosition={state.initialPosition}
    />
  );
};
