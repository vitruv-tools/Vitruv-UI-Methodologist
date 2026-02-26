import React from 'react';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '../../../components/layout/Sidebar';

jest.mock('../../../components/ui/ToolsPanel', () => {
  const mockToolsPanel = jest.fn(() => <div data-testid="tools-panel" />);
  return {
    __esModule: true,
    ToolsPanel: mockToolsPanel,
    mockToolsPanel,
  };
});

const { mockToolsPanel } = require('../../../components/ui/ToolsPanel') as {
  mockToolsPanel: jest.Mock;
};

describe('Sidebar', () => {
  beforeEach(() => {
    mockToolsPanel.mockClear();
  });

  it('renders ToolsPanel with provided props', () => {
    const onUpload = jest.fn();
    const onDelete = jest.fn();

    render(
      <Sidebar
        onEcoreFileUpload={onUpload}
        onEcoreFileDelete={onDelete}
      />,
    );

    expect(mockToolsPanel).toHaveBeenCalled();
  });
});

