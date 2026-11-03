import React from 'react';
import { render } from '@testing-library/react';
import { CodeEditorModal, revealEditorPosition } from '../../../components/flow/CodeEditorModal';

const mockEditor = {
  setPosition: vi.fn(),
  revealLineInCenter: vi.fn(),
  focus: vi.fn(),
};

vi.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({ value, onMount }: any) => {
    React.useEffect(() => {
      onMount?.(mockEditor, {
        languages: {
          register: vi.fn(),
          setLanguageConfiguration: vi.fn(),
          setMonarchTokensProvider: vi.fn(),
          registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
        },
        editor: { defineTheme: vi.fn(), setTheme: vi.fn() },
      });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return <textarea data-testid="monaco-editor" value={value} readOnly />;
  },
}));

const props = {
  isOpen: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
  initialCode: 'line 1\nline 2\nline 3',
  edgeId: 'edge-1',
  readOnly: true,
};

describe('CodeEditorModal – initial position', () => {
  it('puts the cursor at the requested position when the editor mounts', () => {
    render(<CodeEditorModal {...props} initialPosition={{ lineNumber: 3, column: 4 }} />);
    expect(mockEditor.setPosition).toHaveBeenCalledWith({ lineNumber: 3, column: 4 });
    expect(mockEditor.revealLineInCenter).toHaveBeenCalledWith(3);
  });

  it('jumps again when an open editor gets another position', () => {
    const { rerender } = render(<CodeEditorModal {...props} initialPosition={{ lineNumber: 1 }} />);
    mockEditor.setPosition.mockClear();

    rerender(<CodeEditorModal {...props} initialPosition={{ lineNumber: 2, column: 5 }} />);

    expect(mockEditor.setPosition).toHaveBeenCalledWith({ lineNumber: 2, column: 5 });
    expect(mockEditor.revealLineInCenter).toHaveBeenLastCalledWith(2);
  });

  it('leaves the cursor alone without a position', () => {
    render(<CodeEditorModal {...props} />);
    expect(mockEditor.setPosition).not.toHaveBeenCalled();
    expect(mockEditor.focus).toHaveBeenCalled();
  });
});

describe('revealEditorPosition', () => {
  it('defaults to column 1 and clamps invalid values', () => {
    const editor = { setPosition: vi.fn(), revealLineInCenter: vi.fn() };
    revealEditorPosition(editor, { lineNumber: 0 });
    expect(editor.setPosition).toHaveBeenCalledWith({ lineNumber: 1, column: 1 });
    expect(editor.revealLineInCenter).toHaveBeenCalledWith(1);
  });
});
