import type { Mock } from 'vitest';
vi.mock('monaco-editor', () => ({
  languages: {
    register: vi.fn(),
    setMonarchTokensProvider: vi.fn(),
    setLanguageConfiguration: vi.fn(),
    getLanguages: vi.fn(() => []),
  },
  editor: {
    defineTheme: vi.fn(),
  },
}));

// Import after mock is set up
import * as monacoMock from 'monaco-editor';
import {
  vitruvOCLLanguageId,
  vitruvOCLMonarch,
  vitruvOCLTheme,
  vitruvOCLThemeDark,
  vitruvOCLLanguageConfig,
  registerVitruvOCLLanguage,
} from '../../../components/constraints/VitruvOCLMonarchGrammar';

beforeEach(() => {
  vi.clearAllMocks();
  (monacoMock.languages.getLanguages as Mock).mockReturnValue([]);
});

describe('vitruvOCLLanguageId', () => {
  it('should equal "vitruvocl"', () => {
    expect(vitruvOCLLanguageId).toBe('vitruvocl');
  });
});

describe('vitruvOCLMonarch', () => {
  it('should have a keywords array', () => {
    expect(Array.isArray(vitruvOCLMonarch.keywords)).toBe(true);
  });

  it('should include expected OCL control-flow keywords', () => {
    const keywords = vitruvOCLMonarch.keywords as string[];
    expect(keywords).toContain('if');
    expect(keywords).toContain('then');
    expect(keywords).toContain('else');
    expect(keywords).toContain('endif');
    expect(keywords).toContain('let');
    expect(keywords).toContain('in');
  });

  it('should include logical operator keywords', () => {
    const keywords = vitruvOCLMonarch.keywords as string[];
    expect(keywords).toContain('and');
    expect(keywords).toContain('or');
    expect(keywords).toContain('not');
    expect(keywords).toContain('implies');
    expect(keywords).toContain('xor');
  });

  it('should have a tokenizer object', () => {
    expect(vitruvOCLMonarch.tokenizer).toBeDefined();
    expect(typeof vitruvOCLMonarch.tokenizer).toBe('object');
  });

  it('should have tokenizer.root as an array', () => {
    expect(Array.isArray(vitruvOCLMonarch.tokenizer.root)).toBe(true);
    expect((vitruvOCLMonarch.tokenizer.root as unknown[]).length).toBeGreaterThan(0);
  });

  it('should have tokenizer.blockComment defined', () => {
    expect(vitruvOCLMonarch.tokenizer.blockComment).toBeDefined();
    expect(Array.isArray(vitruvOCLMonarch.tokenizer.blockComment)).toBe(true);
  });
});

describe('vitruvOCLTheme', () => {
  it('should have base set to "vs"', () => {
    expect(vitruvOCLTheme.base).toBe('vs');
  });

  it('should have inherit set to true', () => {
    expect(vitruvOCLTheme.inherit).toBe(true);
  });

  it('should have a non-empty rules array', () => {
    expect(Array.isArray(vitruvOCLTheme.rules)).toBe(true);
    expect(vitruvOCLTheme.rules.length).toBeGreaterThan(0);
  });

  it('should have colors with editor.background set to #ffffff', () => {
    expect(vitruvOCLTheme.colors).toBeDefined();
    expect(vitruvOCLTheme.colors?.['editor.background']).toBe('#ffffff');
  });
});

describe('vitruvOCLThemeDark', () => {
  it('should have base set to "vs-dark"', () => {
    expect(vitruvOCLThemeDark.base).toBe('vs-dark');
  });

  it('should recolor every light-theme token for a dark background', () => {
    const darkByToken = new Map(vitruvOCLThemeDark.rules.map((rule) => [rule.token, rule]));
    for (const rule of vitruvOCLTheme.rules) {
      const dark = darkByToken.get(rule.token);
      expect(dark).toBeDefined();
      expect(dark?.fontStyle).toBe(rule.fontStyle);
      expect(dark?.foreground?.toLowerCase()).not.toBe('000000');
      expect(dark?.foreground?.toLowerCase()).not.toBe('0000ff');
    }
  });

  it('should use the app dark input background', () => {
    expect(vitruvOCLThemeDark.colors?.['editor.background']).toBe('#0f172a');
  });
});

describe('vitruvOCLLanguageConfig', () => {
  it('should have lineComment set to "--"', () => {
    expect(vitruvOCLLanguageConfig.comments).toBeDefined();
    expect((vitruvOCLLanguageConfig.comments as { lineComment: string }).lineComment).toBe('--');
  });

  it('should have a non-empty brackets array', () => {
    expect(Array.isArray(vitruvOCLLanguageConfig.brackets)).toBe(true);
    expect((vitruvOCLLanguageConfig.brackets as unknown[]).length).toBeGreaterThan(0);
  });

  it('should have a non-empty autoClosingPairs array', () => {
    expect(Array.isArray(vitruvOCLLanguageConfig.autoClosingPairs)).toBe(true);
    expect((vitruvOCLLanguageConfig.autoClosingPairs as unknown[]).length).toBeGreaterThan(0);
  });
});

describe('registerVitruvOCLLanguage', () => {
  it('should call register with the correct language id', () => {
    registerVitruvOCLLanguage();
    expect(monacoMock.languages.register).toHaveBeenCalledWith(
      expect.objectContaining({ id: vitruvOCLLanguageId })
    );
  });

  it('should call setMonarchTokensProvider with the language id', () => {
    registerVitruvOCLLanguage();
    expect(monacoMock.languages.setMonarchTokensProvider).toHaveBeenCalledWith(
      vitruvOCLLanguageId,
      vitruvOCLMonarch
    );
  });

  it('should call setLanguageConfiguration with the language id', () => {
    registerVitruvOCLLanguage();
    expect(monacoMock.languages.setLanguageConfiguration).toHaveBeenCalledWith(
      vitruvOCLLanguageId,
      vitruvOCLLanguageConfig
    );
  });

  it('should define the light and dark OCL themes', () => {
    registerVitruvOCLLanguage();
    expect(monacoMock.editor.defineTheme).toHaveBeenCalledWith('vitruvocl-light', vitruvOCLTheme);
    expect(monacoMock.editor.defineTheme).toHaveBeenCalledWith('vitruvocl-dark', vitruvOCLThemeDark);
  });

  it('should not register again when the language is already registered', () => {
    (monacoMock.languages.getLanguages as Mock).mockReturnValue([{ id: vitruvOCLLanguageId }]);
    registerVitruvOCLLanguage();
    expect(monacoMock.languages.register).not.toHaveBeenCalled();
    expect(monacoMock.languages.setMonarchTokensProvider).not.toHaveBeenCalled();
    expect(monacoMock.languages.setLanguageConfiguration).not.toHaveBeenCalled();
    expect(monacoMock.editor.defineTheme).not.toHaveBeenCalled();
  });

  it('should register on first call and skip on second call', () => {
    // First call — not registered yet
    registerVitruvOCLLanguage();
    expect(monacoMock.languages.register).toHaveBeenCalledTimes(1);

    // Simulate language now being present
    vi.clearAllMocks();
    (monacoMock.languages.getLanguages as Mock).mockReturnValue([{ id: vitruvOCLLanguageId }]);

    // Second call — should be a no-op
    registerVitruvOCLLanguage();
    expect(monacoMock.languages.register).not.toHaveBeenCalled();
  });
});
