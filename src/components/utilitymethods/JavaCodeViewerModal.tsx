import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { ActionButton } from '../ui/ActionButton';
import {
  largeModalPanelStyle,
  modalCloseButtonStyle,
  modalPanelFooterStyle,
  modalPanelHeaderStyle,
} from '../ui/sharedStyles';
import { MODAL_Z_INDEX, modalBackdropStyle, modalDialogShellStyle, useModalBodyLock } from '../ui/modalUtils';
import { copyTextToClipboard } from '../../utils/apiErrorMessage';
import type { UtilityMethodProblem } from '../../services/api';
import { UTILITY_METHOD_EDITOR_THEME, setUpVitruvOcl } from './monacoSetup';

interface JavaCodeViewerModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  code: string;
  /** Utility methods that are missing from the code because they cannot be translated. */
  problems?: UtilityMethodProblem[];
  onClose: () => void;
}

/** Shows generated Java code read-only, so that the methodologist can verify it. */
export const JavaCodeViewerModal: React.FC<JavaCodeViewerModalProps> = ({
  isOpen, title, subtitle, code, problems = [], onClose,
}) => {
  const [copied, setCopied] = useState(false);
  useModalBodyLock(isOpen);
  if (!isOpen) return null;

  const handleCopy = async () => {
    setCopied(await copyTextToClipboard(code));
    globalThis.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <dialog
      open
      aria-labelledby="java-code-viewer-title"
      style={{ ...modalDialogShellStyle, zIndex: MODAL_Z_INDEX + 20 }}
      onCancel={onClose}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Escape') onClose();
      }}
    >
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        style={{ ...modalBackdropStyle, position: 'absolute' }}
      />
      <div style={{ ...largeModalPanelStyle, maxWidth: 1000 }}>
        <div style={modalPanelHeaderStyle}>
          <div style={{ minWidth: 0 }}>
            <h3 id="java-code-viewer-title" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--v-text)' }}>
              {title}
            </h3>
            {subtitle && (
              <div style={{ fontSize: 12, color: 'var(--v-text-muted)', marginTop: 2, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                {subtitle}
              </div>
            )}
          </div>
          <button type="button" aria-label="Close Java code" onClick={onClose} style={modalCloseButtonStyle}>×</button>
        </div>
        {problems.length > 0 && (
          <div role="alert" style={{ padding: '8px 20px', background: 'var(--v-danger-bg)', color: 'var(--v-danger-text)', fontSize: 12, borderBottom: '1px solid var(--v-danger-border)' }}>
            Not included because they cannot be translated:{' '}
            {problems.map(p => `${p.utilityMethodName} (${p.message})`).join('; ')}
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0 }}>
          <Editor
            value={code}
            language="java"
            theme={UTILITY_METHOD_EDITOR_THEME}
            beforeMount={setUpVitruvOcl}
            options={{
              readOnly: true,
              domReadOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: 'on',
              renderLineHighlight: 'none',
            }}
          />
        </div>
        <div style={modalPanelFooterStyle}>
          <span style={{ fontSize: 12, color: 'var(--v-text-muted)' }}>
            Generated from the utility methods. Read-only; edit the utility methods to change it.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <ActionButton variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy'}
            </ActionButton>
            <ActionButton variant="primary" size="sm" onClick={onClose}>Close</ActionButton>
          </div>
        </div>
      </div>
    </dialog>
  );
};
