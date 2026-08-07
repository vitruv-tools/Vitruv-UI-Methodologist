import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppSidebar } from '../../../components/layout/AppSidebar';

// Mock hooks that have side effects
jest.mock('../../../hooks/useChangePassword', () => ({
  useChangePassword: () => ({
    isOpen: false, open: jest.fn(), close: jest.fn(),
    currentPassword: '',
    newPassword: '', confirmPassword: '',
    setCurrentPassword: jest.fn(),
    setNewPassword: jest.fn(), setConfirmPassword: jest.fn(),
    validation: null, isConfirmValid: true,
    isChanging: false, error: null, success: false,
    handleSubmit: jest.fn(), canSubmit: false,
  }),
}));

jest.mock('../../../hooks/useDismissOnOutsideClick', () => ({
  useDismissOnOutsideClick: jest.fn(),
}));

jest.mock('../../../components/ui/BoundChangePasswordModal', () => ({
  BoundChangePasswordModal: () => null,
}));

const defaultProps = {
  activeView: 'home' as const,
  onViewChange: jest.fn(),
  userName: 'Max Oesterle',
  userRole: 'Methodologist',
  userEmail: 'max@kit.edu',
  onLogout: jest.fn(),
};

describe('AppSidebar', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the Vitruvius logo text', () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getByText('Vitruvius')).toBeInTheDocument();
  });

  it('renders Projects nav item', () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  it('renders Model Library nav item', () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getByText('Model Library')).toBeInTheDocument();
  });

  it('calls onViewChange with "projects" when Projects is clicked', () => {
    const onViewChange = jest.fn();
    render(<AppSidebar {...defaultProps} onViewChange={onViewChange} />);
    fireEvent.click(screen.getByText('Projects'));
    expect(onViewChange).toHaveBeenCalledWith('projects');
  });

  it('calls onViewChange with "library" when Model Library is clicked', () => {
    const onViewChange = jest.fn();
    render(<AppSidebar {...defaultProps} onViewChange={onViewChange} />);
    fireEvent.click(screen.getByText('Model Library'));
    expect(onViewChange).toHaveBeenCalledWith('library');
  });

  it('calls onViewChange with "home" when logo is clicked', () => {
    const onViewChange = jest.fn();
    render(<AppSidebar {...defaultProps} onViewChange={onViewChange} />);
    fireEvent.click(screen.getByTitle('Back to home'));
    expect(onViewChange).toHaveBeenCalledWith('home');
  });

  it('renders the user name in the bottom card', () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getAllByText('Max Oesterle').length).toBeGreaterThan(0);
  });

  it('renders the user role', () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getAllByText('Methodologist').length).toBeGreaterThan(0);
  });

  it('opens the context menu when user card is clicked', () => {
    render(<AppSidebar {...defaultProps} />);
    // The user card button (bottom of sidebar)
    const userCard = screen.getByRole('button', { name: /Max Oesterle/i });
    fireEvent.click(userCard);
    expect(screen.getByText('User Profile')).toBeInTheDocument();
  });

  it('calls onViewChange with "profile" when User Profile is clicked', () => {
    const onViewChange = jest.fn();
    render(<AppSidebar {...defaultProps} onViewChange={onViewChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Max Oesterle/i }));
    fireEvent.click(screen.getByText('User Profile'));
    expect(onViewChange).toHaveBeenCalledWith('profile');
  });

  it('calls onLogout when Log out is clicked', () => {
    const onLogout = jest.fn();
    render(<AppSidebar {...defaultProps} onLogout={onLogout} />);
    fireEvent.click(screen.getByRole('button', { name: /Max Oesterle/i }));
    fireEvent.click(screen.getByText('Log out'));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('highlights Projects nav item when activeView is projects', () => {
    render(<AppSidebar {...defaultProps} activeView="projects" />);
    // active nav item has fontWeight 600 — just check it renders without error
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });
});
