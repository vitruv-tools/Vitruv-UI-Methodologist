import React from 'react';
import { useTheme, type ThemeMode } from '../../theme/theme';

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z" />
  </svg>
);

interface ThemeToggleProps {
  variant?: 'icon' | 'segmented';
  tone?: 'adaptive' | 'onDark';
}

function getSegmentedButtonStyle(
  active: boolean,
  tone: 'adaptive' | 'onDark',
): React.CSSProperties {
  if (tone === 'onDark') {
    return {
      background: active ? 'rgba(4,148,132,0.28)' : 'transparent',
      color: active ? '#ffffff' : 'rgba(255,255,255,0.62)',
    };
  }
  return {
    background: active ? 'var(--v-chrome-hover)' : 'transparent',
    color: active ? 'var(--v-text)' : 'var(--v-text-muted)',
  };
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'icon',
  tone = 'adaptive',
}) => {
  const { theme, setTheme, toggleTheme, isDark } = useTheme();

  if (variant === 'segmented') {
    const options: Array<{ mode: ThemeMode; label: string; icon: React.ReactNode }> = [
      { mode: 'light', label: 'Light', icon: <SunIcon /> },
      { mode: 'dark', label: 'Dark', icon: <MoonIcon /> },
    ];

    return (
      <div
        role="group"
        aria-label="Color theme"
        style={{
          display: 'flex',
          width: '100%',
          padding: 3,
          borderRadius: 8,
          background: tone === 'onDark' ? 'rgba(255,255,255,0.06)' : 'var(--v-surface-muted)',
          border: tone === 'onDark' ? '1px solid rgba(255,255,255,0.10)' : '1px solid var(--v-border)',
          boxSizing: 'border-box',
        }}
      >
        {options.map(option => {
          const active = theme === option.mode;
          return (
            <button
              key={option.mode}
              type="button"
              aria-pressed={active}
              aria-label={`${option.label} theme`}
              onClick={() => setTheme(option.mode)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                border: 'none',
                borderRadius: 6,
                padding: '7px 8px',
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                transition: 'background 0.12s, color 0.12s',
                ...getSegmentedButtonStyle(active, tone),
              }}
            >
              {option.icon}
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  const nextLabel = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      aria-label={nextLabel}
      title={nextLabel}
      onClick={toggleTheme}
      style={{
        width: 34,
        height: 34,
        border: 'none',
        borderRadius: 6,
        background: 'transparent',
        color: tone === 'onDark' ? 'rgba(255,255,255,0.78)' : 'var(--v-chrome-icon)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'background 0.12s, color 0.12s',
      }}
      onMouseEnter={event => {
        event.currentTarget.style.background = tone === 'onDark' ? 'rgba(255,255,255,0.08)' : 'var(--v-chrome-hover)';
        event.currentTarget.style.color = tone === 'onDark' ? '#ffffff' : 'var(--v-chrome-icon-hover)';
      }}
      onMouseLeave={event => {
        event.currentTarget.style.background = 'transparent';
        event.currentTarget.style.color = tone === 'onDark' ? 'rgba(255,255,255,0.78)' : 'var(--v-chrome-icon)';
      }}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
};
