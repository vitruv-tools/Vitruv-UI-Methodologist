/**
 * Tests for ApiService.
 * All network calls are intercepted with jest.spyOn(global, 'fetch').
 * AuthService is mocked so tokens are provided without hitting localStorage.
 */

import { apiService } from '../../services/api';

// ── mock AuthService ──────────────────────────────────────────────────────────

jest.mock('../../services/auth', () => ({
  AuthService: {
    ensureValidToken: jest.fn().mockResolvedValue('mock-token'),
    refreshToken: jest.fn().mockResolvedValue(null),
    getFastLoginAuthorizationUrl: jest.fn().mockReturnValue('https://auth.example.com/login'),
  },
}));

// ── fetch helpers ─────────────────────────────────────────────────────────────

const mockFetch = (body: unknown, status = 200) => {
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body);
  jest.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: async () => bodyText,
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    blob: async () => new Blob([bodyText]),
  } as unknown as Response);
};

const mockFetchError = (message: string) => {
  jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error(message));
};

// ── publicRequest ─────────────────────────────────────────────────────────────

describe('ApiService – publicRequest', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns parsed JSON on 200', async () => {
    mockFetch({ data: 'hello' });
    const result = await (apiService as any).publicRequest('/test');
    expect(result).toEqual({ data: 'hello' });
  });

  it('throws on non-ok status', async () => {
    mockFetch({ message: 'Not found' }, 404);
    await expect((apiService as any).publicRequest('/missing')).rejects.toThrow();
  });

  it('includes message from JSON error body in thrown error', async () => {
    mockFetch({ message: 'Custom backend error' }, 400);
    await expect((apiService as any).publicRequest('/bad')).rejects.toThrow('Custom backend error');
  });
});

// ── authenticatedRequest ──────────────────────────────────────────────────────

describe('ApiService – authenticatedRequest', () => {
  const { AuthService } = require('../../services/auth') as {
    AuthService: { ensureValidToken: jest.Mock; refreshToken: jest.Mock };
  };

  beforeEach(() => {
    AuthService.ensureValidToken.mockResolvedValue('mock-token');
  });
  afterEach(() => jest.restoreAllMocks());

  it('returns parsed JSON on 200', async () => {
    mockFetch({ data: [1, 2, 3] });
    const result = await (apiService as any).authenticatedRequest('/items');
    expect(result).toEqual({ data: [1, 2, 3] });
  });

  it('returns null for 204 No Content', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 204,
      text: async () => '',
      json: async () => null,
    } as unknown as Response);
    const result = await (apiService as any).authenticatedRequest('/empty', { method: 'DELETE' });
    expect(result).toBeNull();
  });

  it('throws when no token is available', async () => {
    AuthService.ensureValidToken.mockResolvedValueOnce(null);
    await expect((apiService as any).authenticatedRequest('/secure')).rejects.toThrow(
      'No valid authentication token available',
    );
  });

  it('throws on 4xx error response', async () => {
    mockFetch({ message: 'Forbidden' }, 403);
    await expect((apiService as any).authenticatedRequest('/forbidden')).rejects.toThrow();
  });

  it('retries with refreshed token on 401', async () => {
    // First call → 401; refresh produces a new token; second call → 200
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: false, status: 401, statusText: 'Unauthorized',
        text: async () => '{"message":"Unauthorized"}',
        json: async () => ({ message: 'Unauthorized' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true, status: 200, statusText: 'OK',
        text: async () => '{"data":"retried"}',
        json: async () => ({ data: 'retried' }),
      } as unknown as Response);

    AuthService.ensureValidToken
      .mockResolvedValueOnce('old-token')
      .mockResolvedValueOnce('new-token');

    const result = await (apiService as any).authenticatedRequest('/retry');
    expect(result).toEqual({ data: 'retried' });
  });
});

// ── uploadFile ────────────────────────────────────────────────────────────────

describe('ApiService – uploadFile', () => {
  const { AuthService } = require('../../services/auth') as {
    AuthService: { ensureValidToken: jest.Mock };
  };

  beforeEach(() => {
    AuthService.ensureValidToken.mockResolvedValue('mock-token');
  });
  afterEach(() => jest.restoreAllMocks());

  it('throws when no token is available', async () => {
    AuthService.ensureValidToken.mockResolvedValueOnce(null);
    const file = new File(['content'], 'test.ecore', { type: 'text/xml' });
    await expect(apiService.uploadFile(file, 'ECORE')).rejects.toThrow(
      'No valid authentication token available',
    );
  });

  it('returns result on successful upload', async () => {
    mockFetch({ data: 'file-id-42', message: 'Uploaded' });
    const file = new File(['<xml/>'], 'model.ecore', { type: 'text/xml' });
    const result = await apiService.uploadFile(file, 'ECORE');
    expect(result).toEqual({ data: 'file-id-42', message: 'Uploaded' });
  });

  it('throws on upload failure', async () => {
    mockFetch({ message: 'File too large' }, 413);
    const file = new File(['<xml/>'], 'model.ecore', { type: 'text/xml' });
    await expect(apiService.uploadFile(file, 'ECORE')).rejects.toThrow();
  });
});

// ── createMetaModel ───────────────────────────────────────────────────────────

describe('ApiService – createMetaModel', () => {
  const { AuthService } = require('../../services/auth') as { AuthService: { ensureValidToken: jest.Mock } };
  beforeEach(() => { AuthService.ensureValidToken.mockResolvedValue('mock-token'); });
  afterEach(() => jest.restoreAllMocks());

  it('sends POST with correct body and returns response', async () => {
    const payload = { data: { id: 1 }, message: 'Created' };
    mockFetch(payload);

    const result = await apiService.createMetaModel({
      name: 'TestModel',
      description: 'A test',
      domain: 'Testing',
      keyword: ['test'],
      ecoreFileId: 10,
      genModelFileId: 20,
    });

    expect(result).toEqual(payload);
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.name).toBe('TestModel');
    expect(body.applyGenModelFixes).toBe(false);
  });
});

// ── findMetaModels ────────────────────────────────────────────────────────────

describe('ApiService – findMetaModels', () => {
  const { AuthService } = require('../../services/auth') as { AuthService: { ensureValidToken: jest.Mock } };
  beforeEach(() => { AuthService.ensureValidToken.mockResolvedValue('mock-token'); });
  afterEach(() => jest.restoreAllMocks());

  it('calls the correct endpoint with POST and returns data array', async () => {
    const payload = { data: [{ id: 1, name: 'M1' }], message: 'OK' };
    mockFetch(payload);

    const result = await apiService.findMetaModels({}, 0, 20);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('M1');
  });

  it('passes filters as POST body', async () => {
    mockFetch({ data: [], message: 'OK' });
    await apiService.findMetaModels({ nameFilter: 'eco' }, 0, 10);

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ nameFilter: 'eco' });
  });
});

// ── deleteFile ────────────────────────────────────────────────────────────────

describe('ApiService – deleteFile', () => {
  const { AuthService } = require('../../services/auth') as { AuthService: { ensureValidToken: jest.Mock } };
  beforeEach(() => { AuthService.ensureValidToken.mockResolvedValue('mock-token'); });
  afterEach(() => jest.restoreAllMocks());

  it('resolves on 204', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true, status: 204,
      text: async () => '',
      json: async () => null,
    } as unknown as Response);

    await expect(apiService.deleteFile(5)).resolves.toBeNull();
  });

  it('throws on error response', async () => {
    mockFetch({ message: 'Not found' }, 404);
    await expect(apiService.deleteFile(999)).rejects.toThrow();
  });
});

// ── downloadVsumArtifact ───────────────────────────────────────────────────────

describe('ApiService – downloadVsumArtifact', () => {
  const { AuthService } = require('../../services/auth') as {
    AuthService: { ensureValidToken: jest.Mock; refreshToken: jest.Mock };
  };

  const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);

  const mockZipFetch = (status = 200) => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-type' ? 'application/zip' : null,
      },
      text: async () => '',
      blob: async () => new Blob([zipBytes], { type: 'application/zip' }),
    } as unknown as Response);
  };

  beforeEach(() => {
    AuthService.ensureValidToken.mockResolvedValue('mock-token');
  });
  afterEach(() => jest.restoreAllMocks());

  it('returns a ZIP blob on success', async () => {
    mockZipFetch();
    const blob = await apiService.downloadVsumArtifact(42);
    expect(blob.size).toBeGreaterThan(0);
    const header = new Uint8Array(await new Response(blob.slice(0, 2)).arrayBuffer());
    expect(header[0]).toBe(0x50);
    expect(header[1]).toBe(0x4b);
  });

  it('throws when the response body is JSON instead of a ZIP', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-type' ? 'application/json' : null,
      },
      text: async () => '{"message":"Build failed"}',
      blob: async () => new Blob(['{"message":"Build failed"}'], { type: 'application/json' }),
    } as unknown as Response);

    await expect(apiService.downloadVsumArtifact(42)).rejects.toThrow('Build failed');
  });

  it('throws on non-ok status', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Error',
      headers: { get: () => null },
      text: async () => '{"message":"Server error"}',
      blob: async () => new Blob([]),
    } as unknown as Response);

    await expect(apiService.downloadVsumArtifact(42)).rejects.toThrow('Server error');
  });
});

// ── updateUserName ────────────────────────────────────────────────────────────

describe('ApiService – updateUserName', () => {
  const { AuthService } = require('../../services/auth') as { AuthService: { ensureValidToken: jest.Mock } };
  beforeEach(() => { AuthService.ensureValidToken.mockResolvedValue('mock-token'); });
  afterEach(() => jest.restoreAllMocks());

  it('calls PUT /api/v1/users/{id} with firstName and lastName in body', async () => {
    mockFetch({ message: 'User updated successfully' });
    const fetchSpy = jest.spyOn(global, 'fetch');

    await apiService.updateUserName('42', 'Max', 'Oesterle');

    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/users/42');
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body as string)).toEqual({ firstName: 'Max', lastName: 'Oesterle' });
  });

  it('returns the server response on success', async () => {
    mockFetch({ message: 'User updated successfully' });
    const result = await apiService.updateUserName('42', 'Max', 'Oesterle');
    expect(result).toMatchObject({ message: expect.any(String) });
  });

  it('throws on non-2xx response', async () => {
    mockFetch({ message: 'Not found' }, 404);
    await expect(apiService.updateUserName('99', 'A', 'B')).rejects.toThrow();
  });
});

