import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from '../../../components/layout/Header';
import type { User } from '../../../services/auth';

jest.mock('../../../services/api', () => ({
  apiService: {
    getUserInfo: jest.fn().mockResolvedValue({
      data: {
        id: 1,
        email: 'api@example.com',
        firstName: 'Api',
        lastName: 'User',
      },
      message: null,
    }),
    changePassword: jest.fn().mockResolvedValue({
      data: { message: 'Password changed successfully!' },
    }),
  },
}));

const { apiService } = require('../../../services/api') as {
  apiService: {
    getUserInfo: jest.Mock;
    changePassword: jest.Mock;
  };
};

const baseUser: User = {
  id: 'u1',
  username: 'john',
  email: 'john@example.com',
  name: 'John Doe',
  emailVerified: true,
};

// Helper: waits for the avatar to be ready then clicks it.
// The avatar shows "..." while loading, then the initials once the API resolves.
async function clickAvatar() {
  // Wait until the button no longer shows the loading indicator
  const avatarButton = await screen.findByRole('button', {
    name: (name) => name !== '...',
  });
  fireEvent.click(avatarButton);
}

describe('Header', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiService.getUserInfo.mockResolvedValue({
      data: { id: 1, email: 'api@example.com', firstName: 'Api', lastName: 'User' },
      message: null,
    });
    apiService.changePassword.mockResolvedValue({
      data: { message: 'Password changed successfully!' },
    });
  });

  it('renders title', () => {
    render(<Header title="My Title" user={baseUser} />);
    expect(screen.getByText('My Title')).toBeInTheDocument();
  });
});


describe('Header – user menu and change password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiService.getUserInfo.mockResolvedValue({
      data: { id: 1, email: 'api@example.com', firstName: 'Api', lastName: 'User' },
      message: null,
    });
    apiService.changePassword.mockResolvedValue({
      data: { message: 'Password changed successfully!' },
    });
  });

  it('shows user menu on avatar click', async () => {
    render(<Header title="Dashboard" user={baseUser} />);
    await waitFor(() => expect(apiService.getUserInfo).toHaveBeenCalled());
    await clickAvatar();
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    expect(screen.getByText(/Change Password/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign Out/i)).toBeInTheDocument();
  });

  it('calls onLogout when Sign Out is clicked', async () => {
    const onLogout = jest.fn();
    render(<Header user={baseUser} onLogout={onLogout} />);
    await waitFor(() => expect(apiService.getUserInfo).toHaveBeenCalled());
    await clickAvatar();
    await screen.findByRole('menu');
    fireEvent.click(screen.getByText(/Sign Out/i));
    expect(onLogout).toHaveBeenCalled();
  });

  it('opens change password dialog from menu', async () => {
    render(<Header user={baseUser} />);
    await waitFor(() => expect(apiService.getUserInfo).toHaveBeenCalled());
    await clickAvatar();
    await screen.findByRole('menu');
    fireEvent.click(screen.getByText(/Change Password/i));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('shows password requirements when new password is typed', async () => {
    render(<Header user={baseUser} />);
    await waitFor(() => expect(apiService.getUserInfo).toHaveBeenCalled());
    await clickAvatar();
    await screen.findByRole('menu');
    fireEvent.click(screen.getByText(/Change Password/i));
    await screen.findByRole('dialog');

    const newPwInput = screen.getByPlaceholderText('Enter new password');
    await userEvent.type(newPwInput, 'weak');
    expect(screen.getByText(/Be at least 8 characters long/i)).toBeInTheDocument();
  });

  it('submits change password and shows success', async () => {
    render(<Header user={baseUser} />);
    await waitFor(() => expect(apiService.getUserInfo).toHaveBeenCalled());
    await clickAvatar();
    await screen.findByRole('menu');
    fireEvent.click(screen.getByText(/Change Password/i));
    await screen.findByRole('dialog');

    await userEvent.type(screen.getByPlaceholderText('Enter new password'), 'NewPass1!');
    await userEvent.type(screen.getByPlaceholderText('Re-enter new password'), 'NewPass1!');
    fireEvent.click(screen.getByRole('button', { name: /^Change Password$/i }));

    await waitFor(() => {
      expect(apiService.changePassword).toHaveBeenCalledWith('NewPass1!');
    });
    expect(await screen.findByText(/Password changed successfully!/i)).toBeInTheDocument();
  });

  it('shows error when change password API fails', async () => {
    apiService.changePassword.mockRejectedValueOnce(new Error('Old password wrong'));

    render(<Header user={baseUser} />);
    await waitFor(() => expect(apiService.getUserInfo).toHaveBeenCalled());
    await clickAvatar();
    await screen.findByRole('menu');
    fireEvent.click(screen.getByText(/Change Password/i));
    await screen.findByRole('dialog');

    await userEvent.type(screen.getByPlaceholderText('Enter new password'), 'NewPass1!');
    await userEvent.type(screen.getByPlaceholderText('Re-enter new password'), 'NewPass1!');
    fireEvent.click(screen.getByRole('button', { name: /^Change Password$/i }));

    expect(await screen.findByText(/Old password wrong/i)).toBeInTheDocument();
  });

  it('closes change password dialog via Cancel', async () => {
    render(<Header user={baseUser} />);
    await waitFor(() => expect(apiService.getUserInfo).toHaveBeenCalled());
    await clickAvatar();
    await screen.findByRole('menu');
    fireEvent.click(screen.getByText(/Change Password/i));
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('shows email verified badge for verified user', async () => {
    render(<Header user={{ ...baseUser, emailVerified: true }} />);
    await waitFor(() => expect(apiService.getUserInfo).toHaveBeenCalled());
    await clickAvatar();
    expect(await screen.findByText(/✓ Email Verified/i)).toBeInTheDocument();
  });

  it('shows email not verified badge for unverified user', async () => {
    render(<Header user={{ ...baseUser, emailVerified: false }} />);
    await waitFor(() => expect(apiService.getUserInfo).toHaveBeenCalled());
    await clickAvatar();
    expect(await screen.findByText(/Email Not Verified/i)).toBeInTheDocument();
  });
});


describe('Header – initials display (getInitials logic)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiService.getUserInfo.mockResolvedValue({
      data: { id: 1, email: 'a@b.com', firstName: 'Zara', lastName: 'Smith' },
      message: null,
    });
  });

  it('shows initials from API user firstName + lastName', async () => {
    render(<Header user={baseUser} />);
    await waitFor(() => {
      expect(screen.getAllByText('ZS').length).toBeGreaterThan(0);
    });
  });
});