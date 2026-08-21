import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CanvasSidebarToolbar } from '../../../components/canvas/CanvasSidebarToolbar';

const labels = {
  select: 'Select. Move and select elements on the canvas',
  download: 'Download. Export this project',
  save: 'Save. Save changes to this project',
  checkBuild: 'Check build. Verify the project compiles successfully',
  addReaction: 'Add reaction. Click two meta-models to connect them',
  cancelReaction: 'Cancel reaction. Click to exit connection mode',
  addMetaModels: 'Add meta-models. Open the model library drawer',
  viewReaction: 'View reaction. Select a connection line, then click to open the code',
  undoAvailable: 'Undo. Undo the last action',
  undoUnavailable: 'Undo. Nothing to undo',
  redoAvailable: 'Redo. Redo the last undone action',
  redoUnavailable: 'Redo. Nothing to redo',
};

const createProps = () => ({
  addReactionMode: false,
  onToggleReactionMode: jest.fn(),
  onOpenReactionEditor: jest.fn(),
  onToggleModelDrawer: jest.fn(),
  onDownloadArtifact: jest.fn(),
  onDownloadBundle: jest.fn(),
  onSaveChanges: jest.fn(),
  onCheckBuild: jest.fn(),
  onUndo: jest.fn(),
  onRedo: jest.fn(),
  canUndo: true,
  canRedo: true,
  downloadingArtifact: false,
  downloadingBundle: false,
  savingChanges: false,
  checkingBuild: false,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CanvasSidebarToolbar', () => {
  it('renders editable controls in order and forwards action clicks', () => {
    const props = createProps();
    render(<CanvasSidebarToolbar {...props} />);

    expect(screen.getAllByRole('button').map(button => button.getAttribute('aria-label'))).toEqual([
      labels.select,
      labels.download,
      labels.save,
      labels.checkBuild,
      labels.addReaction,
      labels.addMetaModels,
      labels.undoAvailable,
      labels.redoAvailable,
    ]);

    fireEvent.click(screen.getByRole('button', { name: labels.download }));
    fireEvent.click(screen.getByRole('button', { name: /Project export/ }));
    fireEvent.click(screen.getByRole('button', { name: labels.save }));
    fireEvent.click(screen.getByRole('button', { name: labels.checkBuild }));
    fireEvent.click(screen.getByRole('button', { name: labels.addReaction }));
    fireEvent.click(screen.getByRole('button', { name: labels.addMetaModels }));

    expect(props.onDownloadArtifact).toHaveBeenCalledTimes(1);
    expect(props.onSaveChanges).toHaveBeenCalledTimes(1);
    expect(props.onCheckBuild).toHaveBeenCalledTimes(1);
    expect(props.onToggleReactionMode).toHaveBeenCalledTimes(1);
    expect(props.onToggleModelDrawer).toHaveBeenCalledTimes(1);
  });

  it('renders only permitted read-only controls', () => {
    const props = createProps();
    render(<CanvasSidebarToolbar {...props} readOnly />);

    expect(screen.getAllByRole('button').map(button => button.getAttribute('aria-label'))).toEqual([
      labels.select,
      labels.download,
      labels.viewReaction,
    ]);

    fireEvent.click(screen.getByRole('button', { name: labels.viewReaction }));

    expect(props.onOpenReactionEditor).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: labels.save })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: labels.checkBuild })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: labels.addReaction })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: labels.addMetaModels })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: labels.undoAvailable })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: labels.redoAvailable })).not.toBeInTheDocument();
  });

  it('changes the reaction action label and Select exits only active reaction mode', () => {
    const props = createProps();
    const { rerender } = render(<CanvasSidebarToolbar {...props} />);

    fireEvent.click(screen.getByRole('button', { name: labels.select }));
    expect(props.onToggleReactionMode).not.toHaveBeenCalled();

    rerender(<CanvasSidebarToolbar {...props} addReactionMode />);

    expect(screen.getByRole('button', { name: labels.cancelReaction })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: labels.select }));

    expect(props.onToggleReactionMode).toHaveBeenCalledTimes(1);
  });

  it('suppresses download, save, and build actions while any action is busy', () => {
    const props = { ...createProps(), savingChanges: true };
    render(<CanvasSidebarToolbar {...props} />);

    const downloadButton = screen.getByRole('button', { name: labels.download });
    const saveButton = screen.getByRole('button', { name: labels.save });
    const buildButton = screen.getByRole('button', { name: labels.checkBuild });

    fireEvent.click(downloadButton);
    fireEvent.click(saveButton);
    fireEvent.click(buildButton);

    expect(downloadButton).toHaveStyle({ cursor: 'not-allowed' });
    expect(saveButton).toHaveStyle({ cursor: 'not-allowed' });
    expect(buildButton).toHaveStyle({ cursor: 'not-allowed' });
    expect(props.onDownloadArtifact).not.toHaveBeenCalled();
    expect(props.onSaveChanges).not.toHaveBeenCalled();
    expect(props.onCheckBuild).not.toHaveBeenCalled();
  });

  it('disables unavailable undo and redo actions', () => {
    const props = { ...createProps(), canUndo: false, canRedo: false };
    render(<CanvasSidebarToolbar {...props} />);

    const undoButton = screen.getByRole('button', { name: labels.undoUnavailable });
    const redoButton = screen.getByRole('button', { name: labels.redoUnavailable });

    fireEvent.click(undoButton);
    fireEvent.click(redoButton);

    expect(undoButton).toHaveStyle({ cursor: 'not-allowed' });
    expect(redoButton).toHaveStyle({ cursor: 'not-allowed' });
    expect(props.onUndo).not.toHaveBeenCalled();
    expect(props.onRedo).not.toHaveBeenCalled();
  });

  it('opens a menu offering project export or the easy deploy package', () => {
    const props = createProps();
    render(<CanvasSidebarToolbar {...props} />);

    expect(screen.queryByText(/Easy deploy package/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: labels.download }));

    expect(screen.getByText('Project export')).toBeInTheDocument();
    expect(screen.getByText('Easy deploy package')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Easy deploy package/ }));

    expect(props.onDownloadBundle).toHaveBeenCalledTimes(1);
    expect(props.onDownloadArtifact).not.toHaveBeenCalled();
    expect(screen.queryByText(/Easy deploy package/)).not.toBeInTheDocument();
  });

  it('closes the download menu on outside click without triggering a download', () => {
    const props = createProps();
    render(<CanvasSidebarToolbar {...props} />);

    fireEvent.click(screen.getByRole('button', { name: labels.download }));
    expect(screen.getByText('Project export')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByText('Project export')).not.toBeInTheDocument();
    expect(props.onDownloadArtifact).not.toHaveBeenCalled();
    expect(props.onDownloadBundle).not.toHaveBeenCalled();
  });

  it('forwards available undo and redo actions', () => {
    const props = createProps();
    render(<CanvasSidebarToolbar {...props} />);

    fireEvent.click(screen.getByRole('button', { name: labels.undoAvailable }));
    fireEvent.click(screen.getByRole('button', { name: labels.redoAvailable }));

    expect(props.onUndo).toHaveBeenCalledTimes(1);
    expect(props.onRedo).toHaveBeenCalledTimes(1);
  });
});
