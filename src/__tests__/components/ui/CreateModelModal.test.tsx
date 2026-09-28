import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CreateModelModal } from '../../../components/ui/CreateModelModal';
import { resetThemeStore, setTheme } from '../../../theme/theme';

// ─── environment polyfills ────────────────────────────────────────────────────

// Provide crypto.getRandomValues so getSecureRandomInt works in jsdom
beforeAll(() => {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      getRandomValues: (arr: Uint32Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 0xffffffff);
        }
        return arr;
      },
    },
    writable: true,
    configurable: true,
  });
});

// ─── module mocks ─────────────────────────────────────────────────────────────

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

// ─── helpers ──────────────────────────────────────────────────────────────────

const fillRequiredFields = () => {
  fireEvent.change(screen.getByPlaceholderText(/Enter meta model name/i), {
    target: { value: 'Test Model' },
  });
  fireEvent.change(screen.getByPlaceholderText(/Enter description/i), {
    target: { value: 'A description' },
  });
  fireEvent.change(screen.getByPlaceholderText(/Enter domain/i), {
    target: { value: 'Testing' },
  });
  fireEvent.click(screen.getByText('Add KW'));
};

const uploadEcoreViaFileMode = async () => {
  const ecoreInput = document.querySelector(
    'input[accept=".ecore"]',
  ) as HTMLInputElement;

  const file = new File(['<ecore/>'], 'a.ecore', {
    type: 'application/octet-stream',
  });

  await act(async () => {
    fireEvent.change(ecoreInput, {
      target: { files: [file] },
    });
  });

  await waitFor(() => {
    expect(apiService.uploadFile).toHaveBeenCalledWith(file, 'ECORE');
  });
};

const mockFetchOk = (content = '<content/>') => {
  const blob = new Blob([content], { type: 'application/octet-stream' });
  (global as any).fetch = jest.fn().mockResolvedValue({
    ok: true,
    blob: jest.fn().mockResolvedValue(blob),
  });
};

const mockFetchFail = (status = 404, statusText = 'Not Found') => {
  (global as any).fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    statusText,
  });
};

// ─── tests ────────────────────────────────────────────────────────────────────

describe('CreateModelModal', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Reset call history and queued one-time implementations before each test.
    apiService.uploadFile.mockResolvedValue({ data: { id: 10 } });
    apiService.deleteFile.mockResolvedValue({});
    apiService.createMetaModel.mockResolvedValue({ data: { id: 1, name: 'MM' } });
    delete (global as any).fetch;
  });

  afterEach(() => {
    resetThemeStore();
  });

  // ── rendering ───────────────────────────────────────────────────────────────

  it('renders only the Ecore upload input', () => {
    render(<CreateModelModal isOpen onClose={jest.fn()} />);
    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(1);
    expect(document.querySelector('input[accept=".ecore"]')).toBeInTheDocument();
    expect(document.querySelector('input[accept=".genmodel"]')).not.toBeInTheDocument();
    expect(screen.queryByText('.genmodel')).not.toBeInTheDocument();
  });

  it('renders the modal title when open', () => {
    render(<CreateModelModal isOpen onClose={jest.fn()} />);
    expect(screen.getByText(/Import Meta Model/i)).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<CreateModelModal isOpen={false} onClose={jest.fn()} />);
    expect(screen.queryByText(/Import Meta Model/i)).not.toBeInTheDocument();
  });

  it('renders File and URL toggles for the Ecore card', () => {
    render(<CreateModelModal isOpen onClose={jest.fn()} />);
    expect(screen.getAllByText('File')).toHaveLength(1);
    expect(screen.getAllByText('URL')).toHaveLength(1);
  });

  it('shows drop-zones by default (file mode)', () => {
    render(<CreateModelModal isOpen onClose={jest.fn()} />);
    expect(screen.getAllByText(/Click to select file/i)).toHaveLength(1);
  });

  it('uses theme surfaces so file cards and the disabled submit button match dark mode', () => {
    setTheme('dark');
    render(<CreateModelModal isOpen onClose={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Complete All Fields' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: /Click to select file/i })).toHaveLength(2);
    expect(screen.getByText('Required Meta Model Files')).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const onClose = jest.fn();
    render(<CreateModelModal isOpen onClose={onClose} />);
    await act(async () => { fireEvent.click(screen.getByText('Cancel')); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the × button is clicked', async () => {
    const onClose = jest.fn();
    render(<CreateModelModal isOpen onClose={onClose} />);
    await act(async () => { fireEvent.click(screen.getByText('×')); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the modal open when the .ecore file picker is canceled', () => {
    const onClose = jest.fn();
    render(<CreateModelModal isOpen onClose={onClose} />);
    const ecoreInput = document.querySelector('input[accept=".ecore"]') as HTMLInputElement;

    fireEvent(ecoreInput, new Event('cancel', { bubbles: true, cancelable: true }));

    expect(onClose).not.toHaveBeenCalled();
  });

  // ── file upload mode ─────────────────────────────────────────────────────────

  describe('file upload mode', () => {
    it('uploads a valid .ecore file and calls uploadFile with ECORE type', async () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      const ecoreInput = document.querySelector('input[accept=".ecore"]') as HTMLInputElement;
      const file = new File(['<ecore/>'], 'model.ecore', { type: 'application/octet-stream' });
      await act(async () => {
        fireEvent.change(ecoreInput, { target: { files: [file] } });
      });
      await waitFor(() => {
        expect(apiService.uploadFile).toHaveBeenCalledWith(file, 'ECORE');
      });
    });

    it('shows an error when a non-.ecore file is selected', async () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      const ecoreInput = document.querySelector('input[accept=".ecore"]') as HTMLInputElement;
      const file = new File(['content'], 'model.txt', { type: 'text/plain' });
      await act(async () => {
        fireEvent.change(ecoreInput, { target: { files: [file] } });
      });
      expect(screen.getByText(/Please select a valid .ecore file/i)).toBeInTheDocument();
    });

    it('shows ✓ Ready badge after a successful .ecore upload', async () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      const ecoreInput = document.querySelector('input[accept=".ecore"]') as HTMLInputElement;
      const file = new File(['<ecore/>'], 'model.ecore', { type: 'application/octet-stream' });
      await act(async () => {
        fireEvent.change(ecoreInput, { target: { files: [file] } });
      });
      await waitFor(() => {
        expect(screen.getByText(/Ready/)).toBeInTheDocument();
      });
    });

    it('deletes the previous file before uploading a replacement', async () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      const ecoreInput = document.querySelector('input[accept=".ecore"]') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(ecoreInput, { target: { files: [new File(['<ecore/>'], 'first.ecore')] } });
      });
      await waitFor(() => expect(apiService.uploadFile).toHaveBeenCalledTimes(1));

      await act(async () => {
        fireEvent.change(ecoreInput, { target: { files: [new File(['<ecore2/>'], 'second.ecore')] } });
      });
      await waitFor(() => {
        expect(apiService.deleteFile).toHaveBeenCalledWith(10);
        expect(apiService.uploadFile).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ── URL import mode ──────────────────────────────────────────────────────────

  describe('URL import mode', () => {
    it('shows a URL input when switching .ecore card to URL mode', () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      fireEvent.click(screen.getByText('URL'));
      expect(screen.getByPlaceholderText(/model\.ecore/i)).toBeInTheDocument();
    });

    it('Import button is disabled when .ecore URL is empty', () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      fireEvent.click(screen.getByText('URL'));
      const importBtn = screen.getByText('Import').closest('button')!;
      expect(importBtn).toBeDisabled();
    });

    it('shows an error when .ecore URL has the wrong extension', async () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      fireEvent.click(screen.getByText('URL'));
      fireEvent.change(screen.getByPlaceholderText(/model\.ecore/i), {
        target: { value: 'https://example.com/model.txt' },
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Import'));
      });
      expect(screen.getByText(/URL must point to a .ecore file/i)).toBeInTheDocument();
    });

    it('imports a .ecore file from a valid URL and calls uploadFile with ECORE type', async () => {
      mockFetchOk('<ecore/>');
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      fireEvent.click(screen.getByText('URL'));
      fireEvent.change(screen.getByPlaceholderText(/model\.ecore/i), {
        target: { value: 'https://raw.githubusercontent.com/org/repo/main/model.ecore' },
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Import'));
      });
      await waitFor(() => {
        expect(apiService.uploadFile).toHaveBeenCalledWith(expect.any(File), 'ECORE');
      });
    });

    it('shows ✓ Ready badge after a successful .ecore URL import', async () => {
      mockFetchOk('<ecore/>');
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      fireEvent.click(screen.getByText('URL'));
      fireEvent.change(screen.getByPlaceholderText(/model\.ecore/i), {
        target: { value: 'https://raw.githubusercontent.com/org/repo/main/model.ecore' },
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Import'));
      });
      await waitFor(() => {
        expect(screen.getByText(/Ready/)).toBeInTheDocument();
      });
    });

    it('shows an error when the .ecore URL fetch returns a non-OK response', async () => {
      mockFetchFail(404, 'Not Found');
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      fireEvent.click(screen.getByText('URL'));
      fireEvent.change(screen.getByPlaceholderText(/model\.ecore/i), {
        target: { value: 'https://example.com/missing.ecore' },
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Import'));
      });
      await waitFor(() => {
        expect(screen.getByText(/Failed to import .ecore from URL/i)).toBeInTheDocument();
      });
    });

    it('switching back to file mode hides the URL input', () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      fireEvent.click(screen.getByText('URL'));
      expect(screen.getByPlaceholderText(/model\.ecore/i)).toBeInTheDocument();

      fireEvent.click(screen.getByText('File'));
      expect(screen.queryByPlaceholderText(/model\.ecore/i)).not.toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    const expectedRequest = {
      name: 'Test Model',
      description: 'A description',
      domain: 'Testing',
      keyword: ['kw'],
      ecoreFileId: 10,
    };

    it('disables submission until an Ecore file is uploaded', () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      fillRequiredFields();
      expect(screen.getByText('Complete All Fields')).toBeDisabled();
    });

    it('disables submission when required metadata is missing', async () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      await uploadEcoreViaFileMode();
      expect(screen.getByText('Complete All Fields')).toBeDisabled();
      expect(apiService.createMetaModel).not.toHaveBeenCalled();
    });

  it.each(['file', 'url'])(
  'creates once after an Ecore %s import',
  async (mode) => {
    const onSuccess = jest.fn();
    const onClose = jest.fn();

    render(
      <CreateModelModal
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    );

    fillRequiredFields();

    if (mode === 'file') {
      await uploadEcoreViaFileMode();
    } else {
      mockFetchOk('<ecore/>');

      fireEvent.click(screen.getByText('URL'));

      fireEvent.change(
        screen.getByPlaceholderText(/model\.ecore/i),
        {
          target: {
            value: 'https://example.com/model.ecore',
          },
        },
      );

      await act(async () => {
        fireEvent.click(screen.getByText('Import'));
      });

      await waitFor(() => {
        expect(apiService.uploadFile).toHaveBeenCalledWith(
          expect.any(File),
          'ECORE',
        );
      });
    }

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /Import Meta Model/i,
        }),
      ).toBeEnabled();
    });

    const submitButton = screen.getByRole('button', {
      name: /Import Meta Model/i,
    });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    expect(apiService.uploadFile).toHaveBeenCalledTimes(1);
    expect(apiService.uploadFile).toHaveBeenCalledWith(
      expect.any(File),
      'ECORE',
    );

    expect(apiService.createMetaModel).toHaveBeenCalledTimes(1);
    expect(apiService.createMetaModel).toHaveBeenCalledWith(
      expectedRequest,
    );

    expect(onSuccess).toHaveBeenCalledWith({
      ...expectedRequest,
      id: 1,
      name: 'MM',
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(apiService.deleteFile).not.toHaveBeenCalled();
  },
);

    it.each([
      ['network error', new Error('Network error'), 'Network error'],
      ['backend validation error', { response: { data: { message: 'Invalid Ecore model' } } }, 'Invalid Ecore model'],
    ])('reports a %s and cleans up the uploaded Ecore file', async (_label, error, message) => {
      apiService.createMetaModel.mockRejectedValueOnce(error);
      const onSuccess = jest.fn();
      render(<CreateModelModal isOpen onClose={jest.fn()} onSuccess={onSuccess} />);
      fillRequiredFields();
      await uploadEcoreViaFileMode();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Import Meta Model/i }));
      });

      await waitFor(() => {
        expect(screen.getByText(`Error creating meta model: ${message}`)).toBeInTheDocument();
      });
      expect(apiService.createMetaModel).toHaveBeenCalledTimes(1);
      expect(apiService.deleteFile).toHaveBeenCalledTimes(1);
      expect(apiService.deleteFile).toHaveBeenCalledWith(10);
      expect(onSuccess).not.toHaveBeenCalled();
      expect(screen.getByText('Complete All Fields')).toBeDisabled();
    });
  });
});
