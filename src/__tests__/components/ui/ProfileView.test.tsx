import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    newPassword: '',
    confirmPassword: '',
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

const mockGetUserInfo = () =>
  (apiService.getUserInfo as jest.Mock).mockResolvedValue({
    data: { id: 42, email: 'max@kit.edu', firstName: 'Max', lastName: 'Oesterle', verified: true },
    message: null,
  });

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ProfileView', () => {
  beforeEach(() => {
    mockGetUserInfo();
    (apiService.updateUserName as jest.Mock).mockResolvedValue({ message: 'User updated successfully' });
  });

  afterEach(() => jest.clearAllMocks());

  it('renders User Profile heading', async () => {
    render(<ProfileView user={mockUser} />);
    expect(screen.getByText('User Profile')).toBeInTheDocument();
  });

  it('fetches profile from backend on mount', async () => {
    render(<ProfileView user={mockUser} />);
    await waitFor(() => expect(apiService.getUserInfo).toHaveBeenCalledTimes(1));
  });

  it('displays first and last name from backend', async () => {
    render(<ProfileView user={mockUser} />);
    await waitFor(() => {
      expect(screen.getAllByText('Max').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Oesterle').length).toBeGreaterThan(0);
    });
  });

  it('displays email', async () => {
    render(<ProfileView user={mockUser} />);
    await waitFor(() => expect(screen.getAllByText('max@kit.edu').length).toBeGreaterThan(0));
  });

  it('shows Edit name button', async () => {
    render(<ProfileView user={mockUser} />);
    await waitFor(() => expect(screen.getByText(/Edit name/i)).toBeInTheDocument());
  });

  it('switches to edit mode when Edit name is clicked', async () => {
    render(<ProfileView user={mockUser} />);
    await waitFor(() => fireEvent.click(screen.getByText(/Edit name/i)));
    expect(screen.getByDisplayValue('Max')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Oesterle')).toBeInTheDocument();
  });

  it('calls updateUserName on Save changes', async () => {
    render(<ProfileView user={mockUser} />);
    await waitFor(() => fireEvent.click(screen.getByText(/Edit name/i)));

    const firstInput = screen.getByDisplayValue('Max');
    fireEvent.change(firstInput, { target: { value: 'Maximilian' } });
    fireEvent.click(screen.getByText(/Save changes/i));

    await waitFor(() =>
      expect(apiService.updateUserName).toHaveBeenCalledWith('42', 'Maximilian', 'Oesterle'),
    );
  });

  it('calls onNameSaved callback after successful save', async () => {
    const onNameSaved = jest.fn();
    render(<ProfileView user={mockUser} onNameSaved={onNameSaved} />);
    await waitFor(() => fireEvent.click(screen.getByText(/Edit name/i)));
    fireEvent.click(screen.getByText(/Save changes/i));
    await waitFor(() => expect(onNameSaved).toHaveBeenCalledTimes(1));
  });

  it('cancel button returns to read mode', async () => {
    render(<ProfileView user={mockUser} />);
    await waitFor(() => fireEvent.click(screen.getByText(/Edit name/i)));
    fireEvent.click(screen.getByText(/Cancel/i));
    expect(screen.queryByDisplayValue('Max')).not.toBeInTheDocument();
  });

  it('shows error banner when updateUserName fails', async () => {
    (apiService.updateUserName as jest.Mock).mockRejectedValue(new Error('Server error'));
    render(<ProfileView user={mockUser} />);
    await waitFor(() => fireEvent.click(screen.getByText(/Edit name/i)));
    fireEvent.click(screen.getByText(/Save changes/i));
    await waitFor(() => expect(screen.getByText(/Server error/i)).toBeInTheDocument());
  });

  it('shows Change password button', async () => {
    render(<ProfileView user={mockUser} />);
    await waitFor(() => expect(screen.getByText(/Change password/i)).toBeInTheDocument());
  });

  it('returns null when user prop is null', () => {
    const { container } = render(<ProfileView user={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows load error when getUserInfo fails', async () => {
    (apiService.getUserInfo as jest.Mock).mockRejectedValue(new Error('Network error'));
    render(<ProfileView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText(/Could not load profile data/i)).toBeInTheDocument(),
    );
  });
});
