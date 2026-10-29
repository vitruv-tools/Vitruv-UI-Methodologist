import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CanvasSidebarToolbar } from '../../../components/canvas/CanvasSidebarToolbar';

const labels = {
  select: 'Select. Move and select elements on the canvas',
  download: 'Download. Export this project',
  save: 'Save. Save changes to this project',
  checkBuild: 'Check build. Verify the project compiles successfully',
  addMetaModels: 'Add meta-models. Open the meta-model drawer to add models to the canvas',
  utilityMethods: 'Utility Methods. Define utility methods for reactions',
  utilityMethodsReadOnly: 'Utility Methods. View the utility methods available to reactions',
  viewReaction: 'View reaction. Select a connection line, then click to open the code',
  undoAvailable: 'Undo. Undo the last action',
  undoUnavailable: 'Undo. Nothing to undo',
  redoAvailable: 'Redo. Redo the last undone action',
  redoUnavailable: 'Redo. Nothing to redo',
};

const createProps = () => ({
  addReactionMode: false,
  onToggleReactionMode: vi.fn(),
  onOpenReactionEditor: vi.fn(),
  onToggleModelDrawer: vi.fn(),
  onDownloadProject: vi.fn(),
  onDownloadJar: vi.fn(),
  onDownloadBundle: vi.fn(),
  onSaveChanges: vi.fn(),
  onCheckBuild: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  canUndo: true,
  canRedo: true,
  downloadingProject: false,
  downloadingJar: false,
  downloadingBundle: false,
  savingChanges: false,
  checkingBuild: false,
});

beforeEach(() => {
  vi.clearAllMocks();
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
      labels.addMetaModels,
      labels.undoAvailable,
      labels.redoAvailable,
    ]);

    fireEvent.click(screen.getByRole('button', { name: labels.download }));
    fireEvent.click(screen.getByRole('button', { name: /Project export/ }));
    fireEvent.click(screen.getByRole('button', { name: labels.save }));
    fireEvent.click(screen.getByRole('button', { name: labels.checkBuild }));
    fireEvent.click(screen.getByRole('button', { name: labels.addMetaModels }));

    expect(props.onDownloadProject).toHaveBeenCalledTimes(1);
    expect(props.onSaveChanges).toHaveBeenCalledTimes(1);
    expect(props.onCheckBuild).toHaveBeenCalledTimes(1);
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
    expect(screen.queryByRole('button', { name: labels.addMetaModels })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: labels.undoAvailable })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: labels.redoAvailable })).not.toBeInTheDocument();
  });

  it('places the utility methods button above Add meta-models and opens the utility methods', () => {
    const onOpenUtilityMethods = jest.fn();
    render(<CanvasSidebarToolbar {...createProps()} onOpenUtilityMethods={onOpenUtilityMethods} />);

    const labelsInOrder = screen.getAllByRole('button').map(button => button.getAttribute('aria-label'));
    const utilityMethodsIndex = labelsInOrder.indexOf(labels.utilityMethods);
    expect(utilityMethodsIndex).toBeGreaterThan(-1);
    expect(labelsInOrder[utilityMethodsIndex + 1]).toBe(labels.addMetaModels);

    fireEvent.click(screen.getByRole('button', { name: labels.utilityMethods }));
    expect(onOpenUtilityMethods).toHaveBeenCalledTimes(1);
  });

  it('offers the utility methods overview to view-only members', () => {
    render(<CanvasSidebarToolbar {...createProps()} readOnly onOpenUtilityMethods={jest.fn()} />);

    expect(screen.getByRole('button', { name: labels.utilityMethodsReadOnly })).toBeInTheDocument();
  });

  it('Select exits only active reaction mode', () => {
    const props = createProps();
    const { rerender } = render(<CanvasSidebarToolbar {...props} />);

    fireEvent.click(screen.getByRole('button', { name: labels.select }));
    expect(props.onToggleReactionMode).not.toHaveBeenCalled();

    rerender(<CanvasSidebarToolbar {...props} addReactionMode />);

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
    expect(props.onDownloadProject).not.toHaveBeenCalled();
    expect(props.onSaveChanges).not.toHaveBeenCalled();
    expect(props.onCheckBuild).not.toHaveBeenCalled();
  });

  it('keeps save available while a build check is running', () => {
    const props = { ...createProps(), checkingBuild: true };
    render(<CanvasSidebarToolbar {...props} />);

    fireEvent.click(screen.getByRole('button', { name: labels.save }));

    expect(props.onSaveChanges).toHaveBeenCalledTimes(1);
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
    expect(props.onDownloadProject).not.toHaveBeenCalled();
    expect(screen.queryByText(/Easy deploy package/)).not.toBeInTheDocument();
  });

  it('offers the runnable JAR in the download menu', () => {
    const props = createProps();
    render(<CanvasSidebarToolbar {...props} />);

    fireEvent.click(screen.getByRole('button', { name: labels.download }));
    fireEvent.click(screen.getByRole('button', { name: /Runnable JAR/ }));

    expect(props.onDownloadJar).toHaveBeenCalledTimes(1);
    expect(props.onDownloadProject).not.toHaveBeenCalled();
    expect(props.onDownloadBundle).not.toHaveBeenCalled();
    expect(screen.queryByText(/Runnable JAR/)).not.toBeInTheDocument();
  });

  it('suppresses downloads while the runnable JAR is downloading', () => {
    const props = { ...createProps(), downloadingJar: true };
    render(<CanvasSidebarToolbar {...props} />);

    fireEvent.click(screen.getByRole('button', { name: labels.download }));
    fireEvent.click(screen.getByRole('button', { name: labels.checkBuild }));

    expect(props.onCheckBuild).not.toHaveBeenCalled();
    expect(screen.queryByText(/Runnable JAR/)).not.toBeInTheDocument();
  });

  it('closes the download menu on outside click without triggering a download', () => {
    const props = createProps();
    render(<CanvasSidebarToolbar {...props} />);

    fireEvent.click(screen.getByRole('button', { name: labels.download }));
    expect(screen.getByText('Project export')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByText('Project export')).not.toBeInTheDocument();
    expect(props.onDownloadProject).not.toHaveBeenCalled();
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
