import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  CanvasAccountMenu,
  type CanvasAccountDisplay,
} from '../../../components/canvas/CanvasAccountMenu';
import { AuthService } from '../../../services/auth';
import { USER_PROFILE_LABEL } from '../../../constants/accountLabels';

const mockRefreshCurrentUser = jest.fn().mockResolvedValue(null);

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      username: 'ahmed',
      givenName: 'Ahmed',
      familyName: 'Ibrahim',
      email: 'ahmed@example.com',
    },
    refreshCurrentUser: mockRefreshCurrentUser,
  }),
}));

jest.mock('../../../services/auth', () => ({
  AuthService: {
    signOut: jest.fn(),
  },
}));

jest.mock('../../../components/ui/ProfileModal', () => ({
  ProfileModal: ({
    onClose,
    onNameSaved,
  }: {
    onClose: () => void;
    onNameSaved: () => void;
  }) => (
    <div role="dialog" aria-label="Profile">
      <button type="button" onClick={onNameSaved}>Save profile name</button>
      <button type="button" onClick={onClose}>Close profile modal</button>
    </div>
  ),
}));

const account: CanvasAccountDisplay = {
  initials: 'AI',
  displayName: 'Ahmed Ibrahim',
  avatarBackground: 'linear-gradient(135deg, #049484, #06b89e)',
  ringColor: '#049484',
};

const renderAccountMenu = () => {
  const dismissalBoundaryRef = React.createRef<HTMLDivElement>();
  const onCloseSiblingMenu = jest.fn();
  const view = render(
    <div ref={dismissalBoundaryRef}>
      <CanvasAccountMenu
        account={account}
        dismissalBoundaryRef={dismissalBoundaryRef}
        siblingMenuOpen={false}
        onCloseSiblingMenu={onCloseSiblingMenu}
      />
    </div>,
  );

  return { ...view, onCloseSiblingMenu };
};

beforeEach(() => {
  jest.clearAllMocks();
  (AuthService.signOut as jest.Mock).mockReturnValue(new Promise<void>(() => undefined));
});

describe('CanvasAccountMenu', () => {
  it('renders the account avatar with its existing accessible title', () => {
    renderAccountMenu();

    expect(screen.getByRole('button', { name: 'My account' })).toHaveAttribute('title', 'My account');
  });

  it('opens and closes the profile menu from the account avatar', () => {
    renderAccountMenu();

    const accountButton = screen.getByRole('button', { name: 'My account' });
    fireEvent.click(accountButton);
    expect(screen.getByText('Ahmed Ibrahim')).toBeInTheDocument();

    fireEvent.click(accountButton);
    expect(screen.queryByText('Ahmed Ibrahim')).not.toBeInTheDocument();
  });

  it('shows the existing account name, role, and profile action', () => {
    renderAccountMenu();

    fireEvent.click(screen.getByRole('button', { name: 'My account' }));

    expect(screen.getByText('Ahmed Ibrahim')).toBeInTheDocument();
    expect(screen.getByText('Methodologist')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(USER_PROFILE_LABEL) })).toBeInTheDocument();
  });

  it('opens ProfileModal from the profile action', () => {
    renderAccountMenu();

    fireEvent.click(screen.getByRole('button', { name: 'My account' }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(USER_PROFILE_LABEL) }));

    expect(screen.getByRole('dialog', { name: 'Profile' })).toBeInTheDocument();
  });

  it('closes ProfileModal and forwards the current-user refresh callback', () => {
    renderAccountMenu();

    fireEvent.click(screen.getByRole('button', { name: 'My account' }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(USER_PROFILE_LABEL) }));
    fireEvent.click(screen.getByRole('button', { name: 'Save profile name' }));

    expect(mockRefreshCurrentUser).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Close profile modal' }));
    expect(screen.queryByRole('dialog', { name: 'Profile' })).not.toBeInTheDocument();
  });

  it('keeps the logout label and invokes AuthService.signOut', () => {
    renderAccountMenu();

    fireEvent.click(screen.getByRole('button', { name: 'My account' }));
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(AuthService.signOut).toHaveBeenCalledTimes(1);
  });
});
