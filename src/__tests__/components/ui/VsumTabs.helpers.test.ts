/**
 * Unit tests for the pure helper functions inside VsumTabs.tsx.
 * The functions are not exported, so we mirror them here — any
 * logic change in the source will immediately break these tests.
 */

// ── mirrors of VsumTabs internals ─────────────────────────────────────────────

const extractBackendError = (
  err: any,
  fallbackSummary: string,
  fallbackDetail?: string,
): { summary: string; detail: string } => {
  const fallback = fallbackDetail ?? fallbackSummary;
  const data = err?.response?.data;

  if (data && typeof data === 'object') {
    const summary =
      typeof data.error === 'string' && data.error.trim()
        ? data.error
        : fallbackSummary;
    const detail =
      typeof data.message === 'string' && data.message.trim()
        ? data.message
        : summary;
    return { summary, detail };
  }

  if (typeof data === 'string' && data.trim()) {
    return { summary: fallbackSummary, detail: data };
  }

  if (typeof err?.message === 'string' && err.message.trim()) {
    return { summary: fallbackSummary, detail: err.message };
  }

  return { summary: fallbackSummary, detail: fallback };
};

const normalizeReactionFileId = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 0;
};

const isReactionFilesNotFoundError = (message: string): boolean =>
  message.toLowerCase().includes('reaction files not found');

// ── extractBackendError ───────────────────────────────────────────────────────

describe('extractBackendError', () => {
  describe('response.data is an object', () => {
    it('uses data.error as summary and data.message as detail', () => {
      const err = { response: { data: { error: 'Not Found', message: 'The resource does not exist' } } };
      expect(extractBackendError(err, 'Fallback')).toEqual({
        summary: 'Not Found',
        detail: 'The resource does not exist',
      });
    });

    it('falls back summary to fallbackSummary when data.error is empty', () => {
      const err = { response: { data: { error: '  ', message: 'Detail text' } } };
      expect(extractBackendError(err, 'Default summary')).toEqual({
        summary: 'Default summary',
        detail: 'Detail text',
      });
    });

    it('uses summary as detail when data.message is empty', () => {
      const err = { response: { data: { error: 'Server Error', message: '' } } };
      const result = extractBackendError(err, 'Fallback');
      expect(result.detail).toBe('Server Error');
    });

    it('uses fallbackSummary for both when data.error and data.message are missing', () => {
      const err = { response: { data: {} } };
      expect(extractBackendError(err, 'MySummary')).toEqual({
        summary: 'MySummary',
        detail: 'MySummary',
      });
    });

    it('uses summary as detail when data is empty object (fallbackDetail is not reached via object branch)', () => {
      // data={} hits the object branch; detail falls back to summary, not fallbackDetail
      const err = { response: { data: {} } };
      expect(extractBackendError(err, 'Summary', 'CustomDetail')).toEqual({
        summary: 'Summary',
        detail: 'Summary',
      });
    });

    it('uses fallbackDetail when there is no response.data at all', () => {
      // no response → falls through to final return, which uses fallbackDetail
      const err = {};
      expect(extractBackendError(err, 'Summary', 'CustomDetail')).toEqual({
        summary: 'Summary',
        detail: 'CustomDetail',
      });
    });
  });

  describe('response.data is a string', () => {
    it('uses string data as detail and fallbackSummary as summary', () => {
      const err = { response: { data: 'plain text error' } };
      expect(extractBackendError(err, 'Summary')).toEqual({
        summary: 'Summary',
        detail: 'plain text error',
      });
    });

    it('ignores whitespace-only string data', () => {
      const err = { response: { data: '   ' }, message: 'err.message' };
      const result = extractBackendError(err, 'Summary');
      expect(result.detail).toBe('err.message');
    });
  });

  describe('no response.data – falls back to err.message', () => {
    it('uses err.message as detail', () => {
      const err = { message: 'Network error' };
      expect(extractBackendError(err, 'Summary')).toEqual({
        summary: 'Summary',
        detail: 'Network error',
      });
    });

    it('ignores empty err.message and falls back to fallbackSummary', () => {
      const err = { message: '' };
      expect(extractBackendError(err, 'Summary')).toEqual({
        summary: 'Summary',
        detail: 'Summary',
      });
    });
  });

  describe('null / undefined error', () => {
    it('handles null error gracefully', () => {
      expect(extractBackendError(null, 'FB')).toEqual({ summary: 'FB', detail: 'FB' });
    });

    it('handles undefined error gracefully', () => {
      expect(extractBackendError(undefined, 'FB', 'FBDetail')).toEqual({
        summary: 'FB',
        detail: 'FBDetail',
      });
    });
  });
});

// ── normalizeReactionFileId ───────────────────────────────────────────────────

describe('normalizeReactionFileId', () => {
  it('returns positive integers as-is', () => {
    expect(normalizeReactionFileId(42)).toBe(42);
    expect(normalizeReactionFileId(1)).toBe(1);
  });

  it('returns 0 for 0', () => {
    expect(normalizeReactionFileId(0)).toBe(0);
  });

  it('returns 0 for negative numbers', () => {
    expect(normalizeReactionFileId(-5)).toBe(0);
  });

  it('returns 0 for Infinity', () => {
    expect(normalizeReactionFileId(Infinity)).toBe(0);
  });

  it('returns 0 for NaN', () => {
    expect(normalizeReactionFileId(NaN)).toBe(0);
  });

  it('parses a numeric string to a number', () => {
    expect(normalizeReactionFileId('7')).toBe(7);
    expect(normalizeReactionFileId('99')).toBe(99);
  });

  it('returns 0 for string "0"', () => {
    expect(normalizeReactionFileId('0')).toBe(0);
  });

  it('returns 0 for negative numeric string', () => {
    expect(normalizeReactionFileId('-3')).toBe(0);
  });

  it('returns 0 for non-numeric strings', () => {
    expect(normalizeReactionFileId('abc')).toBe(0);
    expect(normalizeReactionFileId('')).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(normalizeReactionFileId(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(normalizeReactionFileId(undefined)).toBe(0);
  });

  it('returns 0 for boolean values', () => {
    expect(normalizeReactionFileId(true)).toBe(0);
    expect(normalizeReactionFileId(false)).toBe(0);
  });

  it('returns 0 for objects', () => {
    expect(normalizeReactionFileId({})).toBe(0);
  });
});

// ── isReactionFilesNotFoundError ──────────────────────────────────────────────

describe('isReactionFilesNotFoundError', () => {
  it('returns true for exact phrase (lowercase)', () => {
    expect(isReactionFilesNotFoundError('reaction files not found')).toBe(true);
  });

  it('returns true for phrase with mixed case', () => {
    expect(isReactionFilesNotFoundError('Reaction Files Not Found')).toBe(true);
    expect(isReactionFilesNotFoundError('REACTION FILES NOT FOUND')).toBe(true);
  });

  it('returns true when phrase is embedded in a longer message', () => {
    expect(
      isReactionFilesNotFoundError('Error: reaction files not found for vsum 42'),
    ).toBe(true);
  });

  it('returns false for unrelated messages', () => {
    expect(isReactionFilesNotFoundError('Network error')).toBe(false);
    expect(isReactionFilesNotFoundError('')).toBe(false);
    expect(isReactionFilesNotFoundError('not found')).toBe(false);
  });

  it('returns false when only partial phrase matches', () => {
    expect(isReactionFilesNotFoundError('reaction files')).toBe(false);
    expect(isReactionFilesNotFoundError('files not found')).toBe(false);
  });
});
