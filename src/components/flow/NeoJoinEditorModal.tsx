import React from 'react';
import type { languages } from 'monaco-editor';
import { CodeEditorModal, type EditorPosition } from './CodeEditorModal';

export const neoJoinMonarch: languages.IMonarchLanguage & { keywords: string[] } = {
  defaultToken: '',
  tokenPostfix: '.nj',
  keywords: [
    'export', 'to', 'import', 'from', 'create', 'join', 'where', 'on', 'as', 'group', 'by',
    'merge', 'with', 'for', 'if', 'else', 'in', 'true', 'false', 'null', 'class', 'abstract',
    'extends', 'containment', 'opposite', 'ordered', 'unique', 'many', 'optional',
  ],
  tokenizer: {
    root: [
      [/[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
      [/\/\/.*$/, 'comment'],
      [/\/\*/, 'comment', '@comment'],
      [/"([^"\\]|\\.)*"/, 'string'],
      [/\d+/, 'number'],
    ],
    comment: [
      [/[^/*]+/, 'comment'],
      [/\*\//, 'comment', '@pop'],
      [/[/*]/, 'comment'],
    ],
  },
};

export const neoJoinLanguageConfig: languages.LanguageConfiguration = {
  comments: { lineComment: '//', blockComment: ['/*', '*/'] },
  brackets: [['{', '}'], ['(', ')'], ['[', ']']],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '(', close: ')' },
    { open: '[', close: ']' },
    { open: '"', close: '"' },
  ],
};

export interface NeoJoinEditorState {
  /** Id of the view type being edited. */
  viewTypeId: string;
  title: string;
  initialCode: string;
  initialPosition?: EditorPosition;
}

interface NeoJoinEditorModalProps {
  readonly state: NeoJoinEditorState | null;
  readonly onClose: () => void;
  readonly onSave: (code: string) => Promise<void> | void;
  readonly vsumId?: string;
  readonly readOnly?: boolean;
}

/** Monaco + the NeoJoin language server for the `.nj` definition of one view type. */
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
      isOpen
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
      title={state.title}
      readOnly={readOnly}
      initialPosition={state.initialPosition}
    />
  );
};
