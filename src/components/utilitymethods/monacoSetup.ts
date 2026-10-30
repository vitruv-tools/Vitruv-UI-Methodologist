import type { Monaco } from '@monaco-editor/react';
import {
  vitruvOCLLanguageConfig,
  vitruvOCLLanguageId,
  vitruvOCLMonarch,
  vitruvOCLTheme,
} from '../constraints/VitruvOCLMonarchGrammar';

/** Theme shared by the OCL editor and the Java viewer; Monaco themes apply to all editors at once. */
export const UTILITY_METHOD_EDITOR_THEME = 'vitruvocl-theme';

/** Registers the VitruvOCL language and theme, as the constraints editor does. */
export function setUpVitruvOcl(monaco: Monaco): void {
  if (!monaco.languages.getLanguages?.().some(language => language.id === vitruvOCLLanguageId)) {
    monaco.languages.register({ id: vitruvOCLLanguageId, extensions: ['.ocl'], aliases: ['VitruvOCL'] });
  }
  monaco.languages.setLanguageConfiguration(vitruvOCLLanguageId, vitruvOCLLanguageConfig);
  monaco.languages.setMonarchTokensProvider(vitruvOCLLanguageId, vitruvOCLMonarch);
  monaco.editor.defineTheme(UTILITY_METHOD_EDITOR_THEME, vitruvOCLTheme);
}
