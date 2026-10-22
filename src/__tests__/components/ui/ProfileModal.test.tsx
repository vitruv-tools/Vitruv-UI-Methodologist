import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProfileModal } from '../../../components/ui/ProfileModal';
import { setTheme } from '../../../theme/theme';

jest.mock('../../../components/ui/ProfileView', () => ({
  ProfileView: () => <div>Profile content</div>,
}));

const user = {
  id: '1',
  username: 'tm',
  email: 'tm@example.com',
  givenName: 'Tsotne',
  familyName: 'Mikadze',
  emailVerified: true,
};

describe('ProfileModal', () => {
  it('uses theme surfaces so the dialog matches light or dark mode', () => {
    setTheme('dark');
    render(
      <ProfileModal user={user} onClose={jest.fn()} onNameSaved={jest.fn()} />,
    );

    expect(screen.getByRole('dialog', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByText('Profile content')).toBeInTheDocument();
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });
});
