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

  it('calls onClose with the panel id when the close button is clicked', () => {
    const onClose = jest.fn();
    render(<FloatingUMLPanel {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTitle('Close'));
    expect(onClose).toHaveBeenCalledWith('panel-1');
  });

  it('calls onClose with the panel id when the backdrop is clicked', () => {
    const onClose = jest.fn();
    const { container } = render(<FloatingUMLPanel {...defaultProps} onClose={onClose} />);
    // createPortal is mocked to render inline: the fragment's first child is the backdrop.
    // JSDOM serialises rgba() with spaces, so we target the element by position.
    const backdrop = container.children[0] as HTMLElement;
    fireEvent.click(backdrop);
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
