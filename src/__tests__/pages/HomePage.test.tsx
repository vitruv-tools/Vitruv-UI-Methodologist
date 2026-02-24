import React from 'react';
import { render, screen } from '@testing-library/react';
import { HomePage } from '../../pages/HomePage';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', username: 'test-user' },
    signOut: jest.fn(),
  }),
}));

jest.mock('../../components', () => ({
  SidebarTabs: ({ width }: { width: number }) => (
    <div data-testid="sidebar-tabs">Sidebar width: {width}</div>
  ),
}));

jest.mock('../../components/layout/Header', () => ({
  Header: ({ user }: { user: any }) => (
    <header data-testid="header">Header user: {user?.username}</header>
  ),
}));

describe('HomePage', () => {
  it('renders sidebar and header', () => {
    render(<HomePage />);

    expect(screen.getByTestId('sidebar-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('renders Vitruvius logo image', () => {
    render(<HomePage />);

    const logo = screen.getByAltText(/Vitruvius/i);
    expect(logo).toBeInTheDocument();
    expect((logo as HTMLImageElement).src).toContain('/assets/vitruvius1.png');
  });
});

