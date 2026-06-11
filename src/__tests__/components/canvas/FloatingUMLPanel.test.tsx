import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingUMLPanel } from '../../../components/canvas/FloatingUMLPanel';

// ── mocks ─────────────────────────────────────────────────────────────────────

// UMLDiagram is a complex canvas component — stub it out.
// Note: jest.mock factories are hoisted and cannot reference out-of-scope
// variables, so we use require() inside the factory.
let lastDiagramProps: Record<string, unknown> = {};

jest.mock('../../../components/canvas/UMLDiagram', () => {
  const { forwardRef, useImperativeHandle, createElement } = require('react');
  return {
    UMLDiagram: forwardRef((props: any, ref: any) => {
      lastDiagramProps = props;
      useImperativeHandle(ref, () => ({
        zoomIn: jest.fn(),
        zoomOut: jest.fn(),
        fitToView: jest.fn(),
        flushLayout: jest.fn(),
      }));
      return createElement('div', { 'data-testid': 'uml-diagram' });
    }),
  };
});

jest.mock('../../../utils/umlLayoutStorage', () => ({
  hasSavedUmlLayout: jest.fn(() => false),
}));

// createPortal renders directly into the document body during tests
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

// ── shared props ──────────────────────────────────────────────────────────────

const defaultProps = {
  id: 'panel-1',
  title: 'My Ecore Model',
  fileName: 'MyModel.ecore',
  layoutScopeId: 'project-1',
  ecoreContent: '<xml/>',
  zIndex: 100,
  onFocus: jest.fn(),
  onClose: jest.fn(),
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('FloatingUMLPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastDiagramProps = {};
  });

  it('renders the panel title', () => {
    render(<FloatingUMLPanel {...defaultProps} />);
    expect(screen.getByText('My Ecore Model')).toBeInTheDocument();
  });

  it('renders the UMLDiagram', () => {
    render(<FloatingUMLPanel {...defaultProps} />);
    expect(screen.getByTestId('uml-diagram')).toBeInTheDocument();
  });

  it('passes fileName and layoutScopeId to UMLDiagram for layout persistence', () => {
    render(<FloatingUMLPanel {...defaultProps} />);
    expect(lastDiagramProps.fileName).toBe('MyModel.ecore');
    expect(lastDiagramProps.layoutScopeId).toBe('project-1');
    expect(lastDiagramProps.ecoreContent).toBe('<xml/>');
  });

  it('calls onClose with the panel id when the back button is clicked', () => {
    const onClose = jest.fn();
    render(<FloatingUMLPanel {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTitle('Back to canvas'));
    expect(onClose).toHaveBeenCalledWith('panel-1');
  });

  it('calls onHome when the logo is clicked', () => {
    const onClose = jest.fn();
    const onHome = jest.fn();
    render(<FloatingUMLPanel {...defaultProps} onClose={onClose} onHome={onHome} />);
    fireEvent.click(screen.getByTitle('Back to overview'));
    expect(onClose).toHaveBeenCalledWith('panel-1');
    expect(onHome).toHaveBeenCalled();
  });

  it('shows Vitruvius logo, UML badge, and model title in the toolbar', () => {
    render(<FloatingUMLPanel {...defaultProps} />);
    expect(screen.getByTitle('Back to overview')).toBeInTheDocument();
    expect(screen.getByText('UML')).toBeInTheDocument();
    expect(screen.getByText('My Ecore Model')).toBeInTheDocument();
    expect(screen.getByTestId('uml-page-toolbar')).toBeInTheDocument();
  });

  it('renders as a fullscreen page overlay', () => {
    render(<FloatingUMLPanel {...defaultProps} />);
    expect(screen.getByTestId('uml-fullscreen-page')).toBeInTheDocument();
  });

  it('calls onClose with the panel id when Escape is pressed', () => {
    const onClose = jest.fn();
    render(<FloatingUMLPanel {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledWith('panel-1');
  });

  it('renders zoom-in, zoom-out and fit-to-view buttons', () => {
    render(<FloatingUMLPanel {...defaultProps} />);
    expect(screen.getByTitle('Zoom in')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom out')).toBeInTheDocument();
    expect(screen.getByTitle('Fit to view')).toBeInTheDocument();
  });

  it('does not throw when zoom buttons are clicked', () => {
    render(<FloatingUMLPanel {...defaultProps} />);
    expect(() => {
      fireEvent.click(screen.getByTitle('Zoom in'));
      fireEvent.click(screen.getByTitle('Zoom out'));
      fireEvent.click(screen.getByTitle('Fit to view'));
    }).not.toThrow();
  });
});
