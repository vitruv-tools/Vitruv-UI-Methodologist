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
  const night = mode === 'dark';
  const rows = `
editor.background #ffffff #0f172a
editor.foreground #0f172a #f1f5f9
editorGutter.background #ffffff #0f172a
editorLineNumber.foreground #9ca3af #64748b
editorLineNumber.activeForeground #4b5563 #cbd5e1
editor.lineHighlightBackground #f8fafc #1e293b
editor.lineHighlightBorder #00000000 #00000000
editorCursor.foreground #0f172a #f1f5f9
editor.selectionBackground #bfdbfe #1e3a5f
editor.inactiveSelectionBackground #e2e8f0 #1e293b
editorWidget.background #ffffff #1e293b
editorWidget.border #e5e7eb #334155
editorSuggestWidget.background #ffffff #1e293b
editorSuggestWidget.border #e5e7eb #334155
editorSuggestWidget.foreground #0f172a #f1f5f9
editorSuggestWidget.selectedBackground #f1f5f9 #334155
minimap.background #ffffff #0f172a
`.trim().split('\n');
  const colors: editor.IColors = {};
  let index = 0;
  while (index < rows.length) {
    const [id, day, dusk] = rows[index].trim().split(' ');
    colors[id] = night ? dusk : day;
    index += 1;
  }
  return colors;
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
