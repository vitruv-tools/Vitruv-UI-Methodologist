import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { ProfileView } from '../../../components/ui/ProfileView';
import { apiService } from '../../../services/api';
import { User } from '../../../services/auth';

// ── mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../services/api', () => ({
  apiService: {
    getUserInfo: jest.fn(),
    updateUserName: jest.fn(),
  },
}));

jest.mock('../../../hooks/useChangePassword', () => ({
  useChangePassword: () => ({
    isOpen: false,
    open: jest.fn(),
    close: jest.fn(),
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    setCurrentPassword: jest.fn(),
    setNewPassword: jest.fn(),
    setConfirmPassword: jest.fn(),
    validation: null,
    isConfirmValid: true,
    isChanging: false,
    error: null,
    success: false,
    handleSubmit: jest.fn(),
    canSubmit: false,
  }),
}));

jest.mock('../../../components/ui/BoundChangePasswordModal', () => ({
  BoundChangePasswordModal: () => null,
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const mockUser: User = {
  id: '42',
  username: 'maxoesterle',
  email: 'max@kit.edu',
  givenName: 'Max',
  familyName: 'Oesterle',
  emailVerified: true,
};

const profileData = {
  id: 42,
  email: 'max@kit.edu',
  firstName: 'Max',
  lastName: 'Oesterle',
  verified: true,
};

type UserInfoResponse = { data: typeof profileData; message: null };

let resolveUserInfo: ((value: UserInfoResponse) => void) | undefined;
let rejectUserInfo: ((reason?: unknown) => void) | undefined;

async function settleUserInfo(data: typeof profileData = profileData) {
  await act(async () => {
    resolveUserInfo?.({ data, message: null });
    await Promise.resolve();
  });
}

async function rejectUserInfoLoad(reason: unknown = new Error('Network error')) {
  await act(async () => {
    rejectUserInfo?.(reason);
    await Promise.resolve();
  });
}

async function renderProfileView(
  user: User | null = mockUser,
  props: { onNameSaved?: () => void } = {},
) {
  render(<ProfileView user={user} {...props} />);
  await settleUserInfo();
  if (user) {
    expect(screen.getAllByText('max@kit.edu').length).toBeGreaterThan(0);
  }
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ProfileView', () => {
  beforeEach(() => {
    (apiService.getUserInfo as jest.Mock).mockImplementation(
      () => new Promise((resolve, reject) => {
        resolveUserInfo = resolve;
        rejectUserInfo = reject;
      }),
    );
    (apiService.updateUserName as jest.Mock).mockResolvedValue({ message: 'User updated successfully' });
  });

  afterEach(() => jest.clearAllMocks());

  it('renders User Profile heading', async () => {
    await renderProfileView();
    expect(screen.getByText('User Profile')).toBeInTheDocument();
  });

  it('fetches profile from backend on mount', async () => {
    await renderProfileView();
    expect(apiService.getUserInfo).toHaveBeenCalledTimes(1);
  });

  it('displays first and last name from backend', async () => {
    await renderProfileView();
    expect(screen.getAllByText('Max').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Oesterle').length).toBeGreaterThan(0);
  });

  it('displays email', async () => {
    await renderProfileView();
    expect(screen.getAllByText('max@kit.edu').length).toBeGreaterThan(0);
  });

  it('shows Edit name button', async () => {
    await renderProfileView();
    expect(screen.getByText(/Edit name/i)).toBeInTheDocument();
  });

  it('switches to edit mode when Edit name is clicked', async () => {
    await renderProfileView();
    fireEvent.click(screen.getByText(/Edit name/i));
    expect(screen.getByDisplayValue('Max')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Oesterle')).toBeInTheDocument();
  });

  it('calls updateUserName on Save changes', async () => {
    await renderProfileView();
    fireEvent.click(screen.getByText(/Edit name/i));

    const firstInput = screen.getByDisplayValue('Max');
    fireEvent.change(firstInput, { target: { value: 'Maximilian' } });
    fireEvent.click(screen.getByText(/Save changes/i));

    await act(async () => {
      await Promise.resolve();
    });
    expect(apiService.updateUserName).toHaveBeenCalledWith('42', 'Maximilian', 'Oesterle');
  });

  it('calls onNameSaved callback after successful save', async () => {
    const onNameSaved = jest.fn();
    await renderProfileView(mockUser, { onNameSaved });
    fireEvent.click(screen.getByText(/Edit name/i));
    fireEvent.click(screen.getByText(/Save changes/i));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onNameSaved).toHaveBeenCalledTimes(1);
  });

  it('cancel button returns to read mode', async () => {
    await renderProfileView();
    fireEvent.click(screen.getByText(/Edit name/i));
    fireEvent.click(screen.getByText(/Cancel/i));
    expect(screen.queryByDisplayValue('Max')).not.toBeInTheDocument();
  });

  it('shows error banner when updateUserName fails', async () => {
    (apiService.updateUserName as jest.Mock).mockRejectedValue(new Error('Server error'));
    await renderProfileView();
    fireEvent.click(screen.getByText(/Edit name/i));
    fireEvent.click(screen.getByText(/Save changes/i));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(/Server error/i)).toBeInTheDocument();
  });

  it('shows Change password button', async () => {
    await renderProfileView();
    expect(screen.getByText(/Change password/i)).toBeInTheDocument();
  });

  it('shows an appearance control to stay in light or continue in dark', async () => {
    await renderProfileView();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Light theme' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Dark theme' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('returns null when user prop is null', async () => {
    const { container } = render(<ProfileView user={null} />);
    await settleUserInfo();
    expect(container.firstChild).toBeNull();
  });

  it('shows load error when getUserInfo fails', async () => {
    render(<ProfileView user={mockUser} />);
    await rejectUserInfoLoad();
    expect(screen.getByText(/Could not load profile data/i)).toBeInTheDocument();
  });
});
