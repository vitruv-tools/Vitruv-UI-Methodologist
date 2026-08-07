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

  it('canSubmit is false until current password, password rules, and confirm match are valid', () => {
    const { result } = renderHook(() => useChangePassword());
    act(() => {
      result.current.setCurrentPassword('Current1!');
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
      result.current.setCurrentPassword('Current1!');
      result.current.setNewPassword('Secure1!');
      result.current.setConfirmPassword('Secure1!');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(apiService.changePassword).toHaveBeenCalledWith('Current1!', 'Secure1!');
    expect(result.current.success).toBe('Password updated');
    jest.useRealTimers();
  });

  it('does not submit without a current password', async () => {
    const { result } = renderHook(() => useChangePassword());
    act(() => {
      result.current.setNewPassword('Secure1!');
      result.current.setConfirmPassword('Secure1!');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(apiService.changePassword).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Current password is required');
  });

  it('displays the backend error when the current password is incorrect', async () => {
    (apiService.changePassword as jest.Mock).mockRejectedValueOnce({
      response: { data: { message: 'Current password is incorrect' } },
    });

    const { result } = renderHook(() => useChangePassword());
    act(() => {
      result.current.setCurrentPassword('Wrong1!');
      result.current.setNewPassword('Secure1!');
      result.current.setConfirmPassword('Secure1!');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.error).toBe('Current password is incorrect');
    expect(result.current.success).toBe('');
    expect(result.current.newPassword).toBe('Secure1!');
    expect(result.current.confirmPassword).toBe('Secure1!');
  });
});
