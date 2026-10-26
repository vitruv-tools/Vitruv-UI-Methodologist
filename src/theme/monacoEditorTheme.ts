import { useCallback, useEffect, useRef } from 'react';
import type { editor } from 'monaco-editor';
import { vitruvOCLTheme, vitruvOCLThemeDark } from '../components/constraints/VitruvOCLMonarchGrammar';
import { reactionsDarkTokenRules, reactionsLightTokenRules } from '../components/flow/ReactionsMonarchGrammar';
import { getTheme, useTheme, type ThemeMode } from './theme';

interface MonacoThemeHost {
  editor: {
    defineTheme: (themeName: string, themeData: editor.IStandaloneThemeData) => void;
    setTheme: (themeName: string) => void;
  };
}

export const MONACO_EDITOR_THEME_LIGHT = 'vitruv-editor-light';
export const MONACO_EDITOR_THEME_DARK = 'vitruv-editor-dark';

function editorColors(mode: 'light' | 'dark'): editor.IColors {
  const dark = mode === 'dark';
  return {
    'editor.background': dark ? '#0f172a' : '#ffffff',
    'editor.foreground': dark ? '#f1f5f9' : '#0f172a',
    'editorGutter.background': dark ? '#0f172a' : '#ffffff',
    'editorLineNumber.foreground': dark ? '#64748b' : '#9ca3af',
    'editorLineNumber.activeForeground': dark ? '#cbd5e1' : '#4b5563',
    'editor.lineHighlightBackground': dark ? '#1e293b' : '#f8fafc',
    'editor.lineHighlightBorder': '#00000000',
    'editorCursor.foreground': dark ? '#f1f5f9' : '#0f172a',
    'editor.selectionBackground': dark ? '#1e3a5f' : '#bfdbfe',
    'editor.inactiveSelectionBackground': dark ? '#1e293b' : '#e2e8f0',
    'editorWidget.background': dark ? '#1e293b' : '#ffffff',
    'editorWidget.border': dark ? '#334155' : '#e5e7eb',
    'editorSuggestWidget.background': dark ? '#1e293b' : '#ffffff',
    'editorSuggestWidget.border': dark ? '#334155' : '#e5e7eb',
    'editorSuggestWidget.foreground': dark ? '#f1f5f9' : '#0f172a',
    'editorSuggestWidget.selectedBackground': dark ? '#334155' : '#f1f5f9',
    'minimap.background': dark ? '#0f172a' : '#ffffff',
  };
}

export const vitruvEditorLightTheme: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [...vitruvOCLTheme.rules, ...reactionsLightTokenRules],
  colors: editorColors('light'),
};

export const vitruvEditorDarkTheme: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [...vitruvOCLThemeDark.rules, ...reactionsDarkTokenRules],
  colors: editorColors('dark'),
};

export function monacoEditorThemeName(mode: ThemeMode): string {
  return mode === 'dark' ? MONACO_EDITOR_THEME_DARK : MONACO_EDITOR_THEME_LIGHT;
}

export function syncMonacoEditorTheme(monaco: MonacoThemeHost, mode: ThemeMode = getTheme()): string {
  monaco.editor.defineTheme(MONACO_EDITOR_THEME_LIGHT, vitruvEditorLightTheme);
  monaco.editor.defineTheme(MONACO_EDITOR_THEME_DARK, vitruvEditorDarkTheme);
  const themeName = monacoEditorThemeName(mode);
  monaco.editor.setTheme(themeName);
  return themeName;
}

export function useMonacoEditorTheme(): {
  themeName: string;
  beforeMount: (monaco: MonacoThemeHost) => void;
} {
  const { theme } = useTheme();
  const themeName = monacoEditorThemeName(theme);
  const monacoRef = useRef<MonacoThemeHost | null>(null);

  useEffect(() => {
    if (!monacoRef.current) return;
    syncMonacoEditorTheme(monacoRef.current, theme);
  }, [theme]);

  const beforeMount = useCallback((monacoInstance: MonacoThemeHost) => {
    monacoRef.current = monacoInstance;
    syncMonacoEditorTheme(monacoInstance, getTheme());
  }, []);

  return { themeName, beforeMount };
}
