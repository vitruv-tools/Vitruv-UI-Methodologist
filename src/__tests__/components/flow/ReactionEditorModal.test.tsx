import React from 'react';
import { render, screen } from '@testing-library/react';
import { ReactionEditorModal } from '../../../components/flow/ReactionEditorModal';
import { UTILITY_CLASS_IMPORT } from '../../../utils/reactionImports';

const mockCodeEditorModal = vi.fn();

vi.mock('../../../components/flow/CodeEditorModal', () => ({
  CodeEditorModal: (props: any) => {
    mockCodeEditorModal(props);
    return <textarea data-testid="editor" readOnly value={props.initialDraft ?? props.initialCode} />;
  },
}));

const IMPORT = `import ${UTILITY_CLASS_IMPORT}`;

function renderEditor(initialCode: string, readOnly = false) {
  render(
    <ReactionEditorModal
      state={{ isOpen: true, initialCode, edgeId: 'e1' } as any}
      onClose={vi.fn()}
      onSave={vi.fn()}
      readOnly={readOnly}
    />,
  );
  return mockCodeEditorModal.mock.calls.at(-1)?.[0];
}

describe('ReactionEditorModal', () => {
  beforeEach(() => {
    mockCodeEditorModal.mockClear();
  });

  it('adds the utility class import to a reaction without it, as a draft', () => {
    const props = renderEditor('import "u1" as a\n\nreactions: x\n');

    expect(props.initialCode).toBe('import "u1" as a\n\nreactions: x\n');
    expect(props.initialDraft).toBe(`${IMPORT}\n\nimport "u1" as a\n\nreactions: x\n`);
    expect(screen.getByTestId('editor')).toHaveValue(`${IMPORT}\n\nimport "u1" as a\n\nreactions: x\n`);
  });

  it('opens a reaction that already has the import unchanged', () => {
    const code = `${IMPORT}\n\nimport "u1" as a\n`;

    const props = renderEditor(code);

    expect(props.initialDraft).toBe(code);
    expect(props.initialDraft).toBe(props.initialCode);
  });

  it('does not change reactions for view-only users', () => {
    const props = renderEditor('import "u1" as a\n', true);

    expect(props.initialDraft).toBeUndefined();
    expect(props.readOnly).toBe(true);
    expect(screen.getByTestId('editor')).toHaveValue('import "u1" as a\n');
  });

  it('renders nothing without state', () => {
    const { container } = render(<ReactionEditorModal state={null} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });
});
