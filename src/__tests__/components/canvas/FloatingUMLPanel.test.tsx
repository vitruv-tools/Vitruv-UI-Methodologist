import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FloatingUMLPanel } from '../../../components/canvas/FloatingUMLPanel';
import type { UmlDiagramSaveContext } from '../../../components/canvas/UMLDiagram';

let lastDiagramProps: Record<string, unknown> = {};
const mockIsDirty = vi.fn(() => false);
const mockTryEscape = vi.fn(() => false);
const mockReload = vi.fn();
const mockSave = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../components/canvas/UMLDiagram', async () => {
  const { forwardRef, useImperativeHandle, createElement } = (await import('react'));
  return {
    WORKSPACE_DOT_BACKGROUND: {},
    UMLDiagram: forwardRef((props: any, ref: any) => {
      lastDiagramProps = props;
      useImperativeHandle(ref, () => ({
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        fitToView: vi.fn(),
        flushLayout: vi.fn(),
        reload: mockReload,
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: vi.fn(() => false),
        canRedo: vi.fn(() => false),
        isDirty: mockIsDirty,
        save: mockSave,
        tryEscape: mockTryEscape,
      }));
      return createElement('div', { 'data-testid': 'uml-diagram' });
    }),
  };
});

vi.mock('../../../utils/umlLayoutStorage', () => ({
  hasSavedUmlLayout: vi.fn(() => false),
}));

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<any>('react-dom');
  const mocked = {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
  return { ...mocked, default: mocked };
});

const defaultProps = {
  id: 'panel-1',
  title: 'My Ecore Model',
  fileName: 'MyModel.ecore',
  layoutScopeId: 'project-1',
  ecoreContent: '<xml/>',
  zIndex: 100,
  onFocus: vi.fn(),
  onClose: vi.fn(),
};

const saveContext: UmlDiagramSaveContext = {
  metaModelId: '1',
  ecoreFileId: 7,
  modelName: 'My Ecore Model',
  saveTarget: 'library',
};

/** Lets the save that the shortcut schedules on the next tick run. */
const flushScheduledSave = () => new Promise(resolve => setTimeout(resolve, 0));

describe('FloatingUMLPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastDiagramProps = {};
    mockIsDirty.mockReturnValue(false);
    mockTryEscape.mockReturnValue(false);
    mockReload.mockClear();
  });

  it('renders the UMLDiagram', () => {
    render(<FloatingUMLPanel {...defaultProps} />);
    expect(screen.getByTestId('uml-diagram')).toBeInTheDocument();
  });

  it('moves the keyboard focus into the editor when it opens', () => {
    render(<button type="button">Open UML</button>);
    screen.getByRole('button', { name: 'Open UML' }).focus();

    render(<FloatingUMLPanel {...defaultProps} />);

    expect(screen.getByTestId('uml-fullscreen-page')).toHaveFocus();
  });

  it('passes fileName and layoutScopeId to UMLDiagram for layout persistence', () => {
    render(<FloatingUMLPanel {...defaultProps} />);
    expect(lastDiagramProps.fileName).toBe('MyModel.ecore');
    expect(lastDiagramProps.layoutScopeId).toBe('project-1');
    expect(lastDiagramProps.ecoreContent).toBe('<xml/>');
  });

  it('calls onClose with the panel id when the back button is clicked', () => {
    const onClose = vi.fn();
    render(<FloatingUMLPanel {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('uml-page-back'));
    expect(onClose).toHaveBeenCalledWith('panel-1');
  });

  it('renders the Vitruv toolbar with logo, UML badge, and title', () => {
    render(<FloatingUMLPanel {...defaultProps} />);
    expect(screen.getByTestId('uml-page-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('uml-toolbar-logo')).toBeInTheDocument();
    expect(screen.getByTestId('uml-toolbar-badge')).toHaveTextContent('UML');
    expect(screen.getByText('My Ecore Model')).toBeInTheDocument();
    expect(screen.getByTestId('uml-toolbar-reload')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Switch to (dark|light) mode/ })).toBeInTheDocument();
  });

  it('renders as a fullscreen page overlay', () => {
    render(<FloatingUMLPanel {...defaultProps} />);
    expect(screen.getByTestId('uml-fullscreen-page')).toBeInTheDocument();
  });

  it('calls onClose with the panel id when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<FloatingUMLPanel {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledWith('panel-1');
  });

  it('shows unsaved changes dialog when closing with dirty diagram', () => {
    mockIsDirty.mockReturnValue(true);
    const onClose = vi.fn();
    render(<FloatingUMLPanel {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('uml-page-back'));
    expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the unsaved changes dialog above the full-screen editor', () => {
    mockIsDirty.mockReturnValue(true);
    render(<FloatingUMLPanel {...defaultProps} zIndex={10002} />);

    fireEvent.click(screen.getByTestId('uml-page-back'));

    expect(screen.getByTestId('uml-fullscreen-page')).toHaveStyle({ zIndex: '10002' });
    const backdrop = screen
      .getAllByRole('button', { hidden: true })
      .find(button => button.getAttribute('aria-hidden') === 'true');
    expect(backdrop).toHaveStyle({ zIndex: '10003' });
  });

  it('closes without saving when unsaved dialog is confirmed', () => {
    mockIsDirty.mockReturnValue(true);
    const onClose = vi.fn();
    render(<FloatingUMLPanel {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('uml-page-back'));
    fireEvent.click(screen.getByText('Close without saving'));
    expect(onClose).toHaveBeenCalledWith('panel-1');
  });

  it('renders zoom-in, zoom-out and fit-to-view buttons', () => {
    render(<FloatingUMLPanel {...defaultProps} />);
    expect(screen.getByTitle('Zoom in')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom out')).toBeInTheDocument();
    expect(screen.getByTitle('Fit to view')).toBeInTheDocument();
  });

  it('fetches ecore and reloads the diagram when reload is clicked', async () => {
    const fetchEcoreFile = vi.fn().mockResolvedValue('<ecore>fresh</ecore>');
    const onEcoreContentUpdated = vi.fn();
    render(
      <FloatingUMLPanel
        {...defaultProps}
        ecoreFileId={42}
        fetchEcoreFile={fetchEcoreFile}
        onEcoreContentUpdated={onEcoreContentUpdated}
      />,
    );

    fireEvent.click(screen.getByTestId('uml-toolbar-reload'));

    await screen.findByTestId('uml-reload-message');
    expect(fetchEcoreFile).toHaveBeenCalledWith(42);
    expect(onEcoreContentUpdated).toHaveBeenCalledWith('<ecore>fresh</ecore>');
    expect(mockReload).toHaveBeenCalledWith('<ecore>fresh</ecore>');
    expect(screen.getByTestId('uml-reload-message')).toHaveTextContent('Reloaded');
  });
});

describe('FloatingUMLPanel save shortcut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDirty.mockReturnValue(true);
  });

  it.each([
    ['Cmd+S', { metaKey: true }],
    ['Ctrl+S', { ctrlKey: true }],
  ])('saves the diagram on %s instead of opening the browser save dialog', async (_label, modifier) => {
    render(<FloatingUMLPanel {...defaultProps} saveContext={saveContext} saveShortcutEnabled />);

    const notPrevented = fireEvent.keyDown(window, { key: 's', ...modifier });

    expect(notPrevented).toBe(false);
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
  });

  it('commits the focused inline input before saving', async () => {
    render(<FloatingUMLPanel {...defaultProps} saveContext={saveContext} saveShortcutEnabled />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const onBlur = vi.fn();
    input.addEventListener('blur', onBlur);

    const notPrevented = fireEvent.keyDown(input, { key: 's', metaKey: true });

    expect(notPrevented).toBe(false);
    expect(onBlur).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    input.remove();
  });

  it('does not save when there are no unsaved changes', async () => {
    mockIsDirty.mockReturnValue(false);
    render(<FloatingUMLPanel {...defaultProps} saveContext={saveContext} saveShortcutEnabled />);

    const notPrevented = fireEvent.keyDown(window, { key: 's', metaKey: true });
    await flushScheduledSave();

    expect(notPrevented).toBe(false);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('only blocks the browser save dialog in view-only mode', async () => {
    render(<FloatingUMLPanel {...defaultProps} saveContext={saveContext} saveShortcutEnabled viewOnly />);

    const notPrevented = fireEvent.keyDown(window, { key: 's', metaKey: true });
    await flushScheduledSave();

    expect(notPrevented).toBe(false);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('ignores Cmd+S when the save shortcut is not enabled', async () => {
    render(<FloatingUMLPanel {...defaultProps} saveContext={saveContext} />);

    const notPrevented = fireEvent.keyDown(window, { key: 's', metaKey: true });
    await flushScheduledSave();

    expect(notPrevented).toBe(true);
    expect(mockSave).not.toHaveBeenCalled();
  });
});
