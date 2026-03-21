import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { EditMetaModelModal } from '../../../components/ui/EditMetaModelModal';

jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

jest.mock('../../../services/api', () => ({
  apiService: {
    updateMetaModel: jest.fn().mockResolvedValue({}),
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
  apiService: { updateMetaModel: jest.Mock };
};

const baseMetaModel = {
  id: 1,
  name: 'Existing',
  description: 'Desc',
  domain: 'Domain',
  keyword: ['k1'],
  ecoreFileId: 10,
  genModelFileId: 20,
};

describe('EditMetaModelModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders prefilled data and closes on Cancel', () => {
    const onClose = jest.fn();

    render(
      <EditMetaModelModal
        isOpen
        onClose={onClose}
        metaModel={baseMetaModel}
        isOwner
      />,
    );

    expect(screen.getByDisplayValue('Existing')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('submits updated meta model', async () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    const onSuccess = jest.fn();

    render(
      <EditMetaModelModal
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
        metaModel={baseMetaModel}
        isOwner
      />,
    );

    fireEvent.change(screen.getByLabelText(/Name \*/i), {
      target: { value: 'Updated Name' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Update/i }));

    await waitFor(() => {
      expect(apiService.updateMetaModel).toHaveBeenCalledWith('1', expect.any(Object));
    });

    // wait for the internal timeout that calls onSuccess and onClose
    await act(async () => {
      jest.runAllTimers();
    });

    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    jest.useRealTimers();
  });
});

