import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CreateModelModal } from '../../../components/ui/CreateModelModal';

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
    jest.clearAllMocks();
    // Re-declare implementations after clearAllMocks to ensure they are always fresh
    apiService.uploadFile.mockResolvedValue({ data: { id: 10 } });
    apiService.deleteFile.mockResolvedValue({});
    apiService.createMetaModel.mockResolvedValue({ data: { id: 1, name: 'MM' } });
    delete (global as any).fetch;
  });

  // ── rendering ───────────────────────────────────────────────────────────────

  it('renders the modal title when open', () => {
    render(<CreateModelModal isOpen onClose={jest.fn()} />);
    expect(screen.getByText(/Import Meta Model/i)).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<CreateModelModal isOpen={false} onClose={jest.fn()} />);
    expect(screen.queryByText(/Import Meta Model/i)).not.toBeInTheDocument();
  });

  it('renders .ecore and .genmodel file type badges', () => {
    render(<CreateModelModal isOpen onClose={jest.fn()} />);
    expect(screen.getByText('.ecore')).toBeInTheDocument();
    expect(screen.getByText('.genmodel')).toBeInTheDocument();
  });

  it('renders ⬆ Computer and 🔗 URL toggles for both file cards', () => {
    render(<CreateModelModal isOpen onClose={jest.fn()} />);
    expect(screen.getAllByText('⬆ Computer')).toHaveLength(2);
    expect(screen.getAllByText('🔗 URL')).toHaveLength(2);
  });

  it('shows "Click to browse file" drop-zones by default (file mode)', () => {
    render(<CreateModelModal isOpen onClose={jest.fn()} />);
    expect(screen.getAllByText(/Click to browse file/i)).toHaveLength(2);
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

    it('uploads a valid .genmodel file and calls uploadFile with GEN_MODEL type', async () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      const genmodelInput = document.querySelector('input[accept=".genmodel"]') as HTMLInputElement;
      const file = new File(['<genmodel/>'], 'model.genmodel', { type: 'application/octet-stream' });
      await act(async () => {
        fireEvent.change(genmodelInput, { target: { files: [file] } });
      });
      await waitFor(() => {
        expect(apiService.uploadFile).toHaveBeenCalledWith(file, 'GEN_MODEL');
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

    it('shows an error when a non-.genmodel file is selected', async () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      const genmodelInput = document.querySelector('input[accept=".genmodel"]') as HTMLInputElement;
      const file = new File(['content'], 'model.txt', { type: 'text/plain' });
      await act(async () => {
        fireEvent.change(genmodelInput, { target: { files: [file] } });
      });
      expect(screen.getByText(/Please select a valid .genmodel file/i)).toBeInTheDocument();
    });

    it('shows ✓ Ready badge after a successful .ecore upload', async () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      const ecoreInput = document.querySelector('input[accept=".ecore"]') as HTMLInputElement;
      const file = new File(['<ecore/>'], 'model.ecore', { type: 'application/octet-stream' });
      await act(async () => {
        fireEvent.change(ecoreInput, { target: { files: [file] } });
      });
      await waitFor(() => {
        expect(screen.getByText(/✓ Ready/)).toBeInTheDocument();
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
      fireEvent.click(screen.getAllByText('🔗 URL')[0]);
      expect(screen.getByPlaceholderText(/model\.ecore/i)).toBeInTheDocument();
    });

    it('shows a URL input when switching .genmodel card to URL mode', () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      fireEvent.click(screen.getAllByText('🔗 URL')[1]);
      expect(screen.getByPlaceholderText(/model\.genmodel/i)).toBeInTheDocument();
    });

    it('Import button is disabled when .ecore URL is empty', () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      fireEvent.click(screen.getAllByText('🔗 URL')[0]);
      const importBtn = screen.getByText('Import').closest('button')!;
      expect(importBtn).toBeDisabled();
    });

    it('Import button is disabled when .genmodel URL is empty', () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      fireEvent.click(screen.getAllByText('🔗 URL')[1]);
      const importBtn = screen.getByText('Import').closest('button')!;
      expect(importBtn).toBeDisabled();
    });

    it('shows an error when .ecore URL has the wrong extension', async () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      fireEvent.click(screen.getAllByText('🔗 URL')[0]);
      fireEvent.change(screen.getByPlaceholderText(/model\.ecore/i), {
        target: { value: 'https://example.com/model.txt' },
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Import'));
      });
      expect(screen.getByText(/URL must point to a .ecore file/i)).toBeInTheDocument();
    });

    it('shows an error when .genmodel URL has the wrong extension', async () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      fireEvent.click(screen.getAllByText('🔗 URL')[1]);
      fireEvent.change(screen.getByPlaceholderText(/model\.genmodel/i), {
        target: { value: 'https://example.com/model.xml' },
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Import'));
      });
      expect(screen.getByText(/URL must point to a .genmodel file/i)).toBeInTheDocument();
    });

    it('imports a .ecore file from a valid URL and calls uploadFile with ECORE type', async () => {
      mockFetchOk('<ecore/>');
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      fireEvent.click(screen.getAllByText('🔗 URL')[0]);
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

    it('imports a .genmodel file from a valid URL and calls uploadFile with GEN_MODEL type', async () => {
      mockFetchOk('<genmodel/>');
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      fireEvent.click(screen.getAllByText('🔗 URL')[1]);
      fireEvent.change(screen.getByPlaceholderText(/model\.genmodel/i), {
        target: { value: 'https://raw.githubusercontent.com/org/repo/main/model.genmodel' },
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Import'));
      });
      await waitFor(() => {
        expect(apiService.uploadFile).toHaveBeenCalledWith(expect.any(File), 'GEN_MODEL');
      });
    });

    it('shows ✓ Ready badge after a successful .ecore URL import', async () => {
      mockFetchOk('<ecore/>');
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      fireEvent.click(screen.getAllByText('🔗 URL')[0]);
      fireEvent.change(screen.getByPlaceholderText(/model\.ecore/i), {
        target: { value: 'https://raw.githubusercontent.com/org/repo/main/model.ecore' },
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Import'));
      });
      await waitFor(() => {
        expect(screen.getByText(/✓ Ready/)).toBeInTheDocument();
      });
    });

    it('shows an error when the .ecore URL fetch returns a non-OK response', async () => {
      mockFetchFail(404, 'Not Found');
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      fireEvent.click(screen.getAllByText('🔗 URL')[0]);
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

    it('shows an error when the .genmodel URL fetch returns a non-OK response', async () => {
      mockFetchFail(500, 'Server Error');
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      fireEvent.click(screen.getAllByText('🔗 URL')[1]);
      fireEvent.change(screen.getByPlaceholderText(/model\.genmodel/i), {
        target: { value: 'https://example.com/missing.genmodel' },
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Import'));
      });
      await waitFor(() => {
        expect(screen.getByText(/Failed to import .genmodel from URL/i)).toBeInTheDocument();
      });
    });

    it('switching back to file mode hides the URL input', () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      fireEvent.click(screen.getAllByText('🔗 URL')[0]);
      expect(screen.getByPlaceholderText(/model\.ecore/i)).toBeInTheDocument();

      fireEvent.click(screen.getAllByText('⬆ Computer')[0]);
      expect(screen.queryByPlaceholderText(/model\.ecore/i)).not.toBeInTheDocument();
    });
  });

  // ── form submission ──────────────────────────────────────────────────────────

  describe('form submission', () => {
    it('Submit button is disabled when files are not yet uploaded', () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} />);
      fillRequiredFields();
      expect(screen.getByText('Complete All Fields')).toBeDisabled();
    });

    it('creates a meta model after both files are uploaded via file mode', async () => {
      render(<CreateModelModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);
      fillRequiredFields();

      const ecoreInput = document.querySelector('input[accept=".ecore"]') as HTMLInputElement;
      const genmodelInput = document.querySelector('input[accept=".genmodel"]') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(ecoreInput, { target: { files: [new File([''], 'a.ecore')] } });
      });
      await waitFor(() => expect(apiService.uploadFile).toHaveBeenCalledTimes(1));

      await act(async () => {
        fireEvent.change(genmodelInput, { target: { files: [new File([''], 'a.genmodel')] } });
      });
      await waitFor(() => expect(apiService.uploadFile).toHaveBeenCalledTimes(2));

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Import Meta Model/i }));
      });

      await waitFor(() => {
        expect(apiService.createMetaModel).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Model',
            description: 'A description',
            domain: 'Testing',
            ecoreFileId: 10,
            genModelFileId: 10,
            applyGenModelFixes: false,
          }),
        );
      });
    });

    it('creates a meta model after both files are imported via URL mode', async () => {
      mockFetchOk();
      render(<CreateModelModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);
      fillRequiredFields();

      // Import .ecore via URL
      fireEvent.click(screen.getAllByText('🔗 URL')[0]);
      fireEvent.change(screen.getByPlaceholderText(/model\.ecore/i), {
        target: { value: 'https://example.com/model.ecore' },
      });
      await act(async () => { fireEvent.click(screen.getByText('Import')); });
      await waitFor(() => expect(apiService.uploadFile).toHaveBeenCalledTimes(1));

      // Import .genmodel via URL
      fireEvent.click(screen.getAllByText('🔗 URL')[1]);
      fireEvent.change(screen.getByPlaceholderText(/model\.genmodel/i), {
        target: { value: 'https://example.com/model.genmodel' },
      });
      // After ecore import, its button shows "✓ Done"; only genmodel shows "Import"
      await act(async () => { fireEvent.click(screen.getByText('Import')); });
      await waitFor(() => expect(apiService.uploadFile).toHaveBeenCalledTimes(2));

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Import Meta Model/i }));
      });

      await waitFor(() => {
        expect(apiService.createMetaModel).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Model',
            ecoreFileId: 10,
            genModelFileId: 10,
          }),
        );
      });
    });
  });
});
