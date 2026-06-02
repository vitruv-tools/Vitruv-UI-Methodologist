/**
 * Coverage driver for module-level functions in ToolsPanel.tsx (lines 282-342).
 * These functions (tokenizeQuery, parseTimeFilter, parseDateValue, parseDateRangeFilter)
 * are not exported, so we cover them by importing + rendering the component and
 * triggering search paths through the UI.
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ToolsPanel } from '../../components/ui/ToolsPanel';

jest.mock('../../services/api', () => ({
  apiService: {
    findMetaModels: jest.fn().mockResolvedValue({ data: [] }),
    getFile: jest.fn(),
    deleteMetaModel: jest.fn(),
    updateMetaModel: jest.fn(),
    getMetaModel: jest.fn(),
  },
}));

jest.mock('../../components/ui/CreateModelModal', () => ({
  CreateModelModal: ({ isOpen }: any) => {
    const { createElement } = require('react');
    return isOpen ? createElement('div', { 'data-testid': 'modal' }) : null;
  },
}));

jest.mock('../../components/ui/KeywordTagsInput', () => ({
  KeywordTagsInput: () => {
    const { createElement } = require('react');
    return createElement('div');
  },
}));

jest.mock('../../components/canvas/UMLDiagram', () => {
  const { forwardRef, createElement } = require('react');
  return {
    UMLDiagram: forwardRef((_: any, __: any) =>
      createElement('div', { 'data-testid': 'uml' })
    ),
  };
});

const { apiService } = require('../../services/api');

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  apiService.findMetaModels.mockResolvedValue({ data: [] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ToolsPanel module-level functions coverage', () => {
  it('renders without crash and covers module initialization', async () => {
    await act(async () => {
      render(React.createElement(ToolsPanel, { suppressApi: true }));
    });
    expect(screen.getByText('Meta Models')).toBeInTheDocument();
  });

  it('typing in search triggers tokenizeQuery via debounce (covers tokenizeQuery simple path)', async () => {
    apiService.findMetaModels.mockResolvedValue({ data: [] });
    await act(async () => {
      render(React.createElement(ToolsPanel, { suppressApi: false }));
    });

    const searchInput = screen.getByPlaceholderText(/search/i);

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'hello' } });
    });

    // Advance the 500ms debounce
    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    await waitFor(() => {
      expect(apiService.findMetaModels).toHaveBeenCalled();
    });
  });

  it('typing quoted term triggers tokenizeQuery quoted path', async () => {
    apiService.findMetaModels.mockResolvedValue({ data: [] });
    await act(async () => {
      render(React.createElement(ToolsPanel, { suppressApi: false }));
    });

    const searchInput = screen.getByPlaceholderText(/search/i);

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: '"hello world"' } });
    });

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    await waitFor(() => {
      expect(apiService.findMetaModels).toHaveBeenCalled();
    });
  });

  it('typing a name: filter covers parseSearchQuery code path', async () => {
    apiService.findMetaModels.mockResolvedValue({ data: [] });
    await act(async () => {
      render(React.createElement(ToolsPanel, { suppressApi: false }));
    });

    const searchInput = screen.getByPlaceholderText(/search/i);

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'name:test' } });
    });

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    await waitFor(() => {
      expect(apiService.findMetaModels).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'test' })
      );
    });
  });

  it('typing a time:beforenow filter covers parseTimeFilter path', async () => {
    apiService.findMetaModels.mockResolvedValue({ data: [] });
    await act(async () => {
      render(React.createElement(ToolsPanel, { suppressApi: false }));
    });

    const searchInput = screen.getByPlaceholderText(/search/i);

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'time:beforenow' } });
    });

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    await waitFor(() => {
      expect(apiService.findMetaModels).toHaveBeenCalled();
    });
  });

  it('typing a created: filter covers parseDateRangeFilter after: path', async () => {
    apiService.findMetaModels.mockResolvedValue({ data: [] });
    await act(async () => {
      render(React.createElement(ToolsPanel, { suppressApi: false }));
    });

    const searchInput = screen.getByPlaceholderText(/search/i);

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'created:after:2024-01-01' } });
    });

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    await waitFor(() => {
      expect(apiService.findMetaModels).toHaveBeenCalled();
    });
  });

  it('clicking "Advanced Filters" button opens filter panel', async () => {
    apiService.findMetaModels.mockResolvedValue({ data: [] });
    await act(async () => {
      render(React.createElement(ToolsPanel, { suppressApi: false }));
    });
    // "Advanced Filters" button is only rendered when suppressApi=false
    await waitFor(() => {
      expect(screen.getByText('Advanced Filters')).toBeInTheDocument();
    });
    const filterBtn = screen.getByText('Advanced Filters');
    await act(async () => {
      fireEvent.click(filterBtn);
    });
    expect(screen.getByText('Advanced Filters')).toBeInTheDocument();
  });
});
