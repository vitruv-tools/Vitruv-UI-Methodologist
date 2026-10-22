import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditMetaModelModal } from '../../../components/ui/EditMetaModelModal';

// ── mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../services/api', () => ({
  apiService: {
    updateMetaModel: jest.fn(),
  },
}));

jest.mock('../../../components/ui/KeywordTagsInput', () => ({
  KeywordTagsInput: ({ value, onChange }: any) => (
    <div data-testid="keyword-tags-input">
      <button
        type="button"
        onClick={() => onChange([...value, 'tag'])}
        data-testid="add-tag-btn"
      >
        Add tag
      </button>
    </div>
  ),
}));

jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

const { apiService } = require('../../../services/api') as {
  apiService: { updateMetaModel: jest.Mock };
};

// ── shared fixtures ───────────────────────────────────────────────────────────

const baseMetaModel = {
  id: 42,
  name: 'MyModel',
  description: 'A test model',
  domain: 'Testing',
  keyword: ['ecore', 'uml'],
  ecoreFileId: 1,
  genModelFileId: 2,
};

const renderModal = (props: Partial<React.ComponentProps<typeof EditMetaModelModal>> = {}) =>
  render(
    <EditMetaModelModal
      isOpen
      onClose={jest.fn()}
      metaModel={baseMetaModel}
      {...props}
    />,
  );

// ── visibility ────────────────────────────────────────────────────────────────

describe('EditMetaModelModal – visibility', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <EditMetaModelModal isOpen={false} onClose={jest.fn()} metaModel={baseMetaModel} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the modal when isOpen is true', () => {
    renderModal();
    // The modal renders a heading / title — look for known form fields instead
    // since the exact heading text is implementation-dependent
    expect(screen.getByDisplayValue('MyModel')).toBeInTheDocument();
  });
});

// ── form population ───────────────────────────────────────────────────────────

describe('EditMetaModelModal – form population', () => {
  it('pre-fills the name field from the metaModel prop', () => {
    renderModal();
    expect(screen.getByDisplayValue('MyModel')).toBeInTheDocument();
  });

  it('pre-fills the description field', () => {
    renderModal();
    expect(screen.getByDisplayValue('A test model')).toBeInTheDocument();
  });

  it('pre-fills the domain field', () => {
    renderModal();
    expect(screen.getByDisplayValue('Testing')).toBeInTheDocument();
  });

  it('re-populates fields when metaModel prop changes', () => {
    const { rerender } = renderModal();
    rerender(
      <EditMetaModelModal
        isOpen
        onClose={jest.fn()}
        metaModel={{ ...baseMetaModel, name: 'UpdatedName' }}
      />,
    );
    expect(screen.getByDisplayValue('UpdatedName')).toBeInTheDocument();
  });
});

// ── keyboard / dismiss behaviour ──────────────────────────────────────────────

describe('EditMetaModelModal – keyboard / dismiss', () => {
  it('calls onClose when Escape is pressed', () => {
    const onClose = jest.fn();
    renderModal({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn();
    const { container } = renderModal({ onClose });
    // The outermost div IS the backdrop
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('does NOT close when the inner dialog card is clicked', () => {
    const onClose = jest.fn();
    renderModal({ onClose });
    // The name input is inside the card — clicking it should not close
    fireEvent.click(screen.getByDisplayValue('MyModel'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ── submit – success ──────────────────────────────────────────────────────────

describe('EditMetaModelModal – submit success', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    apiService.updateMetaModel.mockResolvedValue({});
  });
  afterEach(() => jest.useRealTimers());

  it('calls updateMetaModel with the form values on submit', async () => {
    const onClose = jest.fn();
    renderModal({ onClose });

    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(apiService.updateMetaModel).toHaveBeenCalledWith(
        '42',
        expect.objectContaining({ name: 'MyModel', description: 'A test model' }),
      );
    });
  });

  it('shows a success message after saving', async () => {
    renderModal();
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(screen.getByText(/Saved successfully/i)).toBeInTheDocument();
    });
  });

  it('calls onSuccess and onClose after the success timeout', async () => {
    const onSuccess = jest.fn();
    const onClose = jest.fn();
    renderModal({ onSuccess, onClose });

    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(apiService.updateMetaModel).toHaveBeenCalled());

    jest.runAllTimers();
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

// ── submit – error ────────────────────────────────────────────────────────────

describe('EditMetaModelModal – submit error', () => {
  it('shows the error message when updateMetaModel rejects', async () => {
    apiService.updateMetaModel.mockRejectedValueOnce(new Error('Server unavailable'));
    renderModal();

    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(screen.getByText(/Server unavailable/i)).toBeInTheDocument();
    });
  });
});

// ── submit disabled state ─────────────────────────────────────────────────────

describe('EditMetaModelModal – submit button state', () => {
  it('disables the submit button when name is empty', async () => {
    renderModal();
    const nameInput = screen.getByDisplayValue('MyModel');
    await userEvent.clear(nameInput);
    const btn = screen.getByRole('button', { name: /save/i });
    expect(btn).toBeDisabled();
  });
});
