import { extractApiErrorMessage } from '../../utils/apiErrorMessage';

describe('extractApiErrorMessage', () => {
  it('returns response.data.message when present', () => {
    const err = { response: { data: { message: '  Server said no  ' } } };
    expect(extractApiErrorMessage(err, 'fallback')).toBe('  Server said no  ');
  });

  it('returns err.message when response message missing', () => {
    expect(extractApiErrorMessage({ message: 'Network down' }, 'fallback')).toBe('Network down');
  });

  it('returns fallback for unknown errors', () => {
    expect(extractApiErrorMessage({}, 'fallback')).toBe('fallback');
  });

  it('keeps the complete backend payload instead of rewriting it', () => {
    const message = 'org.springframework.web.HttpRequestMethodNotSupportedException: Request method PUT not supported';
    expect(extractApiErrorMessage({ response: { data: { message } } }, 'Save failed')).toBe(message);
  });
});
