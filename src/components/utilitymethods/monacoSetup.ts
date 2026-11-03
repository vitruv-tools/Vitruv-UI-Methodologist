import type { Monaco } from '@monaco-editor/react';
import type { languages } from 'monaco-editor';
import { reactionsLanguageConfig, reactionsMonarch, reactionsThemeLight } from '../flow/ReactionsMonarchGrammar';

/** Language of utility method bodies: Xtend expressions, highlighted like reactions. */
export const XTEND_UTILITY_LANGUAGE_ID = 'xtend-utility';

/** Theme shared by the body editor and the Java viewer; Monaco themes apply to all editors at once. */
export const UTILITY_METHOD_EDITOR_THEME = 'xtend-utility-theme';

/** Xtend keywords that the reactions grammar does not know. */
const XTEND_KEYWORDS = ['def', 'dispatch', 'it', 'return', 'self', 'this', 'throws'];

/** The reactions grammar, which covers Xbase expressions, extended by Xtend's keywords. */
export const xtendUtilityMonarch: languages.IMonarchLanguage = {
  ...reactionsMonarch,
  keywords: [...new Set([...(reactionsMonarch.keywords as string[]), ...XTEND_KEYWORDS])].sort((a, b) =>
    a.localeCompare(b),
  ),
};

/** Registers the utility method language and theme once. */
export function setUpXtendUtility(monaco: Monaco): void {
  if (!monaco.languages.getLanguages?.().some(language => language.id === XTEND_UTILITY_LANGUAGE_ID)) {
    monaco.languages.register({ id: XTEND_UTILITY_LANGUAGE_ID, extensions: ['.xtend'], aliases: ['Xtend'] });
  }
  monaco.languages.setLanguageConfiguration(XTEND_UTILITY_LANGUAGE_ID, reactionsLanguageConfig);
  monaco.languages.setMonarchTokensProvider(XTEND_UTILITY_LANGUAGE_ID, xtendUtilityMonarch);
  monaco.editor.defineTheme(UTILITY_METHOD_EDITOR_THEME, reactionsThemeLight);
}
