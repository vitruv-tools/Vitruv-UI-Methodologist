import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { BuildProblemsDialog } from '../../../components/canvas/BuildProblemsDialog';
import type { BuildFailure, BuildProblem } from '../../../types/vsumBuild';

const reactionProblem: BuildProblem = {
  source: 'REACTIONS',
  file: 'my.reactions',
  fileId: 7,
  line: 51,
  column: 30,
  message: "Couldn't resolve reference to EClass 'Foo'.",
  excerpt: '    map Foo to Bar\n        ^',
  hint: "Use a class of the metamodel, e.g. 'Person'.",
  hiddenFollowUpErrors: 3,
};

const metamodelProblem: BuildProblem = {
  source: 'METAMODEL',
  file: 'families.ecore',
  fileId: 11,
  message: 'The package has no nsURI.',
};

const modelsFailure: BuildFailure = {
  errorCode: 'VSUM_REACTIONS_ERROR',
  message: 'The uploaded reactions do not match the uploaded metamodels',
  problems: [
    reactionProblem,
    { ...reactionProblem, line: 60, column: undefined, message: 'Second problem', excerpt: undefined, hint: undefined, hiddenFollowUpErrors: 1 },
    metamodelProblem,
    { source: 'INFRASTRUCTURE', message: 'Maven Central did not answer' },
  ],
};

const renderDialog = (
  failure: BuildFailure | null = modelsFailure,
  onOpenProblem: ((p: BuildProblem) => boolean) | undefined = vi.fn(() => true),
  onClose = vi.fn(),
) => {
  const result = render(
    <BuildProblemsDialog
      failure={failure}
      title="Runnable JAR export failed"
      onClose={onClose}
      onOpenProblem={onOpenProblem}
    />,
  );
  return { ...result, onClose, onOpenProblem };
};

describe('BuildProblemsDialog', () => {
  it('renders nothing without a failure', () => {
    renderDialog(null);
    expect(screen.queryByTestId('build-problems-dialog')).not.toBeInTheDocument();
  });

  it('is a labelled modal dialog that takes the focus', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Runnable JAR export failed' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription(/Your models need changes/);
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
  });

  it('groups problems by file and by source without a file', () => {
    renderDialog();
    const groups = screen.getAllByTestId('build-problem-group');
    expect(groups.map(g => within(g).getByRole('heading').textContent)).toEqual([
      'my.reactions',
      'families.ecore',
      'Build environment',
    ]);
    expect(within(groups[0]).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByTestId('build-problems-headline'))
      .toHaveTextContent('Your models need changes · 4 problems in 2 files');
  });

  it('shows location, message, excerpt, hint and hidden follow-up errors', () => {
    renderDialog();
    const [first] = within(screen.getAllByTestId('build-problem-group')[0]).getAllByRole('listitem');
    expect(within(first).getByText('Line 51, column 30')).toBeInTheDocument();
    expect(within(first).getByText(reactionProblem.message)).toBeInTheDocument();

    const excerpt = within(first).getByTestId('build-problem-excerpt');
    expect(excerpt.tagName).toBe('PRE');
    expect(excerpt.textContent).toBe(reactionProblem.excerpt);
    expect(excerpt).toHaveStyle({ whiteSpace: 'pre' });

    expect(within(first).getByTestId('build-problem-hint')).toHaveTextContent(`Hint: ${reactionProblem.hint}`);
    expect(within(first).getByText('3 follow-up errors hidden')).toBeInTheDocument();
    expect(screen.getByText('1 follow-up error hidden')).toBeInTheDocument();
  });

  it.each([
    ['VSUM_BUILD_UNAVAILABLE', 'INFRASTRUCTURE', 'The build environment is temporarily unavailable, please try again later'],
    ['VSUM_INTERNAL_ERROR', 'INTERNAL', 'The setup service failed; this is not caused by your models'],
    ['VSUM_BUILD_FAILED', 'REACTIONS', 'Your models need changes'],
    ['VSUM_METAMODEL_ERROR', 'METAMODEL', 'Your models need changes'],
  ] as const)('words %s failures for the user', (errorCode, source, headline) => {
    renderDialog({ errorCode, message: 'x', problems: [{ source, message: 'Something broke' }] });
    expect(screen.getByTestId('build-problems-headline')).toHaveTextContent(headline);
  });

  it('labels problems without a file by their source', () => {
    renderDialog({ message: 'x', problems: [{ source: 'INTERNAL', message: 'NullPointerException' }] });
    expect(screen.getByRole('heading', { name: 'Setup service' })).toBeInTheDocument();
    expect(screen.getByTestId('build-problems-headline'))
      .toHaveTextContent('The setup service failed; this is not caused by your models · 1 problem');
  });

  it('opens a reaction problem with its file id and line', () => {
    const { onOpenProblem } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Line 51, column 30.*Open at line 51, column 30/ }));
    expect(onOpenProblem).toHaveBeenCalledWith(reactionProblem);
  });

  it('opens a metamodel problem without a line', () => {
    const { onOpenProblem } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /The package has no nsURI.*Open file/ }));
    expect(onOpenProblem).toHaveBeenCalledWith(metamodelProblem);
  });

  it('does not make problems without a file id clickable', () => {
    renderDialog();
    expect(screen.getAllByTestId('build-problem-open')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /Maven Central/ })).not.toBeInTheDocument();
  });

  it('does not make problems clickable without a navigation handler', () => {
    render(<BuildProblemsDialog failure={modelsFailure} title="Export failed" onClose={vi.fn()} />);
    expect(screen.queryByTestId('build-problem-open')).not.toBeInTheDocument();
  });

  it('says so when the file of a problem cannot be opened', () => {
    renderDialog(modelsFailure, vi.fn(() => false));
    fireEvent.click(screen.getByRole('button', { name: /Open file/ }));
    expect(screen.getByRole('status')).toHaveTextContent('families.ecore is not on the canvas of this project');
  });

  it('closes with Escape, the close buttons and the backdrop', () => {
    const { onClose } = renderDialog();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('keeps Tab focus inside the dialog', () => {
    renderDialog();
    const closeX = screen.getByRole('button', { name: 'Close dialog' });
    const closeFooter = screen.getByRole('button', { name: 'Close' });

    closeFooter.focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(closeX).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true });
    expect(closeFooter).toHaveFocus();
  });

  it('returns the focus to the previously focused element when closed', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const { rerender } = renderDialog();
    expect(trigger).not.toHaveFocus();

    rerender(<BuildProblemsDialog failure={null} title="" onClose={vi.fn()} />);
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('copies all problems as text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Copy details' }));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("my.reactions:\n- Line 51, column 30: Couldn't resolve"));
  });
});
