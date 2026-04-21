import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { UMLViewerModal } from '../../../components/flow/UMLViewerModal';

jest.mock('reactflow', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="reactflow-mock">{children}</div>,
  Background: () => <div data-testid="background" />,
  MiniMap: () => <div data-testid="minimap" />,
}));

jest.mock('../../../utils/umlGenerator', () => ({
  generateUMLFromEcore: () => ({
    nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Class1' }, type: 'editable' }],
    edges: [],
  }),
}));

describe('UMLViewerModal', () => {
  it('returns null when not open', () => {
    const { container } = render(
      <UMLViewerModal
        isOpen={false}
        ecoreContent="<ecore/>"
        onClose={jest.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders when open with title', () => {
    render(
      <UMLViewerModal
        isOpen
        title="My UML"
        ecoreContent="<ecore/>"
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText(/My UML/i)).toBeInTheDocument();
    expect(screen.getByTestId('reactflow-mock')).toBeInTheDocument();
  });
});


describe('UMLViewerModal – additional tests', () => {
  it('uses "UML Diagram" as default title when title prop is not provided', () => {
    render(
      <UMLViewerModal isOpen ecoreContent="<ecore/>" onClose={jest.fn()} />,
    );
    expect(screen.getByText('UML Diagram')).toBeInTheDocument();
  });

  it('calls onClose when the ✕ close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <UMLViewerModal isOpen title="My Modal" ecoreContent="<ecore/>" onClose={onClose} />,
    );
    fireEvent.click(screen.getByTitle(/Close/i));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders backdrop button that calls onClose', () => {
    const onClose = jest.fn();
    render(
      <UMLViewerModal isOpen ecoreContent="<ecore/>" onClose={onClose} />,
    );
    // aria-hidden backdrop button
    const backdrop = document.querySelector('button[aria-hidden="true"]') as HTMLButtonElement;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders MiniMap and Background when open', () => {
    render(
      <UMLViewerModal isOpen ecoreContent="<ecore/>" onClose={jest.fn()} />,
    );
    expect(screen.getByTestId('minimap')).toBeInTheDocument();
    expect(screen.getByTestId('background')).toBeInTheDocument();
  });

  it('renders the fit view ⛶ button', () => {
    render(
      <UMLViewerModal isOpen ecoreContent="<ecore/>" onClose={jest.fn()} />,
    );
    expect(screen.getByTitle(/Fit view/i)).toBeInTheDocument();
  });

  it('renders inside a <dialog> element when open', () => {
    const { container } = render(
      <UMLViewerModal isOpen ecoreContent="<ecore/>" onClose={jest.fn()} />,
    );
    expect(container.querySelector('dialog')).not.toBeNull();
  });
});