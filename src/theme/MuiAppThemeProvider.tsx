import React, { useMemo } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useTheme } from './theme';

/**
 * MUI palette that follows the app `data-theme` so Low Code form controls
 * (Select, TextField, Checkbox) match light and dark canvas chrome.
 */
export const MuiAppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isDark } = useTheme();
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: isDark ? 'dark' : 'light',
          primary: { main: '#049484' },
          background: {
            default: isDark ? '#0b1220' : '#f7f8fa',
            paper: isDark ? '#1e293b' : '#ffffff',
          },
          text: {
            primary: isDark ? '#f1f5f9' : '#0f172a',
            secondary: isDark ? '#cbd5e1' : '#4b5563',
          },
          divider: isDark ? '#334155' : '#e5e7eb',
        },
        components: {
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                backgroundColor: 'var(--v-input-bg)',
                color: 'var(--v-text)',
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundColor: 'var(--v-surface)',
                backgroundImage: 'none',
                color: 'var(--v-text)',
              },
            },
          },
        },
      }),
    [isDark],
  );

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};
