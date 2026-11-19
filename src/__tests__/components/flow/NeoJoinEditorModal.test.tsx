import React from 'react';
import { render, screen } from '@testing-library/react';
import { NeoJoinEditorModal } from '../../../components/flow/NeoJoinEditorModal';

const mockCodeEditorModal = vi.fn();

vi.mock('../../../components/flow/CodeEditorModal', () => ({
  CodeEditorModal: (props: Record<string, unknown>) => {
    mockCodeEditorModal(props);
    return <textarea data-testid="editor" readOnly value={String(props.initialCode ?? '')} />;
  },
}));

function renderEditor(initialCode: string, readOnly = false) {
  render(
    <NeoJoinEditorModal
      state={{
        isOpen: true,
        edgeId: 'vt-1',
        viewTypeId: 'vt-1',
        label: 'Brake',
        initialCode,
      }}
      onClose={vi.fn()}
      onSave={vi.fn()}
      vsumId="7"
      readOnly={readOnly}
    />,
  );
  return mockCodeEditorModal.mock.calls.at(-1)?.[0];
}

describe('NeoJoinEditorModal', () => {
  beforeEach(() => {
    mockCodeEditorModal.mockClear();
  });

  it('opens the shared editor for a NeoJoin query', () => {
    const props = renderEditor('export Brake to "http://example/Brake"\n');

    expect(props.languageId).toBe('neojoin');
    expect(props.fileExtension).toBe('.nj');
    expect(props.lspEndpoint).toBe('/neojoin-lsp');
    expect(props.edgeId).toBe('vt-1');
    expect(props.vsumId).toBe('7');
    expect(props.title).toBe('NeoJoin: Brake');
    expect(props.monarchGrammar.tokenPostfix).toBe('.neojoin');
    expect(screen.getByTestId('editor')).toHaveValue('export Brake to "http://example/Brake"\n');
  });

  it('passes view-only mode through', () => {
    const props = renderEditor('export Brake to "http://example/Brake"\n', true);

    expect(props.readOnly).toBe(true);
  });

  it('renders nothing without state', () => {
    const { container } = render(
      <NeoJoinEditorModal state={null} onClose={vi.fn()} onSave={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
