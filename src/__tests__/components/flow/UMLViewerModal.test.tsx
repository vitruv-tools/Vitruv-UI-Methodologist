import React from 'react';
import { render, screen } from '@testing-library/react';
import { UMLViewerModal } from '../../../components/flow/UMLViewerModal';

jest.mock('reactflow', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="reactflow-mock">{children}</div>,
  Background: () => <div data-testid="background" />,
  MiniMap: () => <div data-testid="minimap" />,
}));

jest.mock('../../../utils/UMLFromEcoreTS', () => ({
  __esModule: true,
  buildAttributeSignature: jest.fn(),
  buildMethodSignature: jest.fn(),
  getHandleIdForEcoreElement: jest.fn(),
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

