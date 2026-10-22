const monaco = {
  languages: {
    register: vi.fn(),
    setMonarchTokensProvider: vi.fn(),
    setLanguageConfiguration: vi.fn(),
    getLanguages: vi.fn(() => []),
    registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
  },
  editor: {
    defineTheme: vi.fn(),
    setTheme: vi.fn(),
    setModelMarkers: vi.fn(),
  },
  MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
};

export default monaco;
export const { languages, editor, MarkerSeverity } = monaco;
