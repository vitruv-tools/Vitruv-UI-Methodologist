import { useCallback, useSyncExternalStore } from 'react';

export const THEME_STORAGE_KEY = 'vitruv.theme';
export type ThemeMode = 'light' | 'dark';

const listeners = new Set<() => void>();

let currentTheme: ThemeMode = 'light';

export const themeVars = {
  pageBg: 'var(--v-page-bg)',
  workspaceBg: 'var(--v-workspace-bg)',
  workspaceDot: 'var(--v-workspace-dot)',
  surface: 'var(--v-surface)',
  surfaceMuted: 'var(--v-surface-muted)',
  surfaceHover: 'var(--v-surface-hover)',
  text: 'var(--v-text)',
  textSecondary: 'var(--v-text-secondary)',
  textMuted: 'var(--v-text-muted)',
  textFaint: 'var(--v-text-faint)',
  border: 'var(--v-border)',
  borderSubtle: 'var(--v-border-subtle)',
  cardBorder: 'var(--v-card-border)',
  cardShadow: 'var(--v-card-shadow)',
  overlay: 'var(--v-overlay)',
  chromeBg: 'var(--v-chrome-bg)',
  chromeHover: 'var(--v-chrome-hover)',
  chromeIcon: 'var(--v-chrome-icon)',
  chromeIconHover: 'var(--v-chrome-icon-hover)',
  chromeDivider: 'var(--v-chrome-divider)',
  tableHeader: 'var(--v-table-header)',
  inputBg: 'var(--v-input-bg)',
  scrollbarTrack: 'var(--v-scrollbar-track)',
  scrollbarThumb: 'var(--v-scrollbar-thumb)',
  umlEdge: 'var(--v-uml-edge)',
  umlEdgeHalo: 'var(--v-uml-edge-halo)',
  umlCircle: 'var(--v-uml-circle)',
  umlBoxBg: 'var(--v-uml-box-bg)',
  umlBoxMuted: 'var(--v-uml-box-muted)',
  umlBoxHover: 'var(--v-uml-box-hover)',
  umlBoxText: 'var(--v-uml-box-text)',
  umlBoxTextMuted: 'var(--v-uml-box-text-muted)',
  umlBoxBorder: 'var(--v-uml-box-border)',
  dangerBg: 'var(--v-danger-bg)',
  dangerBorder: 'var(--v-danger-border)',
  dangerText: 'var(--v-danger-text)',
  successBg: 'var(--v-success-bg)',
  successBorder: 'var(--v-success-border)',
  successText: 'var(--v-success-text)',
  warningBg: 'var(--v-warning-bg)',
  warningBorder: 'var(--v-warning-border)',
  warningText: 'var(--v-warning-text)',
  disabledBg: 'var(--v-disabled-bg)',
  disabledText: 'var(--v-disabled-text)',
  brandSoft: 'var(--v-brand-soft)',
} as const;

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

export function readStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeMode(stored)) return stored;
  } catch {
    // private mode / unavailable storage
  }
  return 'light';
}

export function applyDocumentTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0b1220' : '#f7f8fa');
  }
}

function emitThemeChange(): void {
  listeners.forEach(listener => listener());
}

export function getTheme(): ThemeMode {
  return currentTheme;
}

export function getServerThemeSnapshot(): ThemeMode {
  return 'light';
}

export function setTheme(theme: ThemeMode): void {
  currentTheme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore persistence failures
  }
  applyDocumentTheme(theme);
  emitThemeChange();
}

export function toggleTheme(): void {
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function initTheme(): ThemeMode {
  currentTheme = readStoredTheme();
  applyDocumentTheme(currentTheme);
  return currentTheme;
}

export function resetThemeStore(): void {
  currentTheme = 'light';
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // ignore
  }
  applyDocumentTheme('light');
  emitThemeChange();
}

if (typeof document !== 'undefined') {
  initTheme();
}

export function useTheme(): {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
} {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerThemeSnapshot);
  const setThemeMode = useCallback((next: ThemeMode) => {
    setTheme(next);
  }, []);
  const toggle = useCallback(() => {
    toggleTheme();
  }, []);

  return {
    theme,
    isDark: theme === 'dark',
    setTheme: setThemeMode,
    toggleTheme: toggle,
  };
}
