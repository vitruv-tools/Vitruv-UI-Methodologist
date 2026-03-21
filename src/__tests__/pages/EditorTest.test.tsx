import React from 'react';
import { render, screen } from '@testing-library/react';
import { EditorTest } from '../../pages/EditorTest';

jest.mock('../../components/flow/CodeEditorModal', () => ({
  CodeEditorModal: (props: any) => (
    <div data-testid="code-editor-modal">
      <div>Editor is open: {props.isOpen ? 'yes' : 'no'}</div>
      <div>Edge ID: {props.edgeId}</div>
      <div>Source: {props.sourceFileName}</div>
      <div>Target: {props.targetFileName}</div>
    </div>
  ),
}));

describe('EditorTest page', () => {
  it('renders the Monaco editor test modal with expected props', () => {
    render(<EditorTest />);

    expect(screen.getByText(/Monaco Editor \+ LSP Test/i)).toBeInTheDocument();
    expect(screen.getByTestId('code-editor-modal')).toBeInTheDocument();
    expect(screen.getByText(/Editor is open: yes/i)).toBeInTheDocument();
    expect(screen.getByText(/Edge ID: test-edge-123/i)).toBeInTheDocument();
    expect(screen.getByText(/Source: SourceModel\.ecore/i)).toBeInTheDocument();
    expect(screen.getByText(/Target: TargetModel\.ecore/i)).toBeInTheDocument();
  });
});

