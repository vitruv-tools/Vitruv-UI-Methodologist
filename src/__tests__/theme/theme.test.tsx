import { fireEvent, render, screen } from '@testing-library/react';
import {
  getTheme,
  readStoredTheme,
  resetThemeStore,
  setTheme,
  THEME_STORAGE_KEY,
  toggleTheme,
} from '../../theme/theme';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

describe('theme store', () => {
  afterEach(() => {
    resetThemeStore();
  });

  it('defaults to light so the current look is preserved', () => {
    expect(readStoredTheme()).toBe('light');
    expect(getTheme()).toBe('light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('persists a manual dark-mode choice', () => {
    setTheme('dark');

    expect(getTheme()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('toggles back to light mode', () => {
    setTheme('dark');
    toggleTheme();

    expect(getTheme()).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });
});

describe('ThemeToggle', () => {
  it('switches between dark and light from the icon button', () => {
    render(<ThemeToggle />);

    const toggle = screen.getByRole('button', { name: 'Switch to dark mode' });
    fireEvent.click(toggle);

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('lets the user keep light or continue in dark from the segmented control', () => {
    render(<ThemeToggle variant="segmented" />);

    const light = screen.getByRole('button', { name: 'Light theme' });
    const dark = screen.getByRole('button', { name: 'Dark theme' });

    expect(light).toHaveAttribute('aria-pressed', 'true');
    expect(dark).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(dark);
    expect(dark).toHaveAttribute('aria-pressed', 'true');
    expect(getTheme()).toBe('dark');

    fireEvent.click(light);
    expect(light).toHaveAttribute('aria-pressed', 'true');
    expect(getTheme()).toBe('light');
  });
});
