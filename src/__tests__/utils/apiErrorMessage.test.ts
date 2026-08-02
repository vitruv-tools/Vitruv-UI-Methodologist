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
});
