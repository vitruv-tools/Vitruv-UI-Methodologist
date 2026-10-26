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

const lightEditorColors: editor.IColors = {
  'editor.background': '#ffffff',
  'editor.foreground': '#0f172a',
  'editorGutter.background': '#ffffff',
  'editorLineNumber.foreground': '#9ca3af',
  'editorLineNumber.activeForeground': '#4b5563',
  'editor.lineHighlightBackground': '#f8fafc',
  'editor.lineHighlightBorder': '#00000000',
  'editorCursor.foreground': '#0f172a',
  'editor.selectionBackground': '#bfdbfe',
  'editor.inactiveSelectionBackground': '#e2e8f0',
  'editorWidget.background': '#ffffff',
  'editorWidget.border': '#e5e7eb',
  'editorSuggestWidget.background': '#ffffff',
  'editorSuggestWidget.border': '#e5e7eb',
  'editorSuggestWidget.foreground': '#0f172a',
  'editorSuggestWidget.selectedBackground': '#f1f5f9',
  'minimap.background': '#ffffff',
};

const darkEditorColors: editor.IColors = {
  'editor.background': '#0f172a',
  'editor.foreground': '#f1f5f9',
  'editorGutter.background': '#0f172a',
  'editorLineNumber.foreground': '#64748b',
  'editorLineNumber.activeForeground': '#cbd5e1',
  'editor.lineHighlightBackground': '#1e293b',
  'editor.lineHighlightBorder': '#00000000',
  'editorCursor.foreground': '#f1f5f9',
  'editor.selectionBackground': '#1e3a5f',
  'editor.inactiveSelectionBackground': '#1e293b',
  'editorWidget.background': '#1e293b',
  'editorWidget.border': '#334155',
  'editorSuggestWidget.background': '#1e293b',
  'editorSuggestWidget.border': '#334155',
  'editorSuggestWidget.foreground': '#f1f5f9',
  'editorSuggestWidget.selectedBackground': '#334155',
  'minimap.background': '#0f172a',
};

export const vitruvEditorLightTheme: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [...vitruvOCLTheme.rules, ...reactionsLightTokenRules],
  colors: lightEditorColors,
};

export const vitruvEditorDarkTheme: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [...vitruvOCLThemeDark.rules, ...reactionsDarkTokenRules],
  colors: darkEditorColors,
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
