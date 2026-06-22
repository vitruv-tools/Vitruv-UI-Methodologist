const monaco = {
  languages: {
    register: jest.fn(),
    setMonarchTokensProvider: jest.fn(),
    setLanguageConfiguration: jest.fn(),
    getLanguages: jest.fn(() => []),
    registerCompletionItemProvider: jest.fn(() => ({ dispose: jest.fn() })),
  },
  editor: {
    defineTheme: jest.fn(),
    setTheme: jest.fn(),
    setModelMarkers: jest.fn(),
  },
  MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
};

export default monaco;
export const { languages, editor, MarkerSeverity } = monaco;
