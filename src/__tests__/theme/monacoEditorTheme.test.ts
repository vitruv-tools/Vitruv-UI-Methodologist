import type { editor } from 'monaco-editor';
import * as monaco from 'monaco-editor';
import { act, renderHook } from '@testing-library/react';
import {
  MONACO_EDITOR_THEME_DARK,
  MONACO_EDITOR_THEME_LIGHT,
  monacoEditorThemeName,
  syncMonacoEditorTheme,
  useMonacoEditorTheme,
  vitruvEditorDarkTheme,
  vitruvEditorLightTheme,
} from '../../theme/monacoEditorTheme';
import { setTheme } from '../../theme/theme';

function contrast(foreground: string, background: string): number {
  const channel = (hex: string, shift: number) => {
    const value = parseInt(hex.slice(shift, shift + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex: string) => {
    const normalized = hex.replace('#', '');
    return (
      0.2126 * channel(normalized, 0) +
      0.7152 * channel(normalized, 2) +
      0.0722 * channel(normalized, 4)
    );
  };
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function foregrounds(rules: editor.ITokenThemeRule[], background: string) {
  return rules
    .filter((rule) => rule.foreground)
    .map((rule) => ({
      token: rule.token,
      ratio: contrast(rule.foreground as string, background),
    }));
}

describe('monaco editor themes', () => {
  it('names a light theme for light mode and a dark theme for dark mode', () => {
    expect(monacoEditorThemeName('light')).toBe(MONACO_EDITOR_THEME_LIGHT);
    expect(monacoEditorThemeName('dark')).toBe(MONACO_EDITOR_THEME_DARK);
    expect(vitruvEditorLightTheme.base).toBe('vs');
    expect(vitruvEditorDarkTheme.base).toBe('vs-dark');
    expect(vitruvEditorLightTheme.colors?.['editor.background']).toBe('#ffffff');
    expect(vitruvEditorDarkTheme.colors?.['editor.background']).toBe('#0f172a');
  });

  it('keeps OCL and Reactions token colors readable on both backgrounds', () => {
    const lightReactions = foregrounds(
      vitruvEditorLightTheme.rules.filter((rule) => rule.token.endsWith('.reactions')),
      'ffffff',
    );
    const darkRules = foregrounds(vitruvEditorDarkTheme.rules, '0f172a');

    for (const entry of [...lightReactions, ...darkRules]) {
      expect(entry.ratio, entry.token).toBeGreaterThanOrEqual(4.5);
    }

    expect(vitruvEditorLightTheme.rules.map((rule) => rule.token)).toEqual(
      expect.arrayContaining(['keyword.package', 'keyword.reactions', 'delimiter']),
    );
    expect(vitruvEditorDarkTheme.rules.map((rule) => rule.token)).toEqual(
      expect.arrayContaining(['keyword.package', 'keyword.reactions', 'delimiter.reactions']),
    );
  });

  it('defines both themes and activates the one for the current mode', () => {
    syncMonacoEditorTheme(monaco as unknown as Parameters<typeof syncMonacoEditorTheme>[0], 'dark');

    expect(monaco.editor.defineTheme).toHaveBeenCalledWith(
      MONACO_EDITOR_THEME_LIGHT,
      vitruvEditorLightTheme,
    );
    expect(monaco.editor.defineTheme).toHaveBeenCalledWith(
      MONACO_EDITOR_THEME_DARK,
      vitruvEditorDarkTheme,
    );
    expect(monaco.editor.setTheme).toHaveBeenCalledWith(MONACO_EDITOR_THEME_DARK);
  });

  it('switches the theme name when the app theme changes', () => {
    const { result } = renderHook(() => useMonacoEditorTheme());
    expect(result.current.themeName).toBe(MONACO_EDITOR_THEME_LIGHT);

    act(() => setTheme('dark'));
    expect(result.current.themeName).toBe(MONACO_EDITOR_THEME_DARK);
  });
});
