import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReactDOM from 'react-dom';
import { CreateModelModal } from '../../../components/ui/CreateModelModal';

jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

jest.mock('../../../services/api', () => ({
  apiService: {
    uploadFile: jest.fn().mockResolvedValue({ data: { id: 10 } }),
    deleteFile: jest.fn().mockResolvedValue({}),
    createMetaModel: jest.fn().mockResolvedValue({ data: { id: 1, name: 'MM' } }),
  },
}));

jest.mock('../../../components/ui/KeywordTagsInput', () => ({
  KeywordTagsInput: ({ keywords, onChange }: any) => (
    <div>
      <span>Keyword Input</span>
      <button
        type="button"
        onClick={() => onChange([...(keywords || []), 'kw'])}
      >
        Add KW
      </button>
    </div>
  ),
}));

const { apiService } = require('../../../services/api') as {
  apiService: {
    uploadFile: jest.Mock;
    deleteFile: jest.Mock;
    createMetaModel: jest.Mock;
  };
};

describe('CreateModelModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when open', () => {
    render(
      <CreateModelModal
        isOpen
        onClose={jest.fn()}
      />,
    );

    // Smoke test: dialog title should be present
    expect(
      screen.getByText(/Import Meta Model/i),
    ).toBeInTheDocument();
  });
});

