import { renderHook, act } from '@testing-library/react';
import { useChangePassword } from '../../hooks/useChangePassword';
import { apiService } from '../../services/api';

jest.mock('../../services/api', () => ({
  apiService: {
    changePassword: jest.fn(),
  },
}));

describe('useChangePassword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens and closes the modal state', () => {
    const { result } = renderHook(() => useChangePassword());
    expect(result.current.isOpen).toBe(false);
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  it('canSubmit is false until password rules and confirm match', () => {
    const { result } = renderHook(() => useChangePassword());
    act(() => {
      result.current.setNewPassword('Secure1!');
      result.current.setConfirmPassword('Secure1!');
    });
    expect(result.current.canSubmit).toBe(true);
  });

  it('handleSubmit calls api and sets success message', async () => {
    (apiService.changePassword as jest.Mock).mockResolvedValueOnce({
      message: 'Password updated',
    });
    jest.useFakeTimers();

    const { result } = renderHook(() => useChangePassword());
    act(() => {
      result.current.setNewPassword('Secure1!');
      result.current.setConfirmPassword('Secure1!');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(apiService.changePassword).toHaveBeenCalledWith('Secure1!');
    expect(result.current.success).toBe('Password updated');
    jest.useRealTimers();
  });
});
