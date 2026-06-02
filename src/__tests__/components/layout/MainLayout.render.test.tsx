/**
 * Render-level tests for MainLayout.
 * The component is heavily coupled to routing and canvas dependencies,
 * so we mock those and focus on the JSX branches that are reachable:
 *  – welcome screen vs. canvas
 *  – left / right sidebar slots
 *  – topRightSlot and workspaceOverlay
 *  – showWorkspaceInfo flag
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── heavy dependency mocks ────────────────────────────────────────────────────

jest.mock('../../../components/layout/Header', () => ({
  Header: () => <div data-testid="header" />,
}));

jest.mock('../../../components/flow/FlowCanvas', () => {
  const { forwardRef, createElement } = require('react');
  return {
    FlowCanvas: forwardRef((_props: any, _ref: any) =>
      createElement('div', { 'data-testid': 'flow-canvas' }),
    ),
  };
});

jest.mock('../../../components/ui/ToolsPanel', () => ({
  ToolsPanel: () => <div data-testid="tools-panel" />,
}));

jest.mock('../../../utils/ecoreParser', () => ({
  parseEcoreFile: jest.fn(() => ({ nodes: [], edges: [] })),
  createSimpleEcoreDiagram: jest.fn(() => ({ nodes: [], edges: [] })),
}));

jest.mock('../../../utils/umlGenerator', () => ({
  generateUMLFromEcore: jest.fn(() => ({ nodes: [], edges: [] })),
}));

jest.mock('../../../utils/flowUtils', () => ({
  generateFlowId: jest.fn(() => 'test-id'),
  saveDocumentMeta: jest.fn(),
  saveDocumentData: jest.fn(),
}));

// ── helper ────────────────────────────────────────────────────────────────────

import { MainLayout } from '../../../components/layout/MainLayout';

const renderLayout = (props: React.ComponentProps<typeof MainLayout> = {}, path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <MainLayout {...props} />
    </MemoryRouter>,
  );

// ── tests ─────────────────────────────────────────────────────────────────────

describe('MainLayout – rendering', () => {
  it('renders without crashing with default props', () => {
    renderLayout();
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('renders the FlowCanvas by default (no welcome screen)', () => {
    renderLayout({ showWelcomeScreen: false });
    expect(screen.getByTestId('flow-canvas')).toBeInTheDocument();
  });

  it('renders welcome screen content when showWelcomeScreen=true', () => {
    renderLayout({ showWelcomeScreen: true });
    expect(screen.queryByTestId('flow-canvas')).not.toBeInTheDocument();
    // The welcome screen renders the vitruvius logo image
    expect(screen.getByAltText('Vitruvius')).toBeInTheDocument();
  });

  it('renders welcome screen on /mml routes regardless of showWelcomeScreen', () => {
    renderLayout({ showWelcomeScreen: false }, '/mml/something');
    expect(screen.queryByTestId('flow-canvas')).not.toBeInTheDocument();
    expect(screen.getByAltText('Vitruvius')).toBeInTheDocument();
  });
});

describe('MainLayout – slot props', () => {
  it('renders default ToolsPanel when no leftSidebar is provided', () => {
    renderLayout();
    expect(screen.getByTestId('tools-panel')).toBeInTheDocument();
  });

  it('renders custom leftSidebar when provided', () => {
    renderLayout({ leftSidebar: <div data-testid="custom-left">custom</div> });
    expect(screen.getByTestId('custom-left')).toBeInTheDocument();
    expect(screen.queryByTestId('tools-panel')).not.toBeInTheDocument();
  });

  it('renders topRightSlot when provided', () => {
    renderLayout({ topRightSlot: <button data-testid="top-right">Action</button> });
    expect(screen.getByTestId('top-right')).toBeInTheDocument();
  });

  it('renders workspaceOverlay when provided', () => {
    renderLayout({ workspaceOverlay: <div data-testid="overlay">Overlay</div> });
    expect(screen.getByTestId('overlay')).toBeInTheDocument();
  });

  it('does not render topRightSlot when not provided', () => {
    renderLayout();
    expect(screen.queryByTestId('top-right')).not.toBeInTheDocument();
  });
});

describe('MainLayout – showWorkspaceInfo', () => {
  it('renders workspace info badge when showWorkspaceInfo=true (default)', () => {
    renderLayout({ showWorkspaceInfo: true });
    expect(screen.getByText(/Workspace/i)).toBeInTheDocument();
  });

  it('hides workspace info badge when showWorkspaceInfo=false', () => {
    renderLayout({ showWorkspaceInfo: false });
    expect(screen.queryByText(/📁 Workspace/i)).not.toBeInTheDocument();
  });

  it('hides workspace info badge on /mml routes even when showWorkspaceInfo=true', () => {
    renderLayout({ showWorkspaceInfo: true }, '/mml/view');
    expect(screen.queryByText(/📁 Workspace/i)).not.toBeInTheDocument();
  });
});
