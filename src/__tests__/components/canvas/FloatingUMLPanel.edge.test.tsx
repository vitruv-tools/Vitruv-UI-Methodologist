/**
 * Edge-case tests for FloatingUMLPanel — complements the existing
 * FloatingUMLPanel.test.tsx with hover behaviour and prop variations.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingUMLPanel } from '../../../components/canvas/FloatingUMLPanel';

// ── mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../components/canvas/UMLDiagram', () => {
  const { forwardRef, useImperativeHandle, createElement } = require('react');
  return {
    UMLDiagram: forwardRef((_props: any, ref: any) => {
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

jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

// ── shared defaults ───────────────────────────────────────────────────────────

const mkProps = (overrides: Partial<React.ComponentProps<typeof FloatingUMLPanel>> = {}) => ({
  id: 'p1',
  title: 'Test Panel',
  fileName: 'Test.ecore',
  layoutScopeId: 'scope-1',
  ecoreContent: '<xml/>',
  zIndex: 10,
  onFocus: jest.fn(),
  onClose: jest.fn(),
  ...overrides,
});

// ── title variations ──────────────────────────────────────────────────────────

describe('FloatingUMLPanel – title', () => {
  it('renders a long title without truncation error', () => {
    const title = 'A'.repeat(120);
    render(<FloatingUMLPanel {...mkProps({ title })} />);
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it('renders an empty title gracefully', () => {
    render(<FloatingUMLPanel {...mkProps({ title: '' })} />);
    expect(screen.getByTestId('uml-diagram')).toBeInTheDocument();
  });
});

// ── close button hover ────────────────────────────────────────────────────────

describe('FloatingUMLPanel – back button hover', () => {
  it('does not throw on mouseEnter and mouseLeave of back button', () => {
    render(<FloatingUMLPanel {...mkProps()} />);
    const closeBtn = screen.getByTitle('Back');
    expect(() => {
      fireEvent.mouseEnter(closeBtn);
      fireEvent.mouseLeave(closeBtn);
    }).not.toThrow();
  });
});

// ── zoom button hover ─────────────────────────────────────────────────────────

describe('FloatingUMLPanel – ZoomButton hover', () => {
  it('does not throw on hover for all three zoom buttons', () => {
    render(<FloatingUMLPanel {...mkProps()} />);
    ['Zoom in', 'Zoom out', 'Fit to view'].forEach(title => {
      const btn = screen.getByTitle(title);
      expect(() => {
        fireEvent.mouseEnter(btn);
        fireEvent.mouseLeave(btn);
      }).not.toThrow();
    });
  });
});

// ── zIndex propagation ────────────────────────────────────────────────────────

describe('FloatingUMLPanel – zIndex', () => {
  it('renders with a high zIndex without crashing', () => {
    render(<FloatingUMLPanel {...mkProps({ zIndex: 9999 })} />);
    expect(screen.getByTestId('uml-diagram')).toBeInTheDocument();
  });
});

// ── multiple panels (different ids) ──────────────────────────────────────────

describe('FloatingUMLPanel – multiple instances', () => {
  it('calls the correct onClose id when two panels are rendered', () => {
    const onClose1 = jest.fn();
    const onClose2 = jest.fn();

    const { getAllByTitle } = render(
      <>
        <FloatingUMLPanel {...mkProps({ id: 'a', onClose: onClose1 })} />
        <FloatingUMLPanel {...mkProps({ id: 'b', onClose: onClose2 })} />
      </>,
    );

    const closeBtns = getAllByTitle('Back');
    fireEvent.click(closeBtns[0]);
    expect(onClose1).toHaveBeenCalledWith('a');
    expect(onClose2).not.toHaveBeenCalled();

    fireEvent.click(closeBtns[1]);
    expect(onClose2).toHaveBeenCalledWith('b');
  });
});
