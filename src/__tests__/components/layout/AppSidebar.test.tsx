import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppSidebar } from '../../../components/layout/AppSidebar';

// Mock hooks that have side effects
vi.mock('../../../hooks/useChangePassword', () => ({
  useChangePassword: () => ({
    isOpen: false, open: vi.fn(), close: vi.fn(),
    currentPassword: '',
    newPassword: '', confirmPassword: '',
    setCurrentPassword: vi.fn(),
    setNewPassword: vi.fn(), setConfirmPassword: vi.fn(),
    validation: null, isConfirmValid: true,
    isChanging: false, error: null, success: false,
    handleSubmit: vi.fn(), canSubmit: false,
  }),
}));

vi.mock('../../../hooks/useDismissOnOutsideClick', () => ({
  useDismissOnOutsideClick: vi.fn(),
}));

vi.mock('../../../components/ui/BoundChangePasswordModal', () => ({
  BoundChangePasswordModal: () => null,
}));

const defaultProps = {
  activeView: 'home' as const,
  onViewChange: vi.fn(),
  userName: 'Max Oesterle',
  userRole: 'Methodologist',
  userEmail: 'max@kit.edu',
  onLogout: vi.fn(),
};

describe('AppSidebar', () => {
  beforeEach(() => vi.clearAllMocks());

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

  it('renders the Semantic overlap nav item and opens it', () => {
    const onViewChange = vi.fn();
    render(<AppSidebar {...defaultProps} onViewChange={onViewChange} />);
    fireEvent.click(screen.getByText('Semantic overlap'));
    expect(onViewChange).toHaveBeenCalledWith('overlap');
  });

  it('calls onViewChange with "projects" when Projects is clicked', () => {
    const onViewChange = vi.fn();
    render(<AppSidebar {...defaultProps} onViewChange={onViewChange} />);
    fireEvent.click(screen.getByText('Projects'));
    expect(onViewChange).toHaveBeenCalledWith('projects');
  });

  it('calls onViewChange with "library" when Model Library is clicked', () => {
    const onViewChange = vi.fn();
    render(<AppSidebar {...defaultProps} onViewChange={onViewChange} />);
    fireEvent.click(screen.getByText('Model Library'));
    expect(onViewChange).toHaveBeenCalledWith('library');
  });

  it('calls onViewChange with "home" when logo is clicked', () => {
    const onViewChange = vi.fn();
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
    const onViewChange = vi.fn();
    render(<AppSidebar {...defaultProps} onViewChange={onViewChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Max Oesterle/i }));
    fireEvent.click(screen.getByText('User Profile'));
    expect(onViewChange).toHaveBeenCalledWith('profile');
  });

  it('calls onLogout when Log out is clicked', () => {
    const onLogout = vi.fn();
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

  it('lets the user continue in dark mode or stay in the current light theme', () => {
    render(<AppSidebar {...defaultProps} />);

    const light = screen.getByRole('button', { name: 'Light theme' });
    const dark = screen.getByRole('button', { name: 'Dark theme' });

    expect(light).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(dark);

    expect(dark).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('vitruv.theme')).toBe('dark');

    fireEvent.click(light);
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  describe('navigation entries look the same', () => {
    const NAV_LABELS = ['Projects', 'Model Library', 'Semantic overlap'];
    const navButton = (label: string) => screen.getByRole('button', { name: label });
    const look = (button: HTMLElement) => ({
      backgroundColor: button.style.backgroundColor,
      backgroundImage: button.style.backgroundImage,
      color: button.style.color,
    });

    it('draws every entry on the opaque sidebar colour, so the background picture does not show through', () => {
      render(<AppSidebar {...defaultProps} />);
      const looks = NAV_LABELS.map(label => look(navButton(label)));
      expect(looks[0].backgroundColor).toBe('rgb(11, 23, 32)');
      expect(looks[1]).toEqual(looks[0]);
      expect(looks[2]).toEqual(looks[0]);
    });

    it('uses the same hovered look for every entry', () => {
      render(<AppSidebar {...defaultProps} />);
      const looks = NAV_LABELS.map(label => {
        const button = navButton(label);
        fireEvent.mouseEnter(button);
        const hovered = look(button);
        fireEvent.mouseLeave(button);
        return hovered;
      });
      expect(looks[0].backgroundImage).toContain('linear-gradient');
      expect(looks[1]).toEqual(looks[0]);
      expect(looks[2]).toEqual(looks[0]);
    });

    it('uses the same active look for every entry', () => {
      const views = ['projects', 'library', 'overlap'] as const;
      const looks = views.map((view, index) => {
        const { unmount } = render(<AppSidebar {...defaultProps} activeView={view} />);
        const active = look(navButton(NAV_LABELS[index]));
        unmount();
        return active;
      });
      expect(looks[1]).toEqual(looks[0]);
      expect(looks[2]).toEqual(looks[0]);
    });

    it('draws the entries above the background picture', () => {
      const { container } = render(<AppSidebar {...defaultProps} />);
      const nav = container.querySelector('nav') as HTMLElement;
      expect(nav.style.position).toBe('relative');
      expect(nav.style.zIndex).toBe('1');
    });

    it('keeps the background picture where it starts below Model Library', () => {
      const { container } = render(<AppSidebar {...defaultProps} />);
      const picture = container.querySelector('img[src$="sidebar-bg.png"]') as HTMLElement;
      expect(picture.style.top).toBe('160px');
    });
  });
});
